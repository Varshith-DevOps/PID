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
  'INTEGRATIONS',
  'ORGANIZATION',
  'WORKFLOWS',
  'NOTIFICATIONS'
];

// Base (built-in) module list. Role DEFAULT permissions are computed from these
// only — tenant custom modules are deny-by-default and granted explicitly.
const getModulesList = () => MODULES;

// The full module catalogue FOR THE CALLER'S TENANT: built-ins + that company's
// custom modules. Used by the access-control matrices (tenant-scoped via the
// Prisma extension, so a tenant only ever sees its own custom modules).
const getCompanyModules = async () => {
  try {
    const custom = await prisma.customModule.findMany({
      where: { isActive: true },
      select: { key: true },
      orderBy: { createdAt: 'asc' },
    });
    return [...new Set([...MODULES, ...custom.map((c) => c.key)])];
  } catch (err) {
    console.error('Failed to read custom modules:', err.message);
    return MODULES;
  }
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
  'PAYROLL_APPROVER',
  'SALES'
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
  SALES: 'Sales Representative',
  PLATFORM_ADMIN: 'Platform Admin',
  COMPLIANCE: 'Compliance Officer',
  BILLING: 'Billing Officer',
  AUDITOR: 'Auditor',
  SUPPORT: 'Support Engineer'
};

// Plain-language definition of what each role is for (shown in the access UI).
const ROLE_DESCRIPTIONS = {
  ADMIN: 'Full tenant administration — manage employees, payroll, settings, and user access for the whole organization.',
  HR: 'People operations — employee records, attendance, leave, onboarding, and recruitment.',
  MANAGER: 'Team lead — view their team, approve leave/attendance, and manage tasks and projects.',
  FINANCE: 'Finance — payroll, expenses, statutory compliance, and reports.',
  ACCOUNTS: 'Accounts — payroll processing and statutory bookkeeping.',
  RECRUITER: 'Recruitment — job openings, candidates, and interviews.',
  ONBOARDING: 'Onboarding — new-joiner checklists and workspace setup.',
  PAYROLL_REVIEWER: 'Reviews payroll runs and statutory inputs before approval.',
  PAYROLL_APPROVER: 'Approves payroll runs and releases salary.',
  EMPLOYEE: 'Self-service — own attendance, leave, payslips, expenses, and profile.',
  SUPER_ADMIN: 'Platform owner — unrestricted access across all tenants.',
  SALES: 'Platform sales — leads, pipeline, trials, and plan proposals.',
  PLATFORM_ADMIN: 'Platform operations — tenant lifecycle, provisioning, and staff (no billing/KYC sign-off).',
  COMPLIANCE: 'Compliance — KYC review/approval and data governance.',
  BILLING: 'Billing — subscriptions, payments, dunning, and plans.',
  AUDITOR: 'Read-only oversight — metrics and the platform audit log.',
  SUPPORT: 'Read-only customer support access for troubleshooting.',
};

// Roles a tenant ADMIN is allowed to assign to users within their organization.
// Platform roles (SUPER_ADMIN, SALES, SUPPORT) are never assignable by a tenant.
const TENANT_ASSIGNABLE_ROLES = [
  'ADMIN', 'HR', 'MANAGER', 'FINANCE', 'ACCOUNTS',
  'RECRUITER', 'ONBOARDING', 'PAYROLL_REVIEWER', 'PAYROLL_APPROVER', 'EMPLOYEE',
];
const PLATFORM_ROLES = ['SUPER_ADMIN', 'SALES', 'SUPPORT'];

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
    // Platform support/maintenance staff: read-only visibility (VIEW + EXPORT) into
    // an assigned customer tenant. Never CREATE/EDIT/DELETE (also enforced server-side).
    SUPPORT: getModulesList().flatMap((m) => [
      { module: m, action: 'VIEW', isGranted: true },
      { module: m, action: 'EXPORT', isGranted: true },
    ]),
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
      { module: 'WORKFLOWS', action: 'VIEW', isGranted: true },
      { module: 'WORKFLOWS', action: 'EDIT', isGranted: true },
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
      { module: 'PROJECTS', action: 'VIEW', isGranted: true },
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
      'INTEGRATIONS',
      'ORGANIZATION',
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
      'EMPLOYEES',
      'INTEGRATIONS',
      'WORKFLOWS'
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
    SALES: [],
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
    // Tenant-scoped (User queries are confined to the caller's company). Platform
    // accounts are excluded so a tenant admin only manages their own organization.
    const users = await prisma.user.findMany({
      where: { role: { notIn: PLATFORM_ROLES } },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        permissions: { select: { module: true, action: true, isGranted: true } },
        employee: { select: { jobTitle: true, employeeId: true, department: { select: { name: true } } } },
      },
      orderBy: { name: 'asc' },
    });
    res.json({
      users,
      modules: await getCompanyModules(),
      actions: ACTIONS,
      assignableRoles: TENANT_ASSIGNABLE_ROLES.map((r) => ({
        role: r,
        name: ROLE_LABELS[r] || r,
        description: ROLE_DESCRIPTIONS[r] || '',
      })),
    });
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
    description: ROLE_DESCRIPTIONS[role] || '',
    permissions,
  };
};

const getRolePermissions = async (req, res) => {
  try {
    const roles = await Promise.all(ACCESS_ROLES.map(buildRolePermission));
    res.json({ roles, modules: await getCompanyModules(), actions: ACTIONS });
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

    // Tenant-scoped: a tenant ADMIN can only see/touch users in their own company
    // (User queries are scoped by the request's company context). Super admin is global.
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    // A tenant admin can never edit platform-managed accounts.
    if (req.user.role !== 'SUPER_ADMIN' && PLATFORM_ROLES.includes(targetUser.role)) {
      return res.status(403).json({ error: 'This account is managed by the platform owner.' });
    }
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: 'Permissions must be an array' });
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

    if (req.user.role !== 'SUPER_ADMIN' && PLATFORM_ROLES.includes(targetUser.role)) {
      return res.status(403).json({ error: 'This account is managed by the platform owner.' });
    }

    const defaults = getDefaultPermissions(targetUser.role);
    await prisma.permission.deleteMany({ where: { userId } });
    if (defaults.length) {
      await prisma.permission.createMany({ data: defaults.map((p) => ({ ...p, userId })) });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { permissions: true },
    });
    return res.json({ permissions: user.permissions });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Change a user's role within the caller's tenant. Tenant admins manage their own
 * organization's access; platform accounts are off-limits. Clears any per-user
 * permission overrides (the new role's defaults apply) and invalidates the target's
 * sessions so the change takes effect immediately.
 * PUT /api/permissions/user/:userId/role
 */
const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!TENANT_ASSIGNABLE_ROLES.includes(role)) {
      return res.status(400).json({ error: 'That role cannot be assigned.' });
    }
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'You cannot change your own role.' });
    }

    // Tenant-scoped lookup — a cross-tenant userId resolves to null for an ADMIN.
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });
    if (PLATFORM_ROLES.includes(targetUser.role)) {
      return res.status(403).json({ error: 'This account is managed by the platform owner.' });
    }

    await prisma.permission.deleteMany({ where: { userId } });
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role, tokenVersion: { increment: 1 } },
      select: { id: true, role: true, name: true, email: true },
    });

    res.json({ message: `${updated.name} is now ${ROLE_LABELS[role] || role}.`, user: updated });
  } catch (error) {
    console.error('[UPDATE USER ROLE ERROR]:', error.message);
    res.status(500).json({ error: 'Failed to update role' });
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

/**
 * Create a custom access module FOR THE CALLER'S TENANT. Tenant-scoped: a tenant
 * ADMIN defines modules that only their organization can see and grant.
 * POST /api/permissions/modules  { module, description? }
 */
const addCustomModule = async (req, res) => {
  try {
    const { module: newModule, description } = req.body;
    if (!newModule || typeof newModule !== 'string') {
      return res.status(400).json({ error: 'Module name is required' });
    }
    const key = newModule.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    if (!key || key.length < 2) {
      return res.status(400).json({ error: 'Invalid module name. Use letters, digits, and underscores.' });
    }
    if (MODULES.includes(key)) {
      return res.status(409).json({ error: 'That is a built-in module name. Choose a different name.' });
    }

    // The Prisma extension auto-populates companyId from the tenant context and
    // scopes the uniqueness check to this company.
    const existing = await prisma.customModule.findFirst({ where: { key } });
    if (existing) {
      return res.status(409).json({ error: 'A module with that name already exists for your organization.' });
    }

    const created = await prisma.customModule.create({
      data: { key, label: newModule.trim(), description: description || null },
    });

    res.status(201).json({ success: true, module: { key: created.key, label: created.label, description: created.description }, modules: await getCompanyModules() });
  } catch (error) {
    console.error('[ADD CUSTOM MODULE ERROR]:', error.message);
    res.status(500).json({ error: 'Failed to create custom module' });
  }
};

/** GET /api/permissions/modules — the caller tenant's custom modules. */
const listCustomModules = async (req, res) => {
  try {
    const custom = await prisma.customModule.findMany({
      where: { isActive: true },
      select: { id: true, key: true, label: true, description: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ custom, builtIn: MODULES });
  } catch (error) {
    console.error('[LIST CUSTOM MODULES ERROR]:', error.message);
    res.status(500).json({ error: 'Failed to load custom modules' });
  }
};

/** DELETE /api/permissions/modules/:key — remove a tenant custom module + its grants. */
const deleteCustomModule = async (req, res) => {
  try {
    const key = String(req.params.key || '').toUpperCase();
    const mod = await prisma.customModule.findFirst({ where: { key } });
    if (!mod) return res.status(404).json({ error: 'Custom module not found.' });

    await prisma.customModule.delete({ where: { id: mod.id } });
    // Clean up any permission grants that referenced this module within the tenant.
    await prisma.permission.deleteMany({ where: { module: key, user: { companyId: req.user.companyId } } });

    res.json({ success: true, modules: await getCompanyModules() });
  } catch (error) {
    console.error('[DELETE CUSTOM MODULE ERROR]:', error.message);
    res.status(500).json({ error: 'Failed to delete custom module' });
  }
};

module.exports = {
  getUserPermissions,
  getAllPermissions,
  getRolePermissions,
  updateRolePermissions,
  updateUserPermissions,
  updateUserRole,
  resetToDefault,
  resetRoleToDefault,
  getDefaultPermissions,
  addCustomModule,
  listCustomModules,
  deleteCustomModule,
  MODULES,
  ACTIONS,
  ACCESS_ROLES,
};
