const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { rbacMiddleware, requireRole } = require('../rbac/rbacMiddleware');
const {
  getPayslipHistory,
  getPayslip,
  downloadPayslipPDF,
  downloadBulkPayslips,
  emailPayslip,
  emailBulkPayslips,
} = require('../controllers/payslipController');

router.get('/history', authenticate, rbacMiddleware('PAYROLL', 'VIEW'), getPayslipHistory);
router.get('/pdf-bulk/', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'HR', 'FINANCE', 'ACCOUNTS'), rbacMiddleware('PAYROLL', 'EXPORT'), downloadBulkPayslips);
router.get('/pdf/:id', authenticate, rbacMiddleware('PAYROLL', 'VIEW'), downloadPayslipPDF);
router.get('/:id', authenticate, rbacMiddleware('PAYROLL', 'VIEW'), getPayslip);

router.post('/email', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'HR', 'FINANCE', 'ACCOUNTS'), rbacMiddleware('PAYROLL', 'EXPORT'), emailPayslip);
router.post('/email-bulk', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'HR', 'FINANCE', 'ACCOUNTS'), rbacMiddleware('PAYROLL', 'EXPORT'), emailBulkPayslips);

module.exports = router;
