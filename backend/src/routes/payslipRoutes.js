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

router.get('/history', authenticate, getPayslipHistory);
router.get('/:id', authenticate, getPayslip);
router.get('/pdf/:id', authenticate, downloadPayslipPDF);
router.get('/pdf-bulk/', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), downloadBulkPayslips);

router.post('/email', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), emailPayslip);
router.post('/email-bulk', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), emailBulkPayslips);

module.exports = router;