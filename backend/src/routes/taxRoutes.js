/**
 * @fileoverview Express routes for tax declarations, YTD summary, and projections.
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireRole, rbacMiddleware } = require('../rbac/rbacMiddleware');
const {
  savePreviousEmployerIncome,
  saveTaxDeclaration,
  getYtdSummary,
  getTaxProjection
} = require('../controllers/taxController');

router.post('/previous-employer', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), savePreviousEmployerIncome);
router.post('/declaration', authenticate, rbacMiddleware('PAYROLL', 'EDIT'), saveTaxDeclaration);
router.get('/ytd-summary/:employeeId', authenticate, rbacMiddleware('PAYROLL', 'VIEW'), getYtdSummary);
router.get('/projection/:employeeId', authenticate, rbacMiddleware('PAYROLL', 'VIEW'), getTaxProjection);

module.exports = router;
