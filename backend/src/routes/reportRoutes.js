/**
 * @fileoverview Routing mappings for HRMS Reports and Workforce Analytics.
 * @module routes/reportRoutes
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { rbacMiddleware } = require('../rbac/rbacMiddleware');
const {
  queryEmployees,
  getStatutoryReport,
  getPayrollReport,
  getAnalyticsReport,
  getDashboardData,
  exportReport
} = require('../controllers/reportController');
const {
  getAuditReportCatalog,
  getAuditReportCenter,
  generateAuditPack,
  updateAuditPackStatus,
  exportAuditPack
} = require('../controllers/auditReportCenterController');

// All reports routes are authenticated and require REPORTS VIEW grant
router.use(authenticate);
router.use(rbacMiddleware('REPORTS', 'VIEW'));

/** POST /api/reports/query — Dynamic Report Builder query endpoint */
router.post('/query', queryEmployees);
router.get('/audit/catalog', getAuditReportCatalog);
router.get('/audit/center', getAuditReportCenter);
router.post('/audit/generate', rbacMiddleware('REPORTS', 'EXPORT'), generateAuditPack);
router.patch('/audit/runs/:id/status', rbacMiddleware('REPORTS', 'EXPORT'), updateAuditPackStatus);
router.post('/audit/export', rbacMiddleware('REPORTS', 'EXPORT'), exportAuditPack);

/** GET /api/reports/statutory/:type — Statutory compliance report lists */
router.get('/statutory/:type', getStatutoryReport);

/** GET /api/reports/payroll/:type — Financial & payroll registries */
router.get('/payroll/:type', getPayrollReport);

/** GET /api/reports/analytics/:type — Demographic diversity data */
router.get('/analytics/:type', getAnalyticsReport);

/** GET /api/reports/dashboards/:role — Aggregate executive summaries */
router.get('/dashboards/:role', getDashboardData);

/** POST /api/reports/export — Stream excel document downloads */
router.post('/export', rbacMiddleware('REPORTS', 'EXPORT'), exportReport);

module.exports = router;
