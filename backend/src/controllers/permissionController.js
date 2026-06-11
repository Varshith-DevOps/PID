/**
 * @fileoverview Permission management controller.
 * Manages role-based and user-level RBAC permissions.
 * Provides defaults per role and allows granular overrides.
 * @module controllers/permissionController
 */

const prisma = require('../config/database');
const fs = require('fs');
const path = require('path');
const OVERRIDES_FILE = path.join(__dirname, '../config/rolePermissions.json');
const CUSTOM_MODULES_FILE = path.join(__dirname, '../config/customModules.json');

const MODULES = [
  'USERS',
  'EMPLOYEES',
  'ATTENDANCE',
  'LEAVE',
  'PAYROLL',
  'COMPLIANCE',
  'REPORTS',
  'SETTINGS',
  'RECRUITMENT',
  'ONBOARDING',
  'ACCOUNTS',
  'EXPENSES',
  'PERFORMANCE',
  'PROJECTS',
  'ASSETS',
  'LEARNING',
  'HELPDESK',
  'WORKFLOWS',
  'NOTIFICATIONS'
];

const getModulesList = () => {
  try {
    if (fs.existsSync(CUSTOM_MODULES_FILE)) {
      const custom = JSON.parse(fs.readFileSync(CUSTOM_MODULES_FILE, 'utf8'));
      if (Array.isArray(custom)) {
        return [...new Set([...MODULES, ...custom])];
      }
    }
  } catch (err) {
    console.error('Failed to read custom modules:', err.message);
  }
  return MODULES;
};

const ACTIONS = ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'EXPORT'];
const ACCESS_ROLES = [
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
  'PAYROLL_APPROVER'
];

const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  HR: 'HR Admin',
  MANAGER: 'Manager',
  EMPLOYEE: 'Employee',
  RECRUITER: 'Recruiter',
  ONBOARDING: 'Onboarding Specialist',
  ACCOUNTS: 'Accounts Officer',
  FINANCE: 'Finance Officer',
  PAYROLL_REVIEWER: 'Payroll Reviewer',
  PAYROLL_APPROVER: 'Payroll Approver',
};

const getDefaultPermissions = (role) => {
  try {
    if (fs.existsSync(OVERRIDES_FILE)) {
      const data = JSON.parse(fs.readFileSync(OVERRIDES_FILE, 'utf8'));
      if (data[role]) {
        return data[role];
      }
    }
  } catch (error) {
    console.error('Error reading role permissions overrides:', error.message);
  }

  const defaults = {
    SUPER_ADMIN: getModulesList().flatMap((m) => ACTIONS.map((a) => ({ module: m, action: a, isGranted: true }))),
    ADMIN: getModulesList().flatMap((m) => [
      { module: m, action: 'VIEW', isGranted: true },
      { module: m, action: 'CREATE', isGranted: true },
      { module: m, action: 'EDIT', isGranted: true },
      { module: m, action: 'DELETE', isGranted: false },
      { module: m, action: 'EXPORT', isGranted: true },
    ]),
    MANAGER: [
      { module: 'EMPLOYEES', action: 'VIEW', isGranted: true },
      { module: 'ATTENDANCE', action: 'VIEW', isGranted: true },
      { module: 'ATTENDANCE', action: 'EDIT', isGranted: true },
      { module: 'LEAVE', action: 'VIEW', isGranted: true },
      { module: 'LEAVE', action: 'CREATE', isGranted: true },
      { module: 'LEAVE', action: 'EDIT', isGranted: true },
      { module: 'REPORTS', action: 'VIEW', isGranted: true },
      { module: 'REPORTS', action: 'EXPORT', isGranted: true },
      { module: 'PROJECTS', action: 'VIEW', isGranted: true },
      { module: 'PROJECTS', action: 'CREATE', isGranted: true },
      { module: 'PROJECTS', action: 'EDIT', isGranted: true },
      { module: 'EXPENSES', action: 'VIEW', isGranted: true },
      { module: 'EXPENSES', action: 'EDIT', isGranted: true },
      { module: 'PERFORMANCE', action: 'VIEW', isGranted: true },
      { module: 'PERFORMANCE', action: 'EDIT', isGranted: true },
      { module: 'ASSETS', action: 'VIEW', isGranted: true },
      { module: 'LEARNING', action: 'VIEW', isGranted: true },
      { module: 'LEARNING', action: 'CREATE', isGranted: true },
      { module: 'LEARNING', action: 'EDIT', isGranted: true },
      { module: 'HELPDESK', action: 'VIEW', isGranted: true },
      { module: 'HELPDESK', action: 'CREATE', isGranted: true },
      { module: 'HELPDESK', action: 'EDIT', isGranted: true },
      { module: 'NOTIFICATIONS', action: 'VIEW', isGranted: true },
      { module: 'NOTIFICATIONS', action: 'EDIT', isGranted: true },
      ],
    EMPLOYEE: [
      { module: 'EMPLOYEES', action: 'VIEW', isGranted: false },
      { module: 'ATTENDANCE', action: 'VIEW', isGranted: true },
      { module: 'ATTENDANCE', action: 'CREATE', isGranted: true },
      { module: 'LEAVE', action: 'VIEW', isGranted: true },
      { module: 'LEAVE', action: 'CREATE', isGranted: true },
      { module: 'PAYROLL', action: 'VIEW', isGranted: true },
      { module: 'COMPLIANCE', action: 'VIEW', isGranted: true },
      { module: 'REPORTS', action: 'VIEW', isGranted: true },
      { module: 'EXPENSES', action: 'VIEW', isGranted: true },
      { module: 'EXPENSES', action: 'CREATE', isGranted: true },
      { module: 'PERFORMANCE', action: 'VIEW', isGranted: true },
      { module: 'PERFORMANCE', action: 'CREATE', isGranted: true },
      { module: 'PERFORMANCE', action: 'EDIT', isGranted: true },
      { module: 'ASSETS', action: 'VIEW', isGranted: true },
      { module: 'LEARNING', action: 'VIEW', isGranted: true },
      { module: 'LEARNING', action: 'EDIT', isGranted: true },
      { module: 'HELPDESK', action: 'VIEW', isGranted: true },
      { module: 'HELPDESK', action: 'CREATE', isGranted: true },
      { module: 'HELPDESK', action: 'EDIT', isGranted: true },
      { module: 'NOTIFICATIONS', action: 'VIEW', isGranted: true },
      { module: 'NOTIFICATIONS', action: 'EDIT', isGranted: true },
      { module: 'ACCOUNTS', action: 'VIEW', isGranted: true },
      { module: 'ACCOUNTS', action: 'CREATE', isGranted: true },
    ],
    RECRUITER: [
      { module: 'RECRUITMENT', action: 'VIEW', isGranted: true },
      { module: 'RECRUITMENT', action: 'CREATE', isGranted: true },
      { module: 'RECRUITMENT', action: 'EDIT', isGranted: true },
      { module: 'RECRUITMENT', action: 'DELETE', isGranted: true },
      { module: 'RECRUITMENT', action: 'EXPORT', isGranted: true },
      { module: 'EMPLOYEES', action: 'VIEW', isGranted: true },
      { module: 'PROJECTS', action: 'VIEW', isGranted: true },
    ],
    ONBOARDING: [
      { module: 'ONBOARDING', action: 'VIEW', isGranted: true },
      { module: 'ONBOARDING', action: 'CREATE', isGranted: true },
      { module: 'ONBOARDING', action: 'EDIT', isGranted: true },
      { module: 'ONBOARDING', action: 'DELETE', isGranted: true },
      { module: 'ONBOARDING', action: 'EXPORT', isGranted: true },
      { module: 'EMPLOYEES', action: 'VIEW', isGranted: true },
      { module: 'EMPLOYEES', action: 'CREATE', isGranted: true },
      { module: 'EMPLOYEES', action: 'EDIT', isGranted: true },
    ],
    ACCOUNTS: [
      { module: 'ACCOUNTS', action: 'VIEW', isGranted: true },
      { module: 'ACCOUNTS', action: 'CREATE', isGranted: true },
      { module: 'ACCOUNTS', action: 'EDIT', isGranted: true },
      { module: 'ACCOUNTS', action: 'DELETE', isGranted: true },
      { module: 'ACCOUNTS', action: 'EXPORT', isGranted: true },
      { module: 'PAYROLL', action: 'VIEW', isGranted: true },
      { module: 'PAYROLL', action: 'CREATE', isGranted: true },
      { module: 'PAYROLL', action: 'EDIT', isGranted: true },
      { module: 'PAYROLL', action: 'EXPORT', isGranted: true },
      { module: 'REPORTS', action: 'VIEW', isGranted: true },
      { module: 'REPORTS', action: 'EXPORT', isGranted: true },
      { module: 'EMPLOYEES', action: 'VIEW', isGranted: true },
      { module: 'ATTENDANCE', action: 'VIEW', isGranted: true },
    ],
    HR: [
      'EMPLOYEES',
      'ATTENDANCE',
      'LEAVE',
      'RECRUITMENT',
      'ONBOARDING',
      'PERFORMANCE',
      'COMPLIANCE',
      'REPORTS',
      'HELPDESK',
      'ASSETS',
      'LEARNING',
      'WORKFLOWS',
      'NOTIFICATIONS'
    ].flatMap((m) => [
      { module: m, action: 'VIEW', isGranted: true },
      { module: m, action: 'CREATE', isGranted: true },
      { module: m, action: 'EDIT', isGranted: true },
      { module: m, action: 'DELETE', isGranted: false },
      { module: m, action: 'EXPORT', isGranted: true },
    ]),
    FINANCE: [
      'PAYROLL',
      'COMPLIANCE',
      'EXPENSES',
      'ACCOUNTS',
      'REPORTS',
      'EMPLOYEES'
    ].flatMap((m) => [
      { module: m, action: 'VIEW', isGranted: true },
      { module: m, action: 'CREATE', isGranted: m !== 'EMPLOYEES' },
      { module: m, action: 'EDIT', isGranted: m !== 'EMPLOYEES' },
      { module: m, action: 'DELETE', isGranted: false },
      { module: m, action: 'EXPORT', isGranted: true },
    ]),
    PAYROLL_REVIEWER: [
      { module: 'PAYROLL', action: 'VIEW', isGranted: true },
      { module: 'PAYROLL', action: 'EDIT', isGranted: true },
      { module: 'PAYROLL', action: 'EXPORT', isGranted: true },
      { module: 'COMPLIANCE', action: 'VIEW', isGranted: true },
      { module: 'REPORTS', action: 'VIEW', isGranted: true },
      { module: 'REPORTS', action: 'EXPORT', isGranted: true },
    ],
    PAYROLL_APPROVER: [
      { module: 'PAYROLL', action: 'VIEW', isGranted: true },
      { module: 'PAYROLL', action: 'EDIT', isGranted: true },
      { module: 'PAYROLL', action: 'EXPORT', isGranted: true },
      { module: 'COMPLIANCE', action: 'VIEW', isGranted: true },
      { module: 'COMPLIANCE', action: 'EXPORT', isGranted: true },
      { module: 'REPORTS', action: 'VIEW', isGranted: true },
      { module: 'REPORTS', action: 'EXPORT', isGranted: true },
    ],
  };
  return defaults[role] || [];
};

const getUserPermissions = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    if (req.user.role === 'SUPER_ADMIN' || currentUserId === userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { permissions: true },
      });
      if (!user) return res.status(404).json({ error: 'User not found' });
      return res.json({ permissions: user.permissions, role: user.role });
    }
    return res.status(403).json({ error: 'Access denied' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const getAllPermissions = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, permissions: true },
    });
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const buildRolePermission = async (role) => {
  const user = await prisma.user.findFirst({
    where: { role },
    include: { permissions: true },
    orderBy: { createdAt: 'asc' },
  });

  const permissions = user?.permissions?.length ? user.permissions : getDefaultPermissions(role);
  return {
    id: role,
    role,
    name: ROLE_LABELS[role] || role,
    permissions,
  };
};

const getRolePermissions = async (req, res) => {
  try {
    const roles = await Promise.all(ACCESS_ROLES.map(buildRolePermission));
    res.json({ roles, modules: getModulesList(), actions: ACTIONS });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const updateRolePermissions = async (req, res) => {
  try {
    const { role } = req.params;
    const { permissions } = req.body;

    if (!ACCESS_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only Super Admin can modify role permissions' });
    }
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: 'Permissions must be an array' });
    }

    // Save to local overrides JSON
    try {
      let overrides = {};
      if (fs.existsSync(OVERRIDES_FILE)) {
        overrides = JSON.parse(fs.readFileSync(OVERRIDES_FILE, 'utf8'));
      }
      overrides[role] = permissions.map((p) => ({
        module: p.module,
        action: p.action,
        isGranted: p.isGranted,
      }));

      const dir = path.dirname(OVERRIDES_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(OVERRIDES_FILE, JSON.stringify(overrides, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to write role permissions overrides:', err.message);
    }

    const users = await prisma.user.findMany({
      where: { role },
      select: { id: true },
    });
    const userIds = users.map((user) => user.id);

    if (userIds.length > 0) {
      await prisma.permission.deleteMany({ where: { userId: { in: userIds } } });

      const permissionData = userIds.flatMap((userId) =>
        permissions.map((p) => ({
          module: p.module,
          action: p.action,
          isGranted: p.isGranted,
          userId,
        }))
      );

      if (permissionData.length > 0) {
        await prisma.permission.createMany({ data: permissionData });
      }
    }

    const rolePermissions = await buildRolePermission(role);
    res.json({ role: rolePermissions });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const updateUserPermissions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { permissions } = req.body;

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only Super Admin can modify user permissions' });
    }

    await prisma.permission.deleteMany({ where: { userId } });

    const permissionData = permissions.map((p) => ({
      module: p.module,
      action: p.action,
      isGranted: p.isGranted,
      userId,
    }));

    await prisma.permission.createMany({ data: permissionData });

    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { permissions: true },
    });

    res.json({ permissions: updatedUser.permissions });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const resetToDefault = async (req, res) => {
  try {
    const { userId } = req.params;

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    if (req.user.role === 'SUPER_ADMIN') {
      const defaults = getDefaultPermissions(targetUser.role);
      await prisma.permission.deleteMany({ where: { userId } });
      await prisma.permission.createMany({ data: defaults.map((p) => ({ ...p, userId })) });

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { permissions: true },
      });
      return res.json({ permissions: user.permissions });
    }

    return res.status(403).json({ error: 'Only Super Admin can reset permissions' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const resetRoleToDefault = async (req, res) => {
  try {
    const { role } = req.params;

    if (!ACCESS_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only Super Admin can reset permissions' });
    }

    // Delete override from local overrides JSON if it exists
    try {
      if (fs.existsSync(OVERRIDES_FILE)) {
        const overrides = JSON.parse(fs.readFileSync(OVERRIDES_FILE, 'utf8'));
        if (overrides[role]) {
          delete overrides[role];
          fs.writeFileSync(OVERRIDES_FILE, JSON.stringify(overrides, null, 2), 'utf8');
        }
      }
    } catch (err) {
      console.error('Failed to update overrides file during reset:', err.message);
    }

    const users = await prisma.user.findMany({
      where: { role },
      select: { id: true },
    });
    const userIds = users.map((user) => user.id);
    const defaults = getDefaultPermissions(role);

    if (userIds.length > 0) {
      await prisma.permission.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.permission.createMany({
        data: userIds.flatMap((userId) => defaults.map((p) => ({ ...p, userId }))),
      });
    }

    const rolePermissions = await buildRolePermission(role);
    return res.json({ role: rolePermissions });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const addCustomModule = async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only Super Admin can add custom modules' });
    }
    const { module: newModule } = req.body;
    if (!newModule || typeof newModule !== 'string') {
      return res.status(400).json({ error: 'Module name is required' });
    }
    const sanitizedModule = newModule.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
    if (!sanitizedModule) {
      return res.status(400).json({ error: 'Invalid module name' });
    }

    const currentModules = getModulesList();
    if (currentModules.includes(sanitizedModule)) {
      return res.status(400).json({ error: 'Module already exists' });
    }

    // Save to customModules.json
    try {
      let custom = [];
      if (fs.existsSync(CUSTOM_MODULES_FILE)) {
        custom = JSON.parse(fs.readFileSync(CUSTOM_MODULES_FILE, 'utf8'));
      }
      if (!custom.includes(sanitizedModule)) {
        custom.push(sanitizedModule);
        const dir = path.dirname(CUSTOM_MODULES_FILE);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(CUSTOM_MODULES_FILE, JSON.stringify(custom, null, 2), 'utf8');
      }
    } catch (err) {
      console.error('Failed to save custom module:', err.message);
      return res.status(500).json({ error: 'Failed to persist module' });
    }

    res.json({ success: true, module: sanitizedModule, modules: getModulesList() });
  } catch (error) {
    console.error('[ADD DYNAMIC MODULE ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getUserPermissions,
  getAllPermissions,
  getRolePermissions,
  updateRolePermissions,
  updateUserPermissions,
  resetToDefault,
  resetRoleToDefault,
  getDefaultPermissions,
  addCustomModule,
  MODULES,
  ACTIONS,
  ACCESS_ROLES,
};
