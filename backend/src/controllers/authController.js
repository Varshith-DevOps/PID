/**
 * @fileoverview Authentication controller.
 * Handles user login, registration, profile retrieval, and password management.
 * @module controllers/authController
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../config/database');
const { getDefaultPermissions } = require('./permissionController');
const { validatePassword, generateTempPassword } = require('../services/validators');
const { generateCsrfToken, setCsrfCookie } = require('../middleware/csrf');
const {
  MFA_TOKEN_TTL,
  generateBase32Secret,
  verifyTotp,
  generateRecoveryCodes,
  hashRecoveryCode,
  buildOtpAuthUrl,
} = require('../services/mfaService');
const { logSecurityEvent, clientIp } = require('../utils/securityEvents');
const loginGuard = require('../utils/loginGuard');
const { BCRYPT_ROUNDS } = require('../utils/password');
const { normalizeSubdomain, slugifySubdomain } = require('../utils/subdomain');
const { isPlatformAccount } = require('../rbac/platformRoles');

// Owner-side accounts can be required to use MFA (set REQUIRE_PLATFORM_MFA=true in
// production). Surfaced as `mustSetupMfa` so the client forces enrolment before use.
const requirePlatformMfa = (role, mfaEnabled) =>
  process.env.REQUIRE_PLATFORM_MFA === 'true' && isPlatformAccount(role) && !mfaEnabled;

// App-owner accounts authenticate on the apex domain (no tenant subdomain).
const OWNER_ROLES = ['SUPER_ADMIN', 'SALES', 'SUPPORT'];

// Subdomain-per-tenant binding is only meaningful when the deployment actually
// serves tenants on real subdomains (wildcard DNS), configured via APP_BASE_DOMAIN.
// On a single domain / local dev (no APP_BASE_DOMAIN, or 'localhost'), binding is
// OFF so every account signs in normally on the one host.
const SUBDOMAIN_TENANCY = Boolean(process.env.APP_BASE_DOMAIN)
  && process.env.APP_BASE_DOMAIN.toLowerCase() !== 'localhost';

/**
 * Strict tenant-subdomain binding (only when SUBDOMAIN_TENANCY is enabled).
 * Browser clients send `x-tenant-subdomain` (the workspace host). Tenant users may
 * only sign in on their own workspace; owner accounts only on the apex. Returns an
 * error response object to send, or null when the login may proceed.
 */
const checkWorkspaceBinding = async (req, user) => {
  if (!SUBDOMAIN_TENANCY) return null; // single-domain / local dev — no binding
  const subHeader = req.headers['x-tenant-subdomain'];
  if (subHeader === undefined) return null;
  const requestedSub = normalizeSubdomain(subHeader);

  if (requestedSub) {
    const workspace = await prisma.company.findFirst({ where: { subdomain: requestedSub } });
    if (!workspace || user.companyId !== workspace.id) {
      return { status: 403, body: { error: 'This account does not belong to this workspace.', wrongWorkspace: true } };
    }
    return null;
  }
  // Apex/owner domain: only owner accounts. Point tenant users to their workspace.
  if (!OWNER_ROLES.includes(user.role)) {
    let subdomain = null;
    if (user.companyId) {
      const c = await prisma.company.findUnique({ where: { id: user.companyId } });
      subdomain = c?.subdomain || c?.code || null;
    }
    return { status: 403, body: { error: 'Use your organization workspace to sign in.', wrongWorkspace: true, subdomain } };
  }
  return null;
};

// Access tokens are short-lived by default; a refresh flow renews them. Operators
// can override via ACCESS_TOKEN_TTL / JWT_EXPIRES_IN.
const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || process.env.JWT_EXPIRES_IN || '1h';
const REFRESH_TOKEN_TTL = process.env.REFRESH_TOKEN_TTL || '30d';
const REFRESH_COOKIE_PATH = '/api/auth';

const signAccessToken = (user) => jwt.sign(
  { id: user.id, email: user.email, role: user.role, purpose: 'ACCESS', tv: user.tokenVersion ?? 0 },
  process.env.JWT_SECRET,
  { expiresIn: ACCESS_TOKEN_TTL }
);

const signRefreshToken = (user) => jwt.sign(
  { id: user.id, purpose: 'REFRESH', tv: user.tokenVersion ?? 0 },
  process.env.JWT_SECRET,
  { expiresIn: REFRESH_TOKEN_TTL }
);

// Set COOKIE_DOMAIN=.yourdomain.com in production so the session is shared across
// all tenant subdomains and the API host. Left unset locally (host-only cookie).
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;

const setRefreshCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    domain: COOKIE_DOMAIN,
    path: REFRESH_COOKIE_PATH, // only sent to /api/auth/* (refresh, logout)
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
};

const setAuthCookie = (res, token, user) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    domain: COOKIE_DOMAIN,
    maxAge: 24 * 60 * 60 * 1000
  });
  // Pair the session cookie with a readable CSRF token (double-submit pattern).
  setCsrfCookie(res, generateCsrfToken());
  // Issue a long-lived refresh token so short-lived access tokens can be renewed.
  if (user) setRefreshCookie(res, signRefreshToken(user));
};

const buildLoginPayload = async (user, token) => {
  const permissions = user.permissions?.length > 0
    ? user.permissions
    : getDefaultPermissions(user.role);
  const employee = await prisma.employee.findFirst({ where: { userId: user.id } });

  let subscriptionFeatures = null;
  if (user.companyId && user.role !== 'SUPER_ADMIN') {
    const activeSub = await prisma.subscription.findFirst({
      where: { companyId: user.companyId, status: 'ACTIVE' },
      include: { plan: true },
      orderBy: { endDate: 'desc' }
    });
    if (activeSub?.plan?.featureLimits) {
      try {
        subscriptionFeatures = JSON.parse(activeSub.plan.featureLimits);
      } catch (e) {}
    }
  }

  let companyName = null;
  let companyLogo = null;
  let companyKycStatus = null;
  let companyKycRemarks = null;
  let companyCin = null;
  let companySubdomain = null;
  let hasUsedFreeTrial = false;
  let freeTrialExpiresAt = null;
  let billingStatus = null;
  let graceEndsAt = null;

  if (user.companyId) {
    const company = await prisma.company.findUnique({
      where: { id: user.companyId }
    });
    if (company) {
      companyName = company.name;
      companyLogo = company.logoUrl;
      companyKycStatus = company.kycStatus;
      companyKycRemarks = company.kycRemarks;
      companyCin = company.cin;
      companySubdomain = company.subdomain || company.code;
      hasUsedFreeTrial = company.hasUsedFreeTrial;
      freeTrialExpiresAt = company.freeTrialExpiresAt;
      billingStatus = company.billingStatus;
      graceEndsAt = company.graceEndsAt;
    }
  }

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      employeeId: employee?.id || null,
      mfaEnabled: user.mfaEnabled,
      mustChangePassword: user.mustChangePassword || false,
      mustSetupMfa: requirePlatformMfa(user.role, user.mfaEnabled),
      subscriptionFeatures,
      companyName,
      companyLogo,
      companyKycStatus,
      companyKycRemarks,
      companyCin,
      companySubdomain,
      hasUsedFreeTrial,
      freeTrialExpiresAt,
      billingStatus,
      graceEndsAt,
    },
    permissions,
  };
};

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

    const ip = clientIp(req);

    // Account/IP lockout: slows credential stuffing even under the IP rate limit.
    const lock = loginGuard.check(email, ip);
    if (lock.locked) {
      await logSecurityEvent(req, { action: 'AUTH_LOGIN_LOCKED', userEmail: email, details: { retryAfterSec: lock.retryAfterSec } });
      res.set('Retry-After', String(lock.retryAfterSec));
      return res.status(429).json({ error: 'Too many failed attempts. Please try again later.' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { permissions: true },
    });

    if (!user) {
      loginGuard.recordFailure(email, ip);
      await logSecurityEvent(req, { action: 'AUTH_LOGIN_FAILURE', userEmail: email, details: { reason: 'unknown_user' } });
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (!user.isActive) {
      loginGuard.recordFailure(email, ip);
      await logSecurityEvent(req, { action: 'AUTH_LOGIN_FAILURE', userId: user.id, userEmail: email, details: { reason: 'deactivated_account' } });
      return res.status(403).json({ error: 'Your account has been deactivated. Contact HR.' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      loginGuard.recordFailure(email, ip);
      await logSecurityEvent(req, { action: 'AUTH_LOGIN_FAILURE', userId: user.id, userEmail: email, details: { reason: 'bad_password' } });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Strict workspace binding: tenant users only on their subdomain, owners on apex.
    const binding = await checkWorkspaceBinding(req, user);
    if (binding) {
      loginGuard.recordFailure(email, ip);
      await logSecurityEvent(req, { action: 'AUTH_LOGIN_WRONG_WORKSPACE', userId: user.id, userEmail: email });
      return res.status(binding.status).json(binding.body);
    }

    if (user.mfaEnabled) {
      const mfaToken = jwt.sign(
        { id: user.id, email: user.email, role: user.role, purpose: 'MFA' },
        process.env.JWT_SECRET,
        { expiresIn: MFA_TOKEN_TTL }
      );
      await logSecurityEvent(req, { action: 'AUTH_MFA_CHALLENGE', level: 'info', userId: user.id, userEmail: email });
      return res.json({ mfaRequired: true, mfaToken, user: { email: user.email, role: user.role } });
    }

    loginGuard.reset(email, ip);
    const token = signAccessToken(user);
    setAuthCookie(res, token, user);

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    }).catch(() => {});

    await logSecurityEvent(req, { action: 'AUTH_LOGIN_SUCCESS', level: 'info', userId: user.id, userEmail: email });
    res.json(await buildLoginPayload(user, token));
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

    if (!validatePassword(password)) {
      return res.status(400).json({ error: 'Password must be at least 12 characters long and contain at least one uppercase letter, one lowercase letter, one digit, and one special character.' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Hash password with bcrypt (10 salt rounds)
    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const validRoles = [
      'SUPER_ADMIN',
      'ADMIN',
      'HR',
      'MANAGER',
      'EMPLOYEE',
      'RECRUITER',
      'ONBOARDING',
      'ACCOUNTS',
      'FINANCE',
      'PAYROLL_REVIEWER',
      'PAYROLL_APPROVER',
      'SALES',
    ];
    const userRole = role || 'EMPLOYEE';

    if (!validRoles.includes(userRole)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

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

    const token = signAccessToken(user);
    setAuthCookie(res, token);

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
    // Support users are company-less, but their reads are scoped to the tenant
    // they're viewing — so look up their OWN row without tenant scoping.
    const selfWhere = req.user.role === 'SUPPORT'
      ? { id: req.user.id, companyId: null }
      : { id: req.user.id };
    const user = await prisma.user.findFirst({
      where: selfWhere,
      include: { permissions: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const permissions = user.permissions.length > 0
      ? user.permissions
      : getDefaultPermissions(user.role);

    // Find linked employee record
    const employee = await prisma.employee.findFirst({ where: { userId: user.id } });

    // The effective company is the tenant under the request context: the support
    // user's currently-viewed customer, or a normal user's own company.
    const effectiveCompanyId = req.user.companyId;

    let subscriptionFeatures = null;
    if (effectiveCompanyId && user.role !== 'SUPER_ADMIN') {
      const activeSub = await prisma.subscription.findFirst({
        where: { companyId: effectiveCompanyId, status: 'ACTIVE' },
        include: { plan: true },
        orderBy: { endDate: 'desc' }
      });
      if (activeSub?.plan?.featureLimits) {
        try {
          subscriptionFeatures = JSON.parse(activeSub.plan.featureLimits);
        } catch (e) {}
      }
    }

    let companyName = null;
    let companyLogo = null;
    let companyKycStatus = null;
    let companyKycRemarks = null;
    let companyCin = null;
    let companySubdomain = null;
    let hasUsedFreeTrial = false;
    let freeTrialExpiresAt = null;
    let billingStatus = null;
    let graceEndsAt = null;

    if (effectiveCompanyId) {
      const company = await prisma.company.findUnique({
        where: { id: effectiveCompanyId }
      });
      if (company) {
        companyName = company.name;
        companyLogo = company.logoUrl;
        companyKycStatus = company.kycStatus;
        companyKycRemarks = company.kycRemarks;
        companyCin = company.cin;
        companySubdomain = company.subdomain || company.code;
        hasUsedFreeTrial = company.hasUsedFreeTrial;
        freeTrialExpiresAt = company.freeTrialExpiresAt;
        billingStatus = company.billingStatus;
        graceEndsAt = company.graceEndsAt;
      }
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      mfaEnabled: user.mfaEnabled,
      mustChangePassword: user.mustChangePassword || false,
      mustSetupMfa: requirePlatformMfa(user.role, user.mfaEnabled),
      employeeId: employee?.id || null,
      permissions,
      subscriptionFeatures,
      companyName,
      companyLogo,
      companyKycStatus,
      companyKycRemarks,
      companyCin,
      companySubdomain,
      hasUsedFreeTrial,
      freeTrialExpiresAt,
      billingStatus,
      graceEndsAt,
      supportViewCompanyId: req.user.supportViewCompanyId || null,
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

    if (!validatePassword(newPassword)) {
      return res.status(400).json({ error: 'Password must be at least 12 characters long and contain at least one uppercase letter, one lowercase letter, one digit, and one special character.' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        password: hashedPassword,
        mfaLastVerifiedAt: null,
        mustChangePassword: false,
        tokenVersion: { increment: 1 }, // revoke all existing sessions
      },
    });

    // Re-issue a token for the current session so the user stays logged in here
    // while every other previously-issued token is invalidated.
    const token = signAccessToken(updated);
    setAuthCookie(res, token, updated);
    res.json({ message: 'Password changed successfully', token });
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

    // Defense-in-depth authorization check
    if (req.user?.role !== 'SUPER_ADMIN' && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied. Only administrators can reset passwords.' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Generate a secure temporary password if none provided
    const tempPassword = newPassword || generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);

    // Force the user to set their own password on next login, unless an admin
    // explicitly supplied a final password.
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        mfaLastVerifiedAt: null,
        mustChangePassword: !newPassword,
        tokenVersion: { increment: 1 }, // revoke the target user's existing sessions
      },
    });

    res.json({ message: 'Password reset successfully', temporaryPassword: tempPassword });
  } catch (error) {
    console.error('[RESET PASSWORD ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const setupMfa = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const secret = generateBase32Secret();
    await prisma.user.update({
      where: { id: user.id },
      data: { mfaSecret: secret },
    });

    res.json({
      secret,
      otpauthUrl: buildOtpAuthUrl({ email: user.email, secret }),
      mfaEnabled: false,
    });
  } catch (error) {
    console.error('[MFA SETUP ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const enableMfa = async (req, res) => {
  try {
    const { code } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.mfaSecret) return res.status(400).json({ error: 'MFA setup has not been initialized' });
    if (!verifyTotp(user.mfaSecret, code)) {
      return res.status(400).json({ error: 'Invalid MFA verification code' });
    }

    const recoveryCodes = generateRecoveryCodes();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        mfaEnabled: true,
        mfaRecoveryCodes: JSON.stringify(recoveryCodes.map(hashRecoveryCode)),
        mfaLastVerifiedAt: new Date(),
      },
    });

    res.json({ message: 'MFA enabled successfully', recoveryCodes });
  } catch (error) {
    console.error('[MFA ENABLE ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const disableMfa = async (req, res) => {
  try {
    const { currentPassword, code } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const passwordOk = currentPassword && await bcrypt.compare(currentPassword, user.password);
    const codeOk = user.mfaSecret && verifyTotp(user.mfaSecret, code);
    if (!passwordOk && !codeOk) {
      return res.status(400).json({ error: 'Current password or valid MFA code is required to disable MFA' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaRecoveryCodes: null,
        mfaLastVerifiedAt: null,
      },
    });

    res.json({ message: 'MFA disabled successfully' });
  } catch (error) {
    console.error('[MFA DISABLE ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const verifyMfaLogin = async (req, res) => {
  try {
    const { mfaToken, code, recoveryCode } = req.body;
    if (!mfaToken || (!code && !recoveryCode)) {
      return res.status(400).json({ error: 'MFA token and verification code are required' });
    }

    const decoded = jwt.verify(mfaToken, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (decoded.purpose !== 'MFA') {
      return res.status(400).json({ error: 'Invalid MFA challenge token' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { permissions: true },
    });
    if (!user || !user.isActive || !user.mfaEnabled || !user.mfaSecret) {
      return res.status(401).json({ error: 'Invalid MFA challenge' });
    }

    let verified = verifyTotp(user.mfaSecret, code);
    if (!verified && recoveryCode && user.mfaRecoveryCodes) {
      const hash = hashRecoveryCode(recoveryCode);
      const stored = JSON.parse(user.mfaRecoveryCodes);
      const nextCodes = stored.filter((item) => item !== hash);
      verified = nextCodes.length !== stored.length;
      if (verified) {
        await prisma.user.update({
          where: { id: user.id },
          data: { mfaRecoveryCodes: JSON.stringify(nextCodes), mfaLastVerifiedAt: new Date() },
        });
      }
    }

    if (!verified) return res.status(401).json({ error: 'Invalid MFA verification code' });

    if (!recoveryCode) {
      await prisma.user.update({ where: { id: user.id }, data: { mfaLastVerifiedAt: new Date() } });
    }

    const token = signAccessToken(user);
    setAuthCookie(res, token, user);

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    }).catch(() => {});

    res.json(await buildLoginPayload(user, token));
  } catch (error) {
    console.error('[MFA VERIFY ERROR]:', error.message);
    res.status(401).json({ error: 'Invalid or expired MFA challenge' });
  }
};

const signup = async (req, res) => {
  try {
    const { companyName, companyCode, email, password, name, phone, companySize, industry, planId, cin, demoCallDate } = req.body;

    if (!companyName || !companyCode || !email || !password || !name) {
      return res.status(400).json({ error: 'Company Name, Company Code, Admin Email, Password, and Admin Name are required.' });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({ error: 'Password must be at least 12 characters long and contain at least one uppercase letter, one lowercase letter, one digit, and one special character.' });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Admin email already exists' });
    }

    // Check if company code already exists
    const existingCompany = await prisma.company.findUnique({ where: { code: companyCode } });
    if (existingCompany) {
      return res.status(400).json({ error: 'Company code already registered' });
    }

    // Create Company and Admin User in a Prisma Transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Company with KYC fields
      const company = await tx.company.create({
        data: {
          name: companyName,
          code: companyCode.toLowerCase(),
          // Workspace subdomain defaults to the chosen tenant code.
          subdomain: slugifySubdomain(companyCode),
          email,
          phone,
          companySize,
          industry,
          status: 'ACTIVE',
          cin: cin || null,
          gstin: req.body.gstin || null,
          directorName: req.body.directorName || null,
          directorPan: req.body.directorPan || null,
          directorDin: req.body.directorDin || null,
          signingAuthorityName: req.body.signingAuthorityName || null,
          signingAuthorityEmail: req.body.signingAuthorityEmail || null,
          signingAuthorityPhone: req.body.signingAuthorityPhone || null,
          contactPersonName: req.body.contactPersonName || null,
          contactPersonEmail: req.body.contactPersonEmail || null,
          contactPersonPhone: req.body.contactPersonPhone || null,
          kycStatus: 'PENDING',
          demoCallScheduledAt: demoCallDate ? new Date(demoCallDate) : null,
        }
      });

      // 2. Create hashed password
      const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

      // 3. Create Admin User
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role: 'ADMIN',
          companyId: company.id,
          permissions: {
            create: getDefaultPermissions('ADMIN')
          }
        }
      });

      return { company, user };
    });

    const token = signAccessToken(result.user);
    setAuthCookie(res, token, result.user);

    // Update lastLoginAt
    await prisma.user.update({
      where: { id: result.user.id },
      data: { lastLoginAt: new Date() }
    }).catch(() => {});

    res.status(201).json(await buildLoginPayload(result.user, token));
  } catch (error) {
    console.error('[SIGNUP ERROR]:', error.message);
    res.status(500).json({ error: 'Failed to complete registration and onboarding.' });
  }
};

/**
 * Log out: revoke all of the user's outstanding tokens (bump tokenVersion) and
 * clear auth cookies. Authenticated via the access token.
 */
const logout = async (req, res) => {
  try {
    if (req.user?.id) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: { tokenVersion: { increment: 1 } },
      }).catch(() => {});
    }
    res.clearCookie('token', { domain: COOKIE_DOMAIN });
    res.clearCookie('csrfToken', { domain: COOKIE_DOMAIN });
    res.clearCookie('refreshToken', { domain: COOKIE_DOMAIN, path: REFRESH_COOKIE_PATH });
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('[LOGOUT ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Exchange a valid refresh token (httpOnly cookie or body) for a new access
 * token. The refresh token is invalidated by tokenVersion (logout / password
 * change / admin reset), giving server-side revocation.
 */
const refresh = async (req, res) => {
  try {
    const refreshToken = (req.cookies && req.cookies.refreshToken) || req.body?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token provided' });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    } catch (e) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
    if (decoded.purpose !== 'REFRESH') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || !user.isActive || (decoded.tv ?? 0) !== (user.tokenVersion ?? 0)) {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }

    const token = signAccessToken(user);
    setAuthCookie(res, token, user); // also slides the refresh cookie forward
    res.json({ token });
  } catch (error) {
    console.error('[REFRESH ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Issue a fresh CSRF token (sets the readable csrfToken cookie and returns it).
 * Lets a cookie-mode client obtain a token to echo in the x-csrf-token header.
 */
const getCsrfToken = async (req, res) => {
  const token = generateCsrfToken();
  setCsrfCookie(res, token);
  res.json({ csrfToken: token });
};

module.exports = {
  login,
  register,
  signup,
  getProfile,
  changePassword,
  resetPasswordForUser,
  setupMfa,
  enableMfa,
  disableMfa,
  verifyMfaLogin,
  getCsrfToken,
  logout,
  refresh,
};
