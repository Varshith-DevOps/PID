/**
 * @fileoverview Recruitment & ATS router.
 * Defines API routing endpoints for managing openings, applications,
 * interviews, and job offers.
 * @module routes/recruitmentRoutes
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth');
const { rbacMiddleware } = require('../rbac/rbacMiddleware');

const {
  getJobOpenings,
  getJobOpeningById,
  createJobOpening,
  updateJobOpening,
  deleteJobOpening,
  getApplicants,
  applyForJob,
  updateApplicantStage,
  scheduleInterview,
  submitInterviewFeedback,
  createJobOffer,
  downloadOfferLetter,
} = require('../controllers/recruitmentController');

// ──── Resume Upload Configuration ──────────────────────────────────────────

const resumeDir = path.join(__dirname, '../../uploads/resumes');
if (!fs.existsSync(resumeDir)) {
  fs.mkdirSync(resumeDir, { recursive: true });
}

const resumeStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, resumeDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'resume-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: resumeStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx/;
    const isValidExt = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const isValidMime = allowedTypes.test(file.mimetype) || file.mimetype === 'application/octet-stream';
    if (isValidExt && isValidMime) return cb(null, true);
    cb(new Error('Only document files (PDF, DOC, DOCX) are allowed'));
  },
});

// ──── Routes ───────────────────────────────────────────────────────────────

// Job Openings
router.get('/jobs', authenticate, getJobOpenings);
router.get('/jobs/:id', authenticate, getJobOpeningById);
router.post('/jobs', authenticate, rbacMiddleware('EMPLOYEES', 'CREATE'), createJobOpening);
router.put('/jobs/:id', authenticate, rbacMiddleware('EMPLOYEES', 'EDIT'), updateJobOpening);
router.delete('/jobs/:id', authenticate, rbacMiddleware('EMPLOYEES', 'DELETE'), deleteJobOpening);

// Applicants
router.get('/applicants', authenticate, getApplicants);
router.post('/applicants', upload.single('resume'), applyForJob); // Allow public/employee submission
router.put('/applicants/:id/stage', authenticate, rbacMiddleware('EMPLOYEES', 'EDIT'), updateApplicantStage);

// Interviews
router.post('/interviews', authenticate, rbacMiddleware('EMPLOYEES', 'CREATE'), scheduleInterview);
router.put('/interviews/:id', authenticate, rbacMiddleware('EMPLOYEES', 'EDIT'), submitInterviewFeedback);

// Offers
router.post('/offers', authenticate, rbacMiddleware('EMPLOYEES', 'CREATE'), createJobOffer);
router.get('/offers/:id/pdf', authenticate, downloadOfferLetter);

module.exports = router;
