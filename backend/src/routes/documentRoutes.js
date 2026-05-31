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

/** File upload handler with 10MB size limit */
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

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