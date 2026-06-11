const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireRole, rbacMiddleware } = require('../rbac/rbacMiddleware');
const {
  getEmployeeOvertime,
  approveOvertime,
  rejectOvertime,
  getOTSummary,
  updateSettings,
} = require('../controllers/overtimeController');

router.get('/', authenticate, rbacMiddleware('ATTENDANCE', 'VIEW'), getEmployeeOvertime);
router.get('/summary', authenticate, rbacMiddleware('PAYROLL', 'VIEW'), getOTSummary);
router.put('/settings', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'HR'), rbacMiddleware('PAYROLL', 'EDIT'), updateSettings);
router.put('/:id/approve', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'HR', 'MANAGER'), rbacMiddleware('ATTENDANCE', 'EDIT'), approveOvertime);
router.put('/:id/reject', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'HR', 'MANAGER'), rbacMiddleware('ATTENDANCE', 'EDIT'), rejectOvertime);

module.exports = router;
