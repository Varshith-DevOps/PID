/**
 * @fileoverview Document management routes.
 * Handles file upload, download, and deletion for employee documents.
 * Uses Multer v2 for multipart file handling.
 * @module routes/documentRoutes
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth');
const { rbacMiddleware } = require('../rbac/rbacMiddleware');
const {
  getEmployeeDocuments,
  uploadDocument,
  deleteDocument,
  downloadDocument,
} = require('../controllers/documentController');

// ──── Multer Configuration ─────────────────────────────────────────────────

/** Ensure upload directory exists */
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * Multer disk storage configuration.
 * Files are saved to /uploads with unique timestamped names.
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

/** File upload handler with 10MB size limit and safe file type validation */
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = /pdf|doc|docx|xls|xlsx|png|jpg|jpeg|gif|webp|csv|txt/;
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp',
      'text/csv',
      'text/plain'
    ];

    const ext = path.extname(file.originalname).toLowerCase();
    const isValidExt = allowedExtensions.test(ext);
    const isValidMime = allowedMimeTypes.includes(file.mimetype.toLowerCase());

    if (isValidExt && isValidMime) {
      return cb(null, true);
    }
    const err = new Error('Only safe document files (PDF, Word, Excel, CSV, TXT) and images are allowed.');
    err.status = 400;
    cb(err);
  }
});

// ──── Routes ───────────────────────────────────────────────────────────────

/** GET /api/documents/:employeeId — List all documents for an employee */
router.get('/:employeeId', authenticate, rbacMiddleware('EMPLOYEES', 'VIEW'), getEmployeeDocuments);

/** POST /api/documents/:employeeId — Upload a new document */
router.post('/:employeeId', authenticate, rbacMiddleware('EMPLOYEES', 'CREATE'), upload.single('file'), uploadDocument);

/** DELETE /api/documents/:id — Delete a specific document */
router.delete('/:id', authenticate, rbacMiddleware('EMPLOYEES', 'DELETE'), deleteDocument);

/** GET /api/documents/download/:id — Download a specific document */
router.get('/download/:id', authenticate, rbacMiddleware('EMPLOYEES', 'VIEW'), downloadDocument);

module.exports = router;