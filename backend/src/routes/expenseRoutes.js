/**
 * @fileoverview Expense Claims & Travel Advances routes.
 * @module routes/expenseRoutes
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth');
const {
  getClaims,
  createClaim,
  updateClaim,
  managerApproveClaim,
  financeApproveClaim,
  rejectClaim,
  getAdvances,
  createAdvance,
  approveAdvance,
  settleAdvance,
} = require('../controllers/expenseController');

// All expense routes require authentication
router.use(authenticate);

// ──── Receipt File Upload Configuration (Multer) ───────────────────────────

/** Ensure receipts upload directory exists */
const receiptsDir = path.join(__dirname, '../../uploads/receipts');
if (!fs.existsSync(receiptsDir)) {
  fs.mkdirSync(receiptsDir, { recursive: true });
}

/** Multer disk storage for receipt attachments */
const receiptsStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, receiptsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'receipt-' + uniqueSuffix + path.extname(file.originalname));
  },
});

/** Multer file size / type filters (restricting to PDF and image uploads) */
const uploadReceipt = multer({
  storage: receiptsStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.jpeg', '.jpg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file format. Allowed formats: PDF, JPEG, PNG, WebP'));
    }
  },
});

// ──── Expense Claims Endpoints ─────────────────────────────────────────────
router.get('/claims', getClaims);
router.post('/claims', uploadReceipt.single('receipt'), createClaim);
router.put('/claims/:id', uploadReceipt.single('receipt'), updateClaim);
router.put('/claims/:id/manager-approve', managerApproveClaim);
router.put('/claims/:id/finance-approve', financeApproveClaim);
router.put('/claims/:id/reject', rejectClaim);

// ──── Travel Advances Endpoints ────────────────────────────────────────────
router.get('/advances', getAdvances);
router.post('/advances', createAdvance);
router.put('/advances/:id/approve', approveAdvance);
router.put('/advances/:id/settle', settleAdvance);

module.exports = router;
