const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { rbacMiddleware, requireRole } = require('../rbac/rbacMiddleware');
const {
  checkIn,
  checkOut,
  getTodayAttendance,
  getEmployeeAttendance,
  getMonthlyReport,
  markAttendance,
  getSettingsHandler,
  updateSettings,
} = require('../controllers/attendanceController');

router.get('/settings', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), getSettingsHandler);
router.put('/settings', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), updateSettings);

router.post('/check-in', authenticate, checkIn);
router.post('/check-out', authenticate, checkOut);

router.get('/today', authenticate, rbacMiddleware('ATTENDANCE', 'VIEW'), getTodayAttendance);
router.get('/employee/:employeeId', authenticate, rbacMiddleware('ATTENDANCE', 'VIEW'), getEmployeeAttendance);
router.get('/report/monthly', authenticate, rbacMiddleware('ATTENDANCE', 'VIEW'), getMonthlyReport);

router.post('/mark', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), markAttendance);

module.exports = router;