/**
 * @fileoverview Attendance Regularization / Correction requests routes.
 * @module routes/regularizationRoutes
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  submitRegularization,
  getRegularizations,
  actionRegularization,
} = require('../controllers/regularizationController');

// All regularization routes require authentication
router.use(authenticate);

router.get('/', getRegularizations);
router.post('/', submitRegularization);
router.post('/:id/action', actionRegularization);

module.exports = router;
