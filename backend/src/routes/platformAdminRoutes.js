const express = require('express');
const router = express.Router();
const {
  getCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
  updateCompanyStatus,
  getSubscriptions,
  updateSubscription,
  getMetrics,
  createCustomPlan,
  verifyCompanyKYC,
  updateCompanySubdomain,
  recordTenantPayment,
  runDunning,
  getAuditLogs
} = require('../controllers/platformAdminController');
const {
  listSupportStaff,
  createSupportStaff,
  setSupportStaffStatus,
  assignCompany,
  revokeCompany,
} = require('../controllers/supportStaffController');
const { authenticate, authorize } = require('../middleware/auth');
const { GROUPS } = require('../rbac/platformRoles');

router.use(authenticate);

// ── Separation of duties: each owner action is gated to its responsible role ──
// Read-only directory / pipeline.
router.get('/companies', authorize(...GROUPS.VIEW), getCompanies);
router.get('/subscriptions', authorize(...GROUPS.VIEW), getSubscriptions);
router.get('/metrics', authorize(...GROUPS.AUDIT), getMetrics);
router.get('/audit-logs', authorize(...GROUPS.AUDIT), getAuditLogs);
// Tenant lifecycle (ops).
router.post('/companies', authorize(...GROUPS.OPS), createCompany);
router.put('/companies/:id', authorize(...GROUPS.OPS), updateCompany);
router.delete('/companies/:id', authorize(...GROUPS.OPS), deleteCompany);
router.put('/companies/:id/status', authorize(...GROUPS.OPS), updateCompanyStatus);
router.put('/companies/:id/subdomain', authorize(...GROUPS.SUBDOMAIN), updateCompanySubdomain);
// KYC (compliance).
router.put('/companies/:id/kyc', authorize(...GROUPS.COMPLIANCE), verifyCompanyKYC);
// Billing.
router.post('/companies/:id/custom-plan', authorize(...GROUPS.SALES), createCustomPlan);
router.put('/subscriptions/:id', authorize(...GROUPS.BILLING), updateSubscription);
router.post('/companies/:id/record-payment', authorize(...GROUPS.BILLING), recordTenantPayment);
router.post('/billing/run-dunning', authorize(...GROUPS.BILLING), runDunning);

// Platform staff management (ops). Create supports a role; assignments are SUPPORT-only.
router.get('/support-staff', authorize(...GROUPS.STAFF), listSupportStaff);
router.post('/support-staff', authorize(...GROUPS.STAFF), createSupportStaff);
router.put('/support-staff/:id/status', authorize(...GROUPS.STAFF), setSupportStaffStatus);
router.post('/support-staff/:id/assignments', authorize(...GROUPS.STAFF), assignCompany);
router.delete('/support-staff/:id/assignments/:companyId', authorize(...GROUPS.STAFF), revokeCompany);

module.exports = router;
