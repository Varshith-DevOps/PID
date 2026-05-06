const prisma = require('../config/database');

const MODULES = ['USERS', 'EMPLOYEES', 'ATTENDANCE', 'LEAVE', 'PAYROLL', 'REPORTS', 'SETTINGS'];
const ACTIONS = ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'EXPORT'];
const ACCESS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE'];

const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  EMPLOYEE: 'Employee',
};

const getDefaultPermissions = (role) => {
  const defaults = {
    SUPER_ADMIN: MODULES.flatMap((m) => ACTIONS.map((a) => ({ module: m, action: a, isGranted: true }))),
    ADMIN: MODULES.flatMap((m) => [
      { module: m, action: 'VIEW', isGranted: true },
      { module: m, action: 'CREATE', isGranted: true },
      { module: m, action: 'EDIT', isGranted: true },
      { module: m, action: 'DELETE', isGranted: false },
      { module: m, action: 'EXPORT', isGranted: true },
    ]),
    MANAGER: [
      { module: 'EMPLOYEES', action: 'VIEW', isGranted: true },
      { module: 'EMPLOYEES', action: 'CREATE', isGranted: true },
      { module: 'EMPLOYEES', action: 'EDIT', isGranted: true },
      { module: 'ATTENDANCE', action: 'VIEW', isGranted: true },
      { module: 'ATTENDANCE', action: 'EDIT', isGranted: true },
      { module: 'LEAVE', action: 'VIEW', isGranted: true },
      { module: 'LEAVE', action: 'CREATE', isGranted: true },
      { module: 'LEAVE', action: 'EDIT', isGranted: true },
      { module: 'REPORTS', action: 'VIEW', isGranted: true },
      { module: 'REPORTS', action: 'EXPORT', isGranted: true },
    ],
    EMPLOYEE: [
      { module: 'EMPLOYEES', action: 'VIEW', isGranted: false },
      { module: 'ATTENDANCE', action: 'VIEW', isGranted: true },
      { module: 'ATTENDANCE', action: 'CREATE', isGranted: true },
      { module: 'LEAVE', action: 'VIEW', isGranted: true },
      { module: 'LEAVE', action: 'CREATE', isGranted: true },
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
    res.json({ roles, modules: MODULES, actions: ACTIONS });
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
    if (req.user.role === 'ADMIN' && role === 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Cannot modify Super Admin permissions' });
    }
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: 'Permissions must be an array' });
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

    if (req.user.role === 'EMPLOYEE') return res.status(403).json({ error: 'Access denied' });
    if (req.user.role === 'MANAGER' && targetUser.role === 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Cannot modify Super Admin permissions' });
    }
    if (req.user.role === 'ADMIN' && targetUser.role === 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Cannot modify Super Admin permissions' });
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

module.exports = {
  getUserPermissions,
  getAllPermissions,
  getRolePermissions,
  updateRolePermissions,
  updateUserPermissions,
  resetToDefault,
  resetRoleToDefault,
  getDefaultPermissions,
  MODULES,
  ACTIONS,
  ACCESS_ROLES,
};
