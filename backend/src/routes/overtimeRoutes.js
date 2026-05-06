const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../rbac/rbacMiddleware');
const {
  getEmployeeOvertime,
  approveOvertime,
  rejectOvertime,
  getOTSummary,
  updateSettings,
} = require('../controllers/overtimeController');

router.get('/', authenticate, getEmployeeOvertime);
router.put('/:id/approve', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), approveOvertime);
router.put('/:id/reject', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), rejectOvertime);
router.get('/summary', authenticate, getOTSummary);
router.put('/settings', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), updateSettings);

module.exports = router;