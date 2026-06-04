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

// All reports routes are authenticated and require REPORTS VIEW grant
router.use(authenticate);
router.use(rbacMiddleware('REPORTS', 'VIEW'));

/** POST /api/reports/query — Dynamic Report Builder query endpoint */
router.post('/query', queryEmployees);

/** GET /api/reports/statutory/:type — Statutory compliance report lists */
router.get('/statutory/:type', getStatutoryReport);

/** GET /api/reports/payroll/:type — Financial & payroll registries */
router.get('/payroll/:type', getPayrollReport);

/** GET /api/reports/analytics/:type — Demographic diversity data */
router.get('/analytics/:type', getAnalyticsReport);

/** GET /api/reports/dashboards/:role — Aggregate executive summaries */
router.get('/dashboards/:role', getDashboardData);

/** POST /api/reports/export — Stream excel document downloads */
router.post('/export', exportReport);

module.exports = router;
