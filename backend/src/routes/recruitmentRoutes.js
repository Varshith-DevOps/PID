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
const { ensureUploadDir } = require('../config/storage');
const { authenticate } = require('../middleware/auth');
const { rbacMiddleware } = require('../rbac/rbacMiddleware');
const { publicApplicationLimiter } = require('../middleware/rateLimit');

const {
  getJobOpenings,
  getCareerConnectJobs,
  getCareerPortalJobById,
  getJobOpeningById,
  createJobOpening,
  updateJobOpening,
  expireJobOpening,
  deleteJobOpening,
  getApplicants,
  applyForJob,
  updateApplicantStage,
  updateApplicantEvaluation,
  getApplicantReviews,
  createApplicantReview,
  getApplicantAiAssessments,
  runApplicantAiScreening,
  approveApplicantAiAssessment,
  scheduleInterview,
  resendInterviewEmail,
  submitInterviewFeedback,
  getApplicantOffers,
  createJobOffer,
  getJobOffer,
  updateJobOffer,
  generateJobOfferPdf,
  downloadOfferLetter,
  sendJobOffer,
  cancelJobOffer,
} = require('../controllers/recruitmentController');

// ──── Resume Upload Configuration ──────────────────────────────────────────

const resumeDir = ensureUploadDir('resumes');

const resumeStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, resumeDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'resume-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: resumeStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    const isValidExt = ['.pdf', '.doc', '.docx'].includes(path.extname(file.originalname).toLowerCase());
    const isValidMime = allowedMimeTypes.includes(String(file.mimetype).toLowerCase());
    if (isValidExt && isValidMime) return cb(null, true);
    cb(new Error('Only document files (PDF, DOC, DOCX) are allowed'));
  },
});

const fileSignatures = {
  '.pdf': [(buf) => buf.subarray(0, 4).equals(Buffer.from('%PDF'))],
  '.doc': [(buf) => buf.subarray(0, 8).equals(Buffer.from('D0CF11E0A1B11AE1', 'hex'))],
  '.docx': [
    (buf) => buf.subarray(0, 4).equals(Buffer.from('504B0304', 'hex')),
    (buf) => buf.subarray(0, 4).equals(Buffer.from('504B0506', 'hex')),
    (buf) => buf.subarray(0, 4).equals(Buffer.from('504B0708', 'hex')),
  ],
};

const validateResumeSignature = (req, res, next) => {
  if (!req.file) return next();
  const ext = path.extname(req.file.originalname).toLowerCase();
  const validators = fileSignatures[ext] || [];
  const fd = fs.openSync(req.file.path, 'r');
  const buffer = Buffer.alloc(16);
  try {
    fs.readSync(fd, buffer, 0, buffer.length, 0);
  } finally {
    fs.closeSync(fd);
  }

  if (!validators.some((validator) => validator(buffer))) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'Resume file content does not match the declared document type.' });
  }

  // Full antivirus scanning should be performed by deployment infrastructure.
  // This gate prevents trivial polyglot/spoofed uploads before persistence.
  next();
};

const validateResumeSafety = (req, res, next) => {
  if (!req.file) return next();
  const content = fs.readFileSync(req.file.path);
  const eicarSignature = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!';
  if (content.includes(Buffer.from(eicarSignature))) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'Resume failed malware safety checks.' });
  }
  next();
};

// ──── Routes ───────────────────────────────────────────────────────────────

// Job Openings
  router.get('/career-connect/jobs', authenticate, rbacMiddleware('RECRUITMENT', 'VIEW'), getCareerConnectJobs);
  router.get('/career-portal/jobs', getCareerConnectJobs);
  router.get('/career-portal/jobs/:id', getCareerPortalJobById);
  router.get('/jobs', authenticate, getJobOpenings);
  router.get('/jobs/:id', authenticate, getJobOpeningById);
  router.post('/jobs', authenticate, rbacMiddleware('RECRUITMENT', 'CREATE'), createJobOpening);
  router.put('/jobs/:id', authenticate, rbacMiddleware('RECRUITMENT', 'EDIT'), updateJobOpening);
  router.patch('/jobs/:id/expire', authenticate, rbacMiddleware('RECRUITMENT', 'EDIT'), expireJobOpening);
  router.delete('/jobs/:id', authenticate, deleteJobOpening);
  router.post('/jobs/:id/delete', authenticate, deleteJobOpening);

// Applicants
router.get('/applicants', authenticate, rbacMiddleware('RECRUITMENT', 'VIEW'), getApplicants);
router.post('/applicants', publicApplicationLimiter, (req, res, next) => {
  upload.single('resume')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size too large. Maximum limit is 5MB.' });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, validateResumeSignature, validateResumeSafety, applyForJob); // Allow public/employee submission
router.patch('/applicants/:id/evaluation', authenticate, rbacMiddleware('RECRUITMENT', 'EDIT'), updateApplicantEvaluation);
router.get('/applicants/:applicantId/reviews', authenticate, rbacMiddleware('RECRUITMENT', 'VIEW'), getApplicantReviews);
router.post('/applicants/:applicantId/reviews', authenticate, rbacMiddleware('RECRUITMENT', 'EDIT'), createApplicantReview);
router.get('/applicants/:id/ai-assessments', authenticate, rbacMiddleware('RECRUITMENT', 'VIEW'), getApplicantAiAssessments);
router.post('/applicants/:id/ai-screenings', authenticate, rbacMiddleware('RECRUITMENT', 'EDIT'), runApplicantAiScreening);
router.post('/applicants/:id/ai-assessments/:workflowId/approval', authenticate, rbacMiddleware('RECRUITMENT', 'EDIT'), approveApplicantAiAssessment);
router.put('/applicants/:id/stage', authenticate, rbacMiddleware('RECRUITMENT', 'EDIT'), updateApplicantStage);

// Interviews
router.post('/interviews', authenticate, rbacMiddleware('RECRUITMENT', 'CREATE'), scheduleInterview);
router.post('/interviews/:id/resend-email', authenticate, rbacMiddleware('RECRUITMENT', 'EDIT'), resendInterviewEmail);
router.put('/interviews/:id', authenticate, rbacMiddleware('RECRUITMENT', 'EDIT'), submitInterviewFeedback);

// Offers
router.get('/applicants/:applicantId/offers', authenticate, rbacMiddleware('RECRUITMENT', 'VIEW'), getApplicantOffers);
router.post('/applicants/:applicantId/offers', authenticate, rbacMiddleware('RECRUITMENT', 'CREATE'), createJobOffer);
router.post('/offers', authenticate, rbacMiddleware('RECRUITMENT', 'CREATE'), createJobOffer);
router.get('/offers/:id', authenticate, rbacMiddleware('RECRUITMENT', 'VIEW'), getJobOffer);
router.patch('/offers/:id', authenticate, rbacMiddleware('RECRUITMENT', 'EDIT'), updateJobOffer);
router.post('/offers/:id/generate', authenticate, rbacMiddleware('RECRUITMENT', 'EDIT'), generateJobOfferPdf);
router.post('/offers/:id/send', authenticate, rbacMiddleware('RECRUITMENT', 'EDIT'), sendJobOffer);
router.post('/offers/:id/resend', authenticate, rbacMiddleware('RECRUITMENT', 'EDIT'), sendJobOffer);
router.post('/offers/:id/cancel', authenticate, rbacMiddleware('RECRUITMENT', 'EDIT'), cancelJobOffer);
router.get('/offers/:id/download', authenticate, rbacMiddleware('RECRUITMENT', 'VIEW'), downloadOfferLetter);
router.get('/offers/:id/pdf', authenticate, rbacMiddleware('RECRUITMENT', 'VIEW'), downloadOfferLetter);

module.exports = router;
