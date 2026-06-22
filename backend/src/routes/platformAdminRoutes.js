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
 
router.use(authenticate);
 
// SALES can view tenant pipeline data; only SUPER_ADMIN can mutate platform state.
router.get('/companies', authorize('SUPER_ADMIN', 'SALES'), getCompanies);
router.get('/subscriptions', authorize('SUPER_ADMIN', 'SALES'), getSubscriptions);
router.get('/metrics', authorize('SUPER_ADMIN'), getMetrics);
router.put('/companies/:id/status', authorize('SUPER_ADMIN'), updateCompanyStatus);
router.put('/companies/:id/kyc', authorize('SUPER_ADMIN'), verifyCompanyKYC);
router.post('/companies/:id/custom-plan', authorize('SUPER_ADMIN', 'SALES'), createCustomPlan);
router.put('/subscriptions/:id', authorize('SUPER_ADMIN'), updateSubscription);
 
module.exports = router;
