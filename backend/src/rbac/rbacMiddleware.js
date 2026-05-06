const prisma = require('../config/database');

const SUPER_ADMIN_ROLES = ['SUPER_ADMIN'];
const ADMIN_MANAGER_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];

const hasRole = (userRole, allowedRoles) => allowedRoles.includes(userRole);

const checkModulePermission = async (userId, module, action) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { permissions: true },
  });

  if (!user) return false;
  if (SUPER_ADMIN_ROLES.includes(user.role)) return true;

  const permission = user.permissions.find((p) => p.module === module && p.action === action);
  return permission?.isGranted === true;
};

const rbacMiddleware = (module, action) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.isActive) return res.status(403).json({ error: 'Access denied' });

      if (SUPER_ADMIN_ROLES.includes(user.role)) {
        return next();
      }

      if (module && action) {
        const hasPermission = await checkModulePermission(userId, module, action);
        if (!hasPermission) {
          return res.status(403).json({ error: `Permission denied for ${module}.${action}` });
        }
      }

      next();
    } catch (error) {
      res.status(500).json({ error: 'Authorization error' });
    }
  };
};

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    const userRole = req.user?.role;
    if (!userRole || !hasRole(userRole, allowedRoles)) {
      return res.status(403).json({ error: 'Role not authorized' });
    }
    next();
  };
};

module.exports = { rbacMiddleware, requireRole, checkModulePermission, SUPER_ADMIN_ROLES, ADMIN_MANAGER_ROLES };