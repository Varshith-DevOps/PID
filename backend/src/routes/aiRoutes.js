/**
 * @fileoverview AI Agents API routing.
 * @module routes/aiRoutes
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const aiController = require('../controllers/aiController');

// Multer in-memory storage for simulating OCR document scanning
const storage = multer.memoryStorage();
const upload = multer({ storage });

// All AI routes require user authentication
router.use(authenticate);

router.post('/sherlock/audit-proof', upload.single('document'), aiController.auditProof);
router.post('/jarvis/audit-payroll', aiController.auditPayroll);
router.post('/winston/regularize', aiController.regularizeAttendance);
router.post('/athena/ask', aiController.askQuestion);

module.exports = router;
