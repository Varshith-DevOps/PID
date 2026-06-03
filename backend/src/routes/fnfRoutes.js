/**
 * @fileoverview Express routes for Full and Final (F&F) exit settlement calculations.
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireRole, rbacMiddleware } = require('../rbac/rbacMiddleware');
const {
  getFNFCalculation,
  finalizeFNFSettlement
} = require('../controllers/fnfController');

router.get('/calculate/:employeeId', authenticate, rbacMiddleware('PAYROLL', 'VIEW'), getFNFCalculation);
router.post('/finalize/:employeeId', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), finalizeFNFSettlement);

module.exports = router;
