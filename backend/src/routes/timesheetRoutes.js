const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { rbacMiddleware, requireRole } = require('../rbac/rbacMiddleware');
const { validate } = require('../middleware/validate');
const { timesheetCreateSchema } = require('../schemas/operationsSchemas');
const {
  logTimesheet,
  getEmployeeTimesheets,
  getAllTimesheets,
  generateAttendanceFromTimesheet,
  getDailySummary,
} = require('../controllers/timesheetController');

router.post('/', authenticate, rbacMiddleware('ATTENDANCE', 'CREATE'), validate(timesheetCreateSchema), logTimesheet);
router.get('/employee/:employeeId', authenticate, rbacMiddleware('ATTENDANCE', 'VIEW'), getEmployeeTimesheets);
router.get('/all', authenticate, rbacMiddleware('ATTENDANCE', 'VIEW'), getAllTimesheets);
router.get('/daily', authenticate, rbacMiddleware('ATTENDANCE', 'VIEW'), getDailySummary);

router.post('/generate-attendance', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), generateAttendanceFromTimesheet);

module.exports = router;
