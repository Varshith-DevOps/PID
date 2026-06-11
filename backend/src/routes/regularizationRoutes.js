/**
 * @fileoverview Attendance Regularization / Correction requests routes.
 * @module routes/regularizationRoutes
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { rbacMiddleware, requireRole } = require('../rbac/rbacMiddleware');
const {
  submitRegularization,
  getRegularizations,
  actionRegularization,
} = require('../controllers/regularizationController');

// All regularization routes require authentication
router.use(authenticate);

router.get('/', rbacMiddleware('ATTENDANCE', 'VIEW'), getRegularizations);
router.post('/', rbacMiddleware('ATTENDANCE', 'CREATE'), submitRegularization);
router.post('/:id/action', requireRole('SUPER_ADMIN', 'ADMIN', 'HR', 'MANAGER'), rbacMiddleware('ATTENDANCE', 'EDIT'), actionRegularization);

module.exports = router;
