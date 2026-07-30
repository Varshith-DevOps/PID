/**
 * @fileoverview AI Agents API routing.
 * @module routes/aiRoutes
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const aiController = require('../controllers/aiController');

// Multer in-memory storage for simulating OCR document scanning.
// Bound the upload: memoryStorage buffers the whole file in RAM, so without a
// limit a single large POST can OOM the worker. Only the filename is used.
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const allowed = /pdf|png|jpe?g|webp|gif|csv|txt|docx?|xlsx?/i;
    if (allowed.test(require('path').extname(file.originalname).toLowerCase())) return cb(null, true);
    cb(new Error('Unsupported document type'));
  },
});

// All AI routes require user authentication
router.use(authenticate);

router.post('/sherlock/audit-proof', upload.single('document'), aiController.auditProof);
router.post('/jarvis/audit-payroll', aiController.auditPayroll);
router.post('/winston/regularize', aiController.regularizeAttendance);
router.post('/athena/ask', aiController.askPriya); // Upgraded: Legacy Athena points to Priya
router.post('/priya/ask', aiController.askPriya);
router.post('/project', aiController.askProject);
router.post('/recruitment', aiController.askRecruitment);
router.post('/feedback', aiController.submitFeedback);

module.exports = router;
