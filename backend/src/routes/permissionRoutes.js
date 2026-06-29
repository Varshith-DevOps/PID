const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireRole, rbacMiddleware } = require('../rbac/rbacMiddleware');
const {
  getUserPermissions,
  getAllPermissions,
  getRolePermissions,
  updateRolePermissions,
  updateUserPermissions,
  updateUserRole,
  resetToDefault,
  resetRoleToDefault,
  addCustomModule,
  listCustomModules,
  deleteCustomModule,
} = require('../controllers/permissionController');

router.get('/user/:userId', authenticate, getUserPermissions);
router.get('/all', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), getAllPermissions);
router.get('/roles', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), getRolePermissions);
// Global role defaults are platform-level (super admin only).
router.put('/role/:role', authenticate, requireRole('SUPER_ADMIN'), updateRolePermissions);
router.post('/reset-role/:role', authenticate, requireRole('SUPER_ADMIN'), resetRoleToDefault);
// Per-user access management is tenant-scoped: a tenant ADMIN manages their org.
router.put('/user/:userId/role', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), updateUserRole);
router.put('/user/:userId', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), updateUserPermissions);
router.post('/reset/:userId', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), resetToDefault);
// Tenant-scoped custom access modules — a tenant ADMIN manages their own.
router.get('/modules', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), listCustomModules);
router.post('/modules', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), addCustomModule);
router.delete('/modules/:key', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), deleteCustomModule);

module.exports = router;
