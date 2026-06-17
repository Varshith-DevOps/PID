const express = require('express');
const router = express.Router();
const {
  getCompanies,
  updateCompanyStatus,
  getSubscriptions,
  updateSubscription,
  getMetrics,
  createCustomPlan,
  verifyCompanyKYC
} = require('../controllers/platformAdminController');
const { authenticate, authorize } = require('../middleware/auth');
 
// Require SUPER_ADMIN or SALES role for all platform-admin endpoints
router.use(authenticate);
router.use(authorize('SUPER_ADMIN', 'SALES'));
 
router.get('/companies', getCompanies);
router.put('/companies/:id/status', updateCompanyStatus);
router.put('/companies/:id/kyc', verifyCompanyKYC);
router.post('/companies/:id/custom-plan', createCustomPlan);
router.get('/subscriptions', getSubscriptions);
router.put('/subscriptions/:id', updateSubscription);
router.get('/metrics', getMetrics);
 
module.exports = router;
