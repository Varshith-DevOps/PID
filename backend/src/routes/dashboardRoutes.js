/**
 * @fileoverview Executive Dashboard routing.
 * Provides endpoint for entrepreneur's aggregate insight overview.
 * @module routes/dashboardRoutes
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { rbacMiddleware } = require('../rbac/rbacMiddleware');
const { getExecutiveSummary } = require('../controllers/dashboardController');

// Requires authentication
router.get('/summary', authenticate, rbacMiddleware('REPORTS', 'VIEW'), getExecutiveSummary);

module.exports = router;
