const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { authenticate } = require('../middleware/auth');
const { rbacMiddleware, requireRole } = require('../rbac/rbacMiddleware');
const {
  getAllEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getDepartments,
  updateDepartment,
  createDepartment,
  getOrgChart,
  addAddress,
  updateAddress,
  deleteAddress,
  addEducation,
  updateEducation,
  deleteEducation,
  addExperience,
  updateExperience,
  deleteExperience,
  addSalaryRevision,
  upsertBankDetails,
  upsertPFDetails,
  upsertExitDetails,
  addDependent,
  updateDependent,
  deleteDependent,
  uploadEmployeePhoto,
  updateAccountStage,
  getChangeHistory,
} = require('../controllers/employeeController');

// Photo upload storage
const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/photos');
    const fs = require('fs');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'photo-' + uniqueSuffix + path.extname(file.originalname));
  },
});
const photoUpload = multer({
  storage: photoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(new Error('Only image files are allowed'));
  },
});

router.get('/departments', authenticate, getDepartments);
router.post('/departments', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), createDepartment);
router.put('/departments/:id', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), updateDepartment);

router.get('/org-chart', authenticate, getOrgChart);

router.get('/:id/history', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), getChangeHistory);

router.get('/', authenticate, rbacMiddleware('EMPLOYEES', 'VIEW'), getAllEmployees);
router.get('/:id', authenticate, rbacMiddleware('EMPLOYEES', 'VIEW'), getEmployeeById);
router.post('/', authenticate, rbacMiddleware('EMPLOYEES', 'CREATE'), createEmployee);
router.put('/:id', authenticate, rbacMiddleware('EMPLOYEES', 'EDIT'), updateEmployee);
router.delete('/:id', authenticate, rbacMiddleware('EMPLOYEES', 'DELETE'), deleteEmployee);

// Address sub-resource
router.post('/:id/address', authenticate, rbacMiddleware('EMPLOYEES', 'EDIT'), addAddress);
router.put('/address/:addressId', authenticate, rbacMiddleware('EMPLOYEES', 'EDIT'), updateAddress);
router.delete('/address/:addressId', authenticate, rbacMiddleware('EMPLOYEES', 'EDIT'), deleteAddress);

// Education sub-resource
router.post('/:id/education', authenticate, rbacMiddleware('EMPLOYEES', 'EDIT'), addEducation);
router.put('/education/:eduId', authenticate, rbacMiddleware('EMPLOYEES', 'EDIT'), updateEducation);
router.delete('/education/:eduId', authenticate, rbacMiddleware('EMPLOYEES', 'EDIT'), deleteEducation);

// Experience sub-resource
router.post('/:id/experience', authenticate, rbacMiddleware('EMPLOYEES', 'EDIT'), addExperience);
router.put('/experience/:expId', authenticate, rbacMiddleware('EMPLOYEES', 'EDIT'), updateExperience);
router.delete('/experience/:expId', authenticate, rbacMiddleware('EMPLOYEES', 'EDIT'), deleteExperience);

// Salary revision
router.post('/:id/salary-revision', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), addSalaryRevision);

// Bank details
router.put('/:id/bank-details', authenticate, rbacMiddleware('EMPLOYEES', 'EDIT'), upsertBankDetails);

// PF details
router.put('/:id/pf-details', authenticate, rbacMiddleware('EMPLOYEES', 'EDIT'), upsertPFDetails);

// Exit details
router.put('/:id/exit-details', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), upsertExitDetails);

// Dependents
router.post('/:id/dependent', authenticate, rbacMiddleware('EMPLOYEES', 'EDIT'), addDependent);
router.put('/dependent/:depId', authenticate, rbacMiddleware('EMPLOYEES', 'EDIT'), updateDependent);
router.put('/dependent/:depId/inactive', authenticate, rbacMiddleware('EMPLOYEES', 'EDIT'), deleteDependent);

// Photo upload
router.post('/:id/photo', authenticate, rbacMiddleware('EMPLOYEES', 'EDIT'), photoUpload.single('photo'), uploadEmployeePhoto);

// Account stage
router.put('/:id/account-stage', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), updateAccountStage);

module.exports = router;