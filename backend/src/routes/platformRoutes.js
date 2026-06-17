const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { rbacMiddleware, requireRole } = require('../rbac/rbacMiddleware');
const {
  getPlatformOverview,
  bootstrapPlatform,
  listOrganization,
  createCompany,
  createLegalEntity,
  createBranch,
  createLocation,
  listPolicies,
  createPolicy,
  listWorkflows,
  createWorkflow,
  startWorkflow,
  listApprovalInbox,
  actionApprovalTask,
  listComplianceObligations,
  generateComplianceCalendar,
  updateComplianceObligation,
  listIntegrations,
  upsertIntegration,
  testIntegration,
} = require('../controllers/platformController');

const { updateCompanyCustomizationAndKYC } = require('../controllers/companyController');

router.use(authenticate);

router.get('/overview', rbacMiddleware('SETTINGS', 'VIEW'), getPlatformOverview);
router.post('/bootstrap', requireRole('SUPER_ADMIN', 'ADMIN'), bootstrapPlatform);

router.get('/organization', rbacMiddleware('SETTINGS', 'VIEW'), listOrganization);
router.put('/organization/company', rbacMiddleware('SETTINGS', 'EDIT'), updateCompanyCustomizationAndKYC);
router.post('/organization/companies', requireRole('SUPER_ADMIN', 'ADMIN'), createCompany);
router.post('/organization/legal-entities', requireRole('SUPER_ADMIN', 'ADMIN'), createLegalEntity);
router.post('/organization/branches', requireRole('SUPER_ADMIN', 'ADMIN', 'HR'), createBranch);
router.post('/organization/locations', requireRole('SUPER_ADMIN', 'ADMIN', 'HR'), createLocation);

router.get('/policies', rbacMiddleware('SETTINGS', 'VIEW'), listPolicies);
router.post('/policies', rbacMiddleware('SETTINGS', 'CREATE'), createPolicy);

router.get('/workflows', rbacMiddleware('WORKFLOWS', 'VIEW'), listWorkflows);
router.post('/workflows', rbacMiddleware('WORKFLOWS', 'CREATE'), createWorkflow);
router.post('/workflows/start', rbacMiddleware('WORKFLOWS', 'CREATE'), startWorkflow);
router.get('/approvals/inbox', rbacMiddleware('WORKFLOWS', 'VIEW'), listApprovalInbox);
router.post('/approvals/tasks/:taskId/action', rbacMiddleware('WORKFLOWS', 'EDIT'), actionApprovalTask);

router.get('/compliance/obligations', rbacMiddleware('COMPLIANCE', 'VIEW'), listComplianceObligations);
router.post('/compliance/calendar', rbacMiddleware('COMPLIANCE', 'CREATE'), generateComplianceCalendar);
router.put('/compliance/obligations/:id', rbacMiddleware('COMPLIANCE', 'EDIT'), updateComplianceObligation);

router.get('/integrations', rbacMiddleware('INTEGRATIONS', 'VIEW'), listIntegrations);
router.post('/integrations', rbacMiddleware('INTEGRATIONS', 'CREATE'), upsertIntegration);
router.post('/integrations/:id/test', rbacMiddleware('INTEGRATIONS', 'EDIT'), testIntegration);

module.exports = router;
