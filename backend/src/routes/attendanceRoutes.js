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
  syncBiometricLogs,
} = require('../controllers/attendanceController');

router.get('/settings', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), getSettingsHandler);
router.put('/settings', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), updateSettings);

const { validateAttendancePunch } = require('../middleware/attendanceValidation');
const { syncBiometricPunches, syncUniversalDevicePunch } = require('../controllers/attendanceSyncController');

router.post('/check-in', authenticate, validateAttendancePunch, checkIn);
router.post('/check-out', authenticate, validateAttendancePunch, checkOut);
router.post('/sync', authenticate, syncBiometricPunches);
router.post('/sync/biometric-webhook', syncBiometricLogs);

// Universal device webhook (supports M2M API key authentication)
router.post('/device-push/universal', (req, res, next) => {
  if (req.headers['x-api-key']) {
    return next();
  }
  return authenticate(req, res, next);
}, syncUniversalDevicePunch);

router.get('/today', authenticate, rbacMiddleware('ATTENDANCE', 'VIEW'), getTodayAttendance);
router.get('/employee/:employeeId', authenticate, getEmployeeAttendance);
router.get('/report/monthly', authenticate, rbacMiddleware('ATTENDANCE', 'VIEW'), getMonthlyReport);

router.post('/mark', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), markAttendance);

module.exports = router;