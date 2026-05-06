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
  resetToDefault,
  resetRoleToDefault,
} = require('../controllers/permissionController');

router.get('/user/:userId', authenticate, getUserPermissions);
router.get('/all', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), getAllPermissions);
router.get('/roles', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), getRolePermissions);
router.put('/role/:role', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), updateRolePermissions);
router.put('/user/:userId', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), updateUserPermissions);
router.post('/reset-role/:role', authenticate, requireRole('SUPER_ADMIN'), resetRoleToDefault);
router.post('/reset/:userId', authenticate, requireRole('SUPER_ADMIN'), resetToDefault);

module.exports = router;
