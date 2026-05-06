const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { authenticate } = require('../middleware/auth');
const { rbacMiddleware } = require('../rbac/rbacMiddleware');
const { getEmployeeDocuments, uploadDocument, deleteDocument, downloadDocument } = require('../controllers/documentController');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads')),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/:employeeId', authenticate, rbacMiddleware('EMPLOYEES', 'VIEW'), getEmployeeDocuments);
router.post('/:employeeId', authenticate, rbacMiddleware('EMPLOYEES', 'CREATE'), upload.single('file'), uploadDocument);
router.delete('/:id', authenticate, rbacMiddleware('EMPLOYEES', 'DELETE'), deleteDocument);
router.get('/download/:id', authenticate, rbacMiddleware('EMPLOYEES', 'VIEW'), downloadDocument);

module.exports = router;