/**
 * @fileoverview Performance Management & Appraisal routes.
 * @module routes/performanceRoutes
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
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
router.get('/kras', getKras);
router.post('/kras', createKra);
router.put('/kras/:id', updateKra);
router.delete('/kras/:id', deleteKra);

// ──── Appraisals Endpoints ──────────────────────────────────────────────────
router.get('/appraisals', getAppraisals);
router.post('/appraisals', createAppraisal);
router.put('/appraisals/:id/self', submitSelfEvaluation);
router.put('/appraisals/:id/manager', submitManagerEvaluation);

// ──── 360 continuous Feedback Endpoints ─────────────────────────────────────
router.get('/feedback360', getFeedback360);
router.post('/feedback360', submitFeedback360);

module.exports = router;
