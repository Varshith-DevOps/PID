/**
 * @fileoverview Employee management routes.
 * Provides CRUD endpoints for employees, departments, addresses,
 * education, experience, bank details, PF, exit, dependents, and photos.
 * @module routes/employeeRoutes
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { ensureUploadDir } = require('../config/storage');
const { authenticate } = require('../middleware/auth');
const { rbacMiddleware, requireRole } = require('../rbac/rbacMiddleware');
const {
  getAllEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deactivateEmployee,
  reactivateEmployee,
  deleteEmployee,
  getDepartments,
  getDesignations,
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
const { exportEmployeeData, anonymizeEmployee } = require('../controllers/dpdpController');
const { validate } = require('../middleware/validate');
const { employeeCreateSchema } = require('../schemas/employeeSchemas');

// ──── Photo Upload Configuration (Multer v2) ──────────────────────────────

/** Ensure photo upload directory exists */
const photoDir = ensureUploadDir('photos');

/**
 * Multer storage for employee photos.
 * Photos are saved with unique timestamped filenames to prevent collisions.
 */
const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, photoDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'photo-' + uniqueSuffix + path.extname(file.originalname));
  },
});

/**
 * Photo upload handler.
 * Restricts uploads to image files only (JPEG, PNG, GIF, WebP) with a 5MB limit.
 */
const photoUpload = multer({
  storage: photoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const isValidExt = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const isValidMime = allowedTypes.test(file.mimetype);
    if (isValidExt && isValidMime) return cb(null, true);
    cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'));
  },
});

// ──── Department Routes ────────────────────────────────────────────────────

/** GET /api/employees/departments — List all active departments */
router.get('/departments', authenticate, getDepartments);

/** GET /api/employees/designations — List active employee designations */
router.get('/designations', authenticate, rbacMiddleware('EMPLOYEES', 'VIEW'), getDesignations);

/** POST /api/employees/departments — Create a new department (Admin only) */
router.post('/departments', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), createDepartment);

/** PUT /api/employees/departments/:id — Update a department (Admin only) */
router.put('/departments/:id', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), updateDepartment);

// ──── Org Chart ────────────────────────────────────────────────────────────

/** GET /api/employees/org-chart — Get organizational hierarchy */
router.get('/org-chart', authenticate, getOrgChart);

// ──── Change History ───────────────────────────────────────────────────────

/** GET /api/employees/:id/history — Get change audit log for an employee */
router.get('/:id/history', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), getChangeHistory);

// ──── DPDP / Privacy Rights ────────────────────────────────────────────────

/** GET /api/employees/:id/data-export — Right to access (self or HR/Admin). */
router.get('/:id/data-export', authenticate, exportEmployeeData);

/** POST /api/employees/:id/anonymize — Right to erasure (HR/Admin only). */
router.post('/:id/anonymize', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), anonymizeEmployee);

// ──── Employee CRUD ────────────────────────────────────────────────────────

/** GET /api/employees — List employees with optional filters */
router.get('/', authenticate, rbacMiddleware('EMPLOYEES', 'VIEW'), getAllEmployees);

/** GET /api/employees/:id — Get full employee profile */
router.get('/:id', authenticate, rbacMiddleware('EMPLOYEES', 'VIEW'), getEmployeeById);

/** POST /api/employees — Create a new employee (validation runs after authz) */
router.post('/', authenticate, rbacMiddleware('EMPLOYEES', 'CREATE'), validate(employeeCreateSchema), createEmployee);

/** PUT /api/employees/:id — Update employee details */
router.put('/:id', authenticate, rbacMiddleware('EMPLOYEES', 'EDIT'), updateEmployee);

/** PATCH /api/employees/:id/deactivate — Safely deactivate an employee without deleting history */
router.patch('/:id/deactivate', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'HR_ADMIN', 'HR'), deactivateEmployee);

/** PATCH /api/employees/:id/reactivate — Restore an inactive employee and login */
router.patch('/:id/reactivate', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'HR_ADMIN', 'HR'), reactivateEmployee);

/** DELETE /api/employees/:id — Compatibility alias for safe deactivation */
router.delete('/:id', authenticate, rbacMiddleware('EMPLOYEES', 'DELETE'), deleteEmployee);

// ──── Address Sub-resource ─────────────────────────────────────────────────

router.post('/:id/address', authenticate, rbacMiddleware('EMPLOYEES', 'EDIT'), addAddress);
router.put('/address/:addressId', authenticate, rbacMiddleware('EMPLOYEES', 'EDIT'), updateAddress);
router.delete('/address/:addressId', authenticate, rbacMiddleware('EMPLOYEES', 'EDIT'), deleteAddress);

// ──── Education Sub-resource ───────────────────────────────────────────────

router.post('/:id/education', authenticate, rbacMiddleware('EMPLOYEES', 'EDIT'), addEducation);
router.put('/education/:eduId', authenticate, rbacMiddleware('EMPLOYEES', 'EDIT'), updateEducation);
router.delete('/education/:eduId', authenticate, rbacMiddleware('EMPLOYEES', 'EDIT'), deleteEducation);

// ──── Experience Sub-resource ──────────────────────────────────────────────

router.post('/:id/experience', authenticate, rbacMiddleware('EMPLOYEES', 'EDIT'), addExperience);
router.put('/experience/:expId', authenticate, rbacMiddleware('EMPLOYEES', 'EDIT'), updateExperience);
router.delete('/experience/:expId', authenticate, rbacMiddleware('EMPLOYEES', 'EDIT'), deleteExperience);

// ──── Salary Revision ──────────────────────────────────────────────────────

router.post('/:id/salary-revision', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), addSalaryRevision);

// ──── Financial Details ────────────────────────────────────────────────────

router.put('/:id/bank-details', authenticate, rbacMiddleware('EMPLOYEES', 'EDIT'), upsertBankDetails);
router.put('/:id/pf-details', authenticate, rbacMiddleware('EMPLOYEES', 'EDIT'), upsertPFDetails);

// ──── Exit Details ─────────────────────────────────────────────────────────

router.put('/:id/exit-details', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), upsertExitDetails);

// ──── Dependents ───────────────────────────────────────────────────────────

router.post('/:id/dependent', authenticate, rbacMiddleware('EMPLOYEES', 'EDIT'), addDependent);
router.put('/dependent/:depId', authenticate, rbacMiddleware('EMPLOYEES', 'EDIT'), updateDependent);
router.put('/dependent/:depId/inactive', authenticate, rbacMiddleware('EMPLOYEES', 'EDIT'), deleteDependent);

// ──── Photo Upload ─────────────────────────────────────────────────────────

router.post('/:id/photo', authenticate, rbacMiddleware('EMPLOYEES', 'EDIT'), photoUpload.single('photo'), uploadEmployeePhoto);

// ──── Account Stage ────────────────────────────────────────────────────────

router.put('/:id/account-stage', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), updateAccountStage);

module.exports = router;
