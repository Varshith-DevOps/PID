/**
 * @fileoverview Authentication controller.
 * Handles user login, registration, profile retrieval, and password management.
 * @module controllers/authController
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { getDefaultPermissions } = require('./permissionController');

// ──── Login ────────────────────────────────────────────────────────────────

/**
 * Authenticate a user with email and password.
 * Returns a JWT token, user profile, and permissions on success.
 *
 * @param {import('express').Request} req - Request with { email, password } in body
 * @param {import('express').Response} res - Response with token, user data, and permissions
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { permissions: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Sign JWT with user identity and role
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    const permissions = user.permissions.length > 0
      ? user.permissions
      : getDefaultPermissions(user.role);

    // Find linked employee record for employee-specific features
    const employee = await prisma.employee.findFirst({ where: { userId: user.id } });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        employeeId: employee?.id || null,
      },
      permissions,
    });
  } catch (error) {
    console.error('[LOGIN ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// ──── Registration ─────────────────────────────────────────────────────────

/**
 * Register a new user account.
 * Creates user with hashed password and default role-based permissions.
 *
 * @param {import('express').Request} req - Request with { email, password, name, role? } in body
 * @param {import('express').Response} res - Response with token, user data, and permissions
 */
const register = async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password and name required' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Hash password with bcrypt (10 salt rounds)
    const hashedPassword = await bcrypt.hash(password, 10);
    const userRole = role || 'EMPLOYEE';

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: userRole,
        permissions: {
          create: getDefaultPermissions(userRole),
        },
      },
      include: { permissions: true },
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      permissions: user.permissions,
    });
  } catch (error) {
    console.error('[REGISTER ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// ──── Profile ──────────────────────────────────────────────────────────────

/**
 * Retrieve the authenticated user's profile with permissions.
 * Also resolves the linked employee record if one exists.
 *
 * @param {import('express').Request} req - Request with authenticated user (req.user)
 * @param {import('express').Response} res - Response with user profile and permissions
 */
const getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { permissions: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const permissions = user.permissions.length > 0
      ? user.permissions
      : getDefaultPermissions(user.role);

    // Find linked employee record
    const employee = await prisma.employee.findFirst({ where: { userId: user.id } });

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      employeeId: employee?.id || null,
      permissions,
    });
  } catch (error) {
    console.error('[GET PROFILE ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// ──── Password Management ──────────────────────────────────────────────────

/**
 * Change the authenticated user's own password.
 * Requires the current password for verification.
 *
 * @param {import('express').Request} req - Request with { currentPassword, newPassword } in body
 * @param {import('express').Response} res - Success message
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword },
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('[CHANGE PASSWORD ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Admin-only: Reset a user's password.
 * Generates a temporary password if none is provided.
 *
 * @param {import('express').Request} req - Request with userId param and optional { newPassword } in body
 * @param {import('express').Response} res - Response with the temporary password
 */
const resetPasswordForUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Generate a temporary password if none provided
    const tempPassword = newPassword || Math.random().toString(36).slice(-8) + 'A1!';
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    res.json({ message: 'Password reset successfully', temporaryPassword: tempPassword });
  } catch (error) {
    console.error('[RESET PASSWORD ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { login, register, getProfile, changePassword, resetPasswordForUser };