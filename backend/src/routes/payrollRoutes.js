const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { rbacMiddleware, requireRole } = require('../rbac/rbacMiddleware');
const {
  getSalaryStructure,
  setSalaryStructure,
  getPayrollPreflight,
  runPayroll,
  getPayrollReport,
  getPayrollExport,
  getAllPayrollRuns,
  calculateEmployeeSalary,
  getPayrollSettings,
  updatePayrollSettings,
  reviewPayroll,
  approvePayroll,
  processPayroll,
  rejectPayroll,
  reversePayroll
} = require('../controllers/payrollController');

router.get('/settings', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), getPayrollSettings);
router.put('/settings', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), updatePayrollSettings);

router.get('/structure/:employeeId', authenticate, rbacMiddleware('PAYROLL', 'VIEW'), getSalaryStructure);
router.put('/structure/:employeeId', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), setSalaryStructure);

router.get('/runs', authenticate, rbacMiddleware('PAYROLL', 'VIEW'), getAllPayrollRuns);
router.get('/preflight', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), getPayrollPreflight);
router.get('/report', authenticate, rbacMiddleware('PAYROLL', 'VIEW'), getPayrollReport);
router.get('/export', authenticate, rbacMiddleware('PAYROLL', 'EXPORT'), getPayrollExport);
router.get('/calculate/:employeeId', authenticate, rbacMiddleware('PAYROLL', 'VIEW'), calculateEmployeeSalary);

router.post('/run', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), runPayroll);

// Maker-Checker Approval Workflow
router.post('/runs/review/:runId', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'PAYROLL_REVIEWER'), reviewPayroll);
router.post('/runs/approve/:runId', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'PAYROLL_APPROVER'), approvePayroll);
router.post('/runs/process/:runId', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), processPayroll);
router.post('/runs/reject/:runId', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'PAYROLL_REVIEWER', 'PAYROLL_APPROVER'), rejectPayroll);

// Reversal/Rollback
router.post('/runs/reverse/:runId', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), reversePayroll);

module.exports = router;

