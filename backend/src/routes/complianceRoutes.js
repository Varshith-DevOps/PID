/**
 * @fileoverview Express routes for statutory filing reports (EPFO ECR, ESIC, Form 16).
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireRole, rbacMiddleware } = require('../rbac/rbacMiddleware');
const {
  getPF_ECR,
  getESICReport,
  getForm16,
  bulkGenerateForm16
} = require('../controllers/complianceController');

router.get('/pf/ecr', authenticate, rbacMiddleware('PAYROLL', 'EXPORT'), getPF_ECR);
router.get('/esic/report', authenticate, rbacMiddleware('PAYROLL', 'EXPORT'), getESICReport);
router.get('/form16/:employeeId', authenticate, rbacMiddleware('PAYROLL', 'VIEW'), getForm16);
router.post('/form16/bulk', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), bulkGenerateForm16);

module.exports = router;
