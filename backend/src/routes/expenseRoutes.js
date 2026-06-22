/**
 * @fileoverview Expense Claims & Travel Advances routes.
 * @module routes/expenseRoutes
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { ensureUploadDir } = require('../config/storage');
const { authenticate } = require('../middleware/auth');
const { rbacMiddleware, requireRole } = require('../rbac/rbacMiddleware');
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
  downloadClaimReceipt,
} = require('../controllers/expenseController');

// All expense routes require authentication
router.use(authenticate);

// ──── Receipt File Upload Configuration (Multer) ───────────────────────────

/** Ensure receipts upload directory exists */
const receiptsDir = ensureUploadDir('receipts');

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
    const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext) && allowedMimeTypes.includes(String(file.mimetype).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file format. Allowed formats: PDF, JPEG, PNG, WebP'));
    }
  },
});

// ──── Expense Claims Endpoints ─────────────────────────────────────────────
router.get('/claims', rbacMiddleware('EXPENSES', 'VIEW'), getClaims);
router.post('/claims', rbacMiddleware('EXPENSES', 'CREATE'), uploadReceipt.single('receipt'), createClaim);
router.put('/claims/:id', rbacMiddleware('EXPENSES', 'EDIT'), uploadReceipt.single('receipt'), updateClaim);
router.get('/claims/:id/receipt', rbacMiddleware('EXPENSES', 'VIEW'), downloadClaimReceipt);
router.put('/claims/:id/manager-approve', requireRole('SUPER_ADMIN', 'ADMIN', 'HR', 'MANAGER'), rbacMiddleware('EXPENSES', 'EDIT'), managerApproveClaim);
router.put('/claims/:id/finance-approve', requireRole('SUPER_ADMIN', 'ADMIN', 'FINANCE', 'ACCOUNTS'), rbacMiddleware('EXPENSES', 'EDIT'), financeApproveClaim);
router.put('/claims/:id/reject', rbacMiddleware('EXPENSES', 'EDIT'), rejectClaim);

// ──── Travel Advances Endpoints ────────────────────────────────────────────
router.get('/advances', rbacMiddleware('EXPENSES', 'VIEW'), getAdvances);
router.post('/advances', rbacMiddleware('EXPENSES', 'CREATE'), createAdvance);
router.put('/advances/:id/approve', requireRole('SUPER_ADMIN', 'ADMIN', 'FINANCE', 'ACCOUNTS'), rbacMiddleware('EXPENSES', 'EDIT'), approveAdvance);
router.put('/advances/:id/settle', requireRole('SUPER_ADMIN', 'ADMIN', 'FINANCE', 'ACCOUNTS'), rbacMiddleware('EXPENSES', 'EDIT'), settleAdvance);

module.exports = router;
