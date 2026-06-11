/**
 * @fileoverview Performance Management & Appraisal routes.
 * @module routes/performanceRoutes
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { rbacMiddleware, requireRole } = require('../rbac/rbacMiddleware');
const {
  getKras,
  createKra,
  updateKra,
  deleteKra,
  getAppraisals,
  createAppraisal,
  submitSelfEvaluation,
  submitManagerEvaluation,
  getFeedback360,
  submitFeedback360,
} = require('../controllers/performanceController');

// All performance routes require authentication
router.use(authenticate);

// ──── KRAs / Goals Endpoints ──────────────────────────────────────────────
router.get('/kras', rbacMiddleware('PERFORMANCE', 'VIEW'), getKras);
router.post('/kras', rbacMiddleware('PERFORMANCE', 'CREATE'), createKra);
router.put('/kras/:id', rbacMiddleware('PERFORMANCE', 'EDIT'), updateKra);
router.delete('/kras/:id', requireRole('SUPER_ADMIN', 'ADMIN', 'HR'), rbacMiddleware('PERFORMANCE', 'DELETE'), deleteKra);

// ──── Appraisals Endpoints ──────────────────────────────────────────────────
router.get('/appraisals', rbacMiddleware('PERFORMANCE', 'VIEW'), getAppraisals);
router.post('/appraisals', requireRole('SUPER_ADMIN', 'ADMIN', 'HR', 'MANAGER'), rbacMiddleware('PERFORMANCE', 'CREATE'), createAppraisal);
router.put('/appraisals/:id/self', rbacMiddleware('PERFORMANCE', 'EDIT'), submitSelfEvaluation);
router.put('/appraisals/:id/manager', requireRole('SUPER_ADMIN', 'ADMIN', 'HR', 'MANAGER'), rbacMiddleware('PERFORMANCE', 'EDIT'), submitManagerEvaluation);

// ──── 360 continuous Feedback Endpoints ─────────────────────────────────────
router.get('/feedback360', rbacMiddleware('PERFORMANCE', 'VIEW'), getFeedback360);
router.post('/feedback360', rbacMiddleware('PERFORMANCE', 'CREATE'), submitFeedback360);

module.exports = router;
