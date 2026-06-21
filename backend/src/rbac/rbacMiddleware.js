/**
 * @fileoverview Role-Based Access Control (RBAC) middleware.
 * Provides fine-grained module/action permission checks and role-gating.
 *
 * Permission flow:
 * 1. Super Admin → always granted, bypasses all checks
 * 2. Other roles → lookup user permissions in DB for the specific module+action
 *
 * @module rbac/rbacMiddleware
 */

const prisma = require('../config/database');
const { getDefaultPermissions } = require('../controllers/permissionController');
const { logSecurityEvent } = require('../utils/securityEvents');

/** Roles that bypass all permission checks */
const SUPER_ADMIN_ROLES = ['SUPER_ADMIN'];

/** Roles with elevated management privileges */
const ADMIN_MANAGER_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];

const permissionGranted = (user, module, action) => {
  const permission = user.permissions.find(
    (p) => p.module === module && p.action === action
  );
  const defaultPermission = getDefaultPermissions(user.role).find(
    (p) => p.module === module && p.action === action
  );

  // Seeded/local users can carry stale explicit grants after defaults evolve.
  // Keep explicit denies for ordinary employees, but let elevated roles inherit
  // newly-added safe defaults.
  if (permission) {
    if (permission.isGranted === true) return true;
    if (['ADMIN', 'HR', 'MANAGER', 'FINANCE', 'ACCOUNTS'].includes(user.role)) {
      return defaultPermission?.isGranted === true;
    }
    return false;
  }

  return defaultPermission?.isGranted === true;
};

/**
 * Check if a user role is within the allowed roles list.
 * @param {string} userRole - The user's current role
 * @param {string[]} allowedRoles - Array of permitted roles
 * @returns {boolean}
 */
const hasRole = (userRole, allowedRoles) => allowedRoles.includes(userRole);

/**
 * Query the database to check if a user has a specific module+action permission.
 * Super Admins automatically return true.
 *
 * @param {string} userId - The user's ID
 * @param {string} module - Module name (e.g., 'EMPLOYEES', 'PAYROLL')
 * @param {string} action - Action name (e.g., 'VIEW', 'CREATE', 'EDIT', 'DELETE')
 * @returns {Promise<boolean>} Whether the permission is granted
 */
const checkModulePermission = async (userId, module, action) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { permissions: true },
  });

  if (!user) return false;
  if (SUPER_ADMIN_ROLES.includes(user.role)) return true;

  return permissionGranted(user, module, action);
};

/**
 * Middleware factory that checks module-level permissions.
 * Validates the user is active and has the required module+action grant.
 *
 * @param {string} module - The module to check (e.g., 'EMPLOYEES')
 * @param {string} action - The action to check (e.g., 'VIEW')
 * @returns {import('express').RequestHandler} Express middleware
 *
 * @example
 * router.get('/', authenticate, rbacMiddleware('EMPLOYEES', 'VIEW'), getAllEmployees);
 */
const rbacMiddleware = (module, action) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      // Consolidate user status check, permission lookup, and company details in one database query
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { permissions: true, company: true }
      });

      if (!user || !user.isActive) {
        return res.status(403).json({ error: 'Access denied. Account inactive.' });
      }

      // Super Admins bypass all permission checks
      if (SUPER_ADMIN_ROLES.includes(user.role)) {
        return next();
      }

      // Enforce KYC & CIN Gating for tenant users
      if (user.companyId && user.role !== 'SALES') {
        const company = user.company;
        if (!company) {
          return res.status(403).json({ error: 'Company not found.' });
        }

        // 1. Without company CIN account cannot be used
        if (!company.cin) {
          if (module !== 'SETTINGS') {
            return res.status(403).json({
              error: 'Company CIN is missing. Access blocked.',
              cinMissing: true
            });
          }
        } else if (company.kycStatus !== 'APPROVED') {
          // 2. If KYC not done, only attendance & leave module only can be used
          if (module && !['ATTENDANCE', 'LEAVE', 'SETTINGS'].includes(module)) {
            return res.status(403).json({
              error: 'KYC not approved. Access restricted to Attendance and Leave modules.',
              kycRequired: true
            });
          }
        }
      }

      // Check specific module+action permission
      if (module && action) {
        if (!permissionGranted(user, module, action)) {
          logSecurityEvent(req, {
            action: 'AUTHZ_DENIED',
            entity: module,
            userId: user.id,
            userEmail: user.email,
            details: { module, action, path: req.originalUrl, method: req.method },
          }).catch(() => {});
          return res.status(403).json({
            error: `Permission denied for ${module}.${action}`,
          });
        }
      }

      next();
    } catch (error) {
      console.error('[RBAC ERROR]:', error.message);
      res.status(500).json({ error: 'Authorization error' });
    }
  };
};

/**
 * Middleware factory that restricts access to specific roles.
 * Simpler than rbacMiddleware — only checks role, not granular permissions.
 *
 * @param {...string} allowedRoles - Roles that are permitted
 * @returns {import('express').RequestHandler} Express middleware
 *
 * @example
 * router.post('/', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), createDepartment);
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    const userRole = req.user?.role;
    if (!userRole || !hasRole(userRole, allowedRoles)) {
      logSecurityEvent(req, {
        action: 'AUTHZ_DENIED_ROLE',
        userId: req.user?.id,
        userEmail: req.user?.email,
        details: { required: allowedRoles, role: userRole || null, path: req.originalUrl, method: req.method },
      }).catch(() => {});
      return res.status(403).json({ error: 'Role not authorized' });
    }
    next();
  };
};

module.exports = {
  rbacMiddleware,
  requireRole,
  checkModulePermission,
  SUPER_ADMIN_ROLES,
  ADMIN_MANAGER_ROLES,
};
