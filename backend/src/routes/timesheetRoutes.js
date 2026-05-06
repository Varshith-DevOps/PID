const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { rbacMiddleware, requireRole } = require('../rbac/rbacMiddleware');
const {
  logTimesheet,
  getEmployeeTimesheets,
  getAllTimesheets,
  generateAttendanceFromTimesheet,
  getDailySummary,
} = require('../controllers/timesheetController');

router.post('/', authenticate, logTimesheet);
router.get('/employee/:employeeId', authenticate, getEmployeeTimesheets);
router.get('/all', authenticate, rbacMiddleware('ATTENDANCE', 'VIEW'), getAllTimesheets);
router.get('/daily', authenticate, getDailySummary);

router.post('/generate-attendance', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), generateAttendanceFromTimesheet);

module.exports = router;