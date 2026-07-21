/**
 * @fileoverview Recruitment & Applicant Tracking System (ATS) controller.
 * Handles job postings, applicant tracking (Kanban stages),
 * interview scheduling, and job offer letter generation.
 * @module controllers/recruitmentController
 */

const prisma = require('../config/database');
const { deliverInterviewScheduledEmail } = require('../services/interviewEmailService');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const { generateOfferLetterPdf } = require('../services/offerLetterPdfService');
const { buildOfferFileName, writeOfferPdf, readOfferPdf } = require('../services/offerLetterStorageService');
const { deliverOfferLetterEmail } = require('../services/offerLetterEmailService');
const recruitmentStages = require('../config/recruitmentStages.json');
const { callAiService, formatAssessment } = require('../services/aiRecruitmentService');

const APPLICANT_SOURCES = new Set(['MANUAL', 'SOCIAL_MEDIA', 'CAREER_PORTAL']);
const NOTICE_PERIODS = new Set([
  'Immediate',
  '15 Days',
  '30 Days',
  '45 Days',
  '60 Days',
  '90 Days',
  'More than 90 Days',
]);
const ACTIVE_APPLICANT_STAGE_ORDER = recruitmentStages.activeStageOrder;
const TERMINAL_APPLICANT_STAGE = recruitmentStages.terminalStage;
const INTERVIEW_APPLICANT_STAGE = recruitmentStages.interviewStage;
const OFFER_EXTENDED_APPLICANT_STAGE = recruitmentStages.offerExtendedStage;
const ONBOARDING_APPLICANT_STAGE = recruitmentStages.onboardingStage;

const cleanText = (value) => {
  const trimmed = String(value ?? '').trim();
  return trimmed || null;
};

const hasNegativeAmount = (value) => /^\s*-/.test(String(value ?? '')) || /-\s*\d/.test(String(value ?? ''));
const isValidEmailAddress = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

const validateCareerPortalCompensation = ({ currentCtc, expectedCtc, noticePeriod }) => {
  if (!currentCtc) return 'Current CTC is required.';
  if (!expectedCtc) return 'Expected CTC is required.';
  if (hasNegativeAmount(currentCtc)) return 'Current CTC cannot be negative.';
  if (hasNegativeAmount(expectedCtc)) return 'Expected CTC cannot be negative.';
  if (!noticePeriod) return 'Notice Period is required.';
  if (!NOTICE_PERIODS.has(noticePeriod)) return 'Select a valid Notice Period.';
  return null;
};

const getAllowedApplicantStageTransitions = (currentStage) => {
  if (currentStage === TERMINAL_APPLICANT_STAGE) return [];
  const currentIndex = ACTIVE_APPLICANT_STAGE_ORDER.indexOf(currentStage);
  if (currentIndex === -1) return [];

  return [...ACTIVE_APPLICANT_STAGE_ORDER.slice(currentIndex + 1), TERMINAL_APPLICANT_STAGE];
};

const validateApplicantStageTransition = (currentStage, requestedStage) => {
  if (currentStage === requestedStage) return 'Candidate can only move forward in the recruitment pipeline.';
  const allowedStages = getAllowedApplicantStageTransitions(currentStage);
  if (allowedStages.includes(requestedStage)) return null;

  return 'Candidate can only move forward in the recruitment pipeline.';
};

const validateInterviewSchedulingStage = (stage) => {
  if (stage !== INTERVIEW_APPLICANT_STAGE) return 'Interview rounds can only be scheduled when the candidate is in the Interviews stage.';
  return null;
};

const parseFutureDate = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed <= new Date()) return null;
  return parsed;
};

const INTERVIEW_MODES = new Set(['ONLINE', 'IN_PERSON', 'PHONE']);
const ACTIVE_OFFER_STATUSES = ['DRAFT', 'GENERATED', 'SENT', 'VIEWED', 'ACCEPTED'];
const OFFER_CREATABLE_STAGES = [OFFER_EXTENDED_APPLICANT_STAGE];
const OFFER_READONLY_STAGES = [ONBOARDING_APPLICANT_STAGE];
const OFFER_MANAGE_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'HR_ADMIN', 'HR', 'RECRUITER']);
const JOB_MANAGE_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'HR_ADMIN', 'HR', 'RECRUITER']);
const JOB_DELETE_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'HR_ADMIN']);
const JOB_CLOSE_REASONS = new Set(['POSITION_FILLED', 'HIRING_PAUSED', 'REQUIREMENT_CANCELLED', 'BUDGET_HOLD', 'EXPIRED', 'OTHER']);

const normalizeOfferStatus = (status) => status === 'DECLINED' ? 'REJECTED' : status;

const toDecimalNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const hashOfferToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const getActor = (req) => req.user?.email || req.user?.id || 'system';

const logOfferAudit = async (req, action, offer, extra = {}) => {
  try {
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id || null,
        userEmail: req.user?.email || null,
        actorRole: req.user?.role || null,
        category: 'TENANT',
        action,
        entity: 'JobOffer',
        entityId: offer?.id || null,
        newDetails: JSON.stringify({
          offerId: offer?.id || null,
          applicantId: offer?.applicantId || null,
          ...extra,
        }),
        ipAddress: req.ip || null,
      },
    });
  } catch (error) {
    console.error('[OFFER AUDIT ERROR]:', error.message);
  }
};

const canManageOffers = (user) => Boolean(user?.role && OFFER_MANAGE_ROLES.has(user.role));
const canManageJobRequisitions = (user) => Boolean(user?.role && JOB_MANAGE_ROLES.has(user.role));
const canDeleteJobRequisitions = (user) => Boolean(user?.role && JOB_DELETE_ROLES.has(user.role));
const canRunAiScreening = (user) => Boolean(user?.role && JOB_MANAGE_ROLES.has(user.role));

const logJobAudit = async (req, action, job, extra = {}, tx = prisma) => {
  try {
    await tx.auditLog.create({
      data: {
        userId: req.user?.id || null,
        userEmail: req.user?.email || null,
        actorRole: req.user?.role || null,
        category: 'TENANT',
        action,
        entity: 'JobOpening',
        entityId: job?.id || null,
        newDetails: JSON.stringify({
          jobId: job?.id || null,
          title: job?.title || null,
          reason: extra.reason || undefined,
          remarks: extra.remarks || undefined,
        }),
        ipAddress: req.ip || null,
      },
    });
  } catch (error) {
    console.error('[JOB AUDIT ERROR]:', error.message);
  }
};

const validateOfferInput = (body, { requireAll = true } = {}) => {
  const requiredFields = [
    'offeredCtc',
    'workLocation',
    'employmentType',
    'joiningDate',
    'reportingManager',
    'signatoryName',
    'signatoryDesignation',
  ];
  if (requireAll) {
    const missing = requiredFields.filter((field) => !String(body[field] ?? '').trim());
    if (missing.length) return { error: `Missing required offer fields: ${missing.join(', ')}` };
  }

  const amounts = ['offeredCtc', 'basicSalary', 'hra', 'specialAllowance', 'otherAllowances', 'variablePay', 'joiningBonus'];
  const parsedAmounts = {};
  for (const field of amounts) {
    const parsed = toDecimalNumber(body[field]);
    if (Number.isNaN(parsed)) return { error: `${field} must be a valid amount.` };
    if (parsed !== null && parsed < 0) return { error: `${field} cannot be negative.` };
    parsedAmounts[field] = parsed;
  }
  if ((parsedAmounts.offeredCtc ?? 0) <= 0) return { error: 'Offered CTC must be greater than zero.' };

  const joiningDate = new Date(body.joiningDate);
  if (Number.isNaN(joiningDate.getTime())) return { error: 'Joining date must be valid.' };
  const rawOfferExpiryDate = cleanText(body.offerExpiryDate);
  let offerExpiryDate = null;
  if (rawOfferExpiryDate) {
    offerExpiryDate = new Date(rawOfferExpiryDate);
    if (Number.isNaN(offerExpiryDate.getTime())) return { error: 'Offer expiry date is invalid.' };
    if (offerExpiryDate >= joiningDate) return { error: 'Offer expiry date must be before the joining date.' };
  }

  return {
    values: {
      offeredSalary: parsedAmounts.offeredCtc,
      offeredCtc: parsedAmounts.offeredCtc,
      basicSalary: parsedAmounts.basicSalary,
      hra: parsedAmounts.hra,
      specialAllowance: parsedAmounts.specialAllowance,
      otherAllowances: parsedAmounts.otherAllowances,
      variablePay: parsedAmounts.variablePay,
      joiningBonus: parsedAmounts.joiningBonus,
      workLocation: cleanText(body.workLocation),
      employmentType: cleanText(body.employmentType),
      joiningDate,
      probationPeriod: cleanText(body.probationPeriod),
      noticePeriod: cleanText(body.noticePeriod),
      reportingManager: cleanText(body.reportingManager),
      reportingManagerTitle: cleanText(body.reportingManagerTitle),
      workingHours: cleanText(body.workingHours),
      offerExpiryDate,
      additionalTerms: cleanText(body.additionalTerms),
      signatoryName: cleanText(body.signatoryName),
      signatoryDesignation: cleanText(body.signatoryDesignation),
    },
  };
};

const normalizeInterviewDetails = ({ interviewMode, meetingLink, location, instructions }) => {
  const mode = String(interviewMode || 'ONLINE').trim().toUpperCase();
  const link = cleanText(meetingLink);
  const place = cleanText(location);
  const notes = cleanText(instructions);

  if (!INTERVIEW_MODES.has(mode)) return { error: 'Select a valid interview mode.' };
  if (mode === 'ONLINE' && !link) return { error: 'Meeting link is required for online interviews.' };
  if (mode === 'IN_PERSON' && !place) return { error: 'Location is required for in-person interviews.' };

  return {
    interviewMode: mode,
    meetingLink: link,
    location: place,
    instructions: notes,
  };
};

const interviewResponseMessage = (emailStatus) => emailStatus === 'SENT'
  ? 'Interview scheduled and email sent successfully.'
  : 'Interview scheduled, but the email could not be delivered.';

const formatCandidateReview = (review) => ({
  id: review.id,
  reviewerName: review.reviewerName,
  reviewerRole: review.reviewerRole,
  rating: review.rating,
  reviewText: review.reviewText,
  candidateStage: review.candidateStage,
  reviewType: review.reviewType || 'GENERAL_REVIEW',
  interviewRoundId: review.interviewRoundId || null,
  interviewRoundName: review.interviewRoundName || null,
  createdAt: review.createdAt,
  updatedAt: review.updatedAt,
});

const formatInterviewFeedbackReview = (interview) => ({
  id: `interview-${interview.id}`,
  reviewerName: interview.interviewerName,
  reviewerRole: 'Interviewer',
  rating: interview.rating,
  reviewText: interview.feedback,
  candidateStage: INTERVIEW_APPLICANT_STAGE,
  reviewType: 'INTERVIEW_FEEDBACK',
  interviewRoundId: interview.id,
  interviewRoundName: interview.roundName,
  createdAt: interview.updatedAt || interview.createdAt,
  updatedAt: interview.updatedAt,
});

const careerConnectJobSelect = {
  id: true,
  title: true,
  location: true,
  employmentType: true,
  salaryRange: true,
  status: true,
  createdAt: true,
  department: { select: { id: true, name: true } },
};

// ──── Job Openings ─────────────────────────────────────────────────────────

/**
 * List all job openings with applicant counts.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const getJobOpenings = async (req, res) => {
  try {
    const jobs = await prisma.jobOpening.findMany({
      include: {
        department: { select: { id: true, name: true } },
        _count: { select: { applicants: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(jobs);
  } catch (error) {
    console.error('[GET JOB OPENINGS ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * List active organization jobs for Career Connect.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const getCareerConnectJobs = async (req, res) => {
  try {
    const jobs = await prisma.jobOpening.findMany({
      where: {
        status: 'OPEN',
        ...(req.user?.companyId ? { companyId: req.user.companyId } : {}),
      },
      select: careerConnectJobSelect,
      orderBy: { createdAt: 'desc' },
    });

    res.json(jobs);
  } catch (error) {
    console.error('[GET CAREER CONNECT JOBS ERROR]:', error.message);
    res.status(500).json({ error: 'Unable to load organization career portal jobs.' });
  }
};

/**
 * Get a single active job for the organization career portal application page.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const getCareerPortalJobById = async (req, res) => {
  try {
    const { id } = req.params;
    const job = await prisma.jobOpening.findFirst({
      where: {
        id,
      },
      select: {
        ...careerConnectJobSelect,
        description: true,
        requirements: true,
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job opening not found' });
    }
    if (job.status !== 'OPEN') {
      return res.status(410).json({ error: 'This job opening is no longer accepting applications.' });
    }

    res.json(job);
  } catch (error) {
    console.error('[GET CAREER PORTAL JOB ERROR]:', error.message);
    res.status(500).json({ error: 'Unable to load career portal job.' });
  }
};

/**
 * Get details of a single job opening with its applicants.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const getJobOpeningById = async (req, res) => {
  try {
    const { id } = req.params;
    const job = await prisma.jobOpening.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true } },
        applicants: {
          include: {
            interviews: true,
            jobOffer: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job opening not found' });
    }

    res.json(job);
  } catch (error) {
    console.error('[GET JOB DETAIL ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Create a new job opening.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const createJobOpening = async (req, res) => {
  try {
    const { title, departmentId, description, requirements, location, employmentType, salaryRange, status } = req.body;

    if (!title || !departmentId || !description || !requirements || !location) {
      return res.status(400).json({ error: 'Required fields are missing' });
    }

    const job = await prisma.jobOpening.create({
      data: {
        title,
        departmentId,
        description,
        requirements,
        location,
        employmentType: employmentType || 'FULL_TIME',
        salaryRange,
        status: status || 'OPEN',
      },
      include: { department: { select: { id: true, name: true } } },
    });

    res.status(201).json(job);
  } catch (error) {
    console.error('[CREATE JOB ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Update an existing job opening.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const updateJobOpening = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, departmentId, description, requirements, location, employmentType, salaryRange, status } = req.body;

    const job = await prisma.jobOpening.update({
      where: { id },
      data: {
        title,
        departmentId,
        description,
        requirements,
        location,
        employmentType,
        salaryRange,
        status,
      },
      include: { department: { select: { id: true, name: true } } },
    });

    res.json(job);
  } catch (error) {
    console.error('[UPDATE JOB ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Expire a job requisition while preserving recruitment history.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const expireJobOpening = async (req, res) => {
  try {
    if (!canManageJobRequisitions(req.user)) {
      return res.status(403).json({ error: 'You are not authorized to manage job requisitions.' });
    }

    const { id } = req.params;
    const reason = cleanText(req.body?.reason) || 'EXPIRED';
    const remarks = cleanText(req.body?.remarks);
    if (!JOB_CLOSE_REASONS.has(reason)) {
      return res.status(400).json({ error: 'Invalid expiry reason.' });
    }

    const existing = await prisma.jobOpening.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true } },
        _count: { select: { applicants: true } },
      },
    });
    if (!existing) return res.status(404).json({ error: 'Job requisition not found.' });
    if (existing.status === 'CLOSED') return res.status(400).json({ error: 'Job is already closed.' });

    const job = await prisma.jobOpening.update({
      where: { id },
      data: { status: 'CLOSED' },
      include: {
        department: { select: { id: true, name: true } },
        _count: { select: { applicants: true } },
      },
    });

    await logJobAudit(req, 'JOB_REQUISITION_EXPIRED', job, { reason, remarks });
    res.json({ message: 'Job requisition expired successfully.', job });
  } catch (error) {
    console.error('[EXPIRE JOB ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Delete an empty job opening only. Jobs with recruitment history are preserved.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const deleteJobOpening = async (req, res) => {
  try {
    if (!canDeleteJobRequisitions(req.user)) {
      return res.status(403).json({ error: 'You are not authorized to manage job requisitions.' });
    }
    const { id } = req.params;
    if (req.body?.confirmation !== 'DELETE') {
      return res.status(400).json({ error: 'Type DELETE to confirm.' });
    }

    const job = await prisma.jobOpening.findUnique({
      where: { id },
      include: {
        _count: { select: { applicants: true } },
      },
    });
    if (!job) return res.status(404).json({ error: 'Job requisition not found.' });

    const auditCount = await prisma.auditLog.count({
      where: {
        entity: 'JobOpening',
        entityId: id,
        action: { not: 'JOB_REQUISITION_DELETED' },
      },
    });
    if (job._count.applicants > 0 || auditCount > 0) {
      return res.status(400).json({ error: 'This job cannot be deleted because recruitment activity already exists. Expire the job instead.' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.jobOpening.delete({ where: { id } });
      await logJobAudit(req, 'JOB_REQUISITION_DELETED', job, { reason: 'DELETE_CONFIRMED' }, tx);
    });
    res.json({ message: 'Job requisition deleted successfully.' });
  } catch (error) {
    console.error('[DELETE JOB ERROR]:', error.message);
    if (error?.code === 'P2025') return res.status(404).json({ error: 'Job requisition not found.' });
    res.status(500).json({ error: 'Server error' });
  }
};

// ──── Job Applicants ───────────────────────────────────────────────────────

/**
 * List applicants with optional filters.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const getApplicants = async (req, res) => {
  try {
    const { jobOpeningId, stage } = req.query;
    const filter = {};
    if (jobOpeningId) filter.jobOpeningId = jobOpeningId;
    if (stage) filter.stage = stage;

    const applicants = await prisma.jobApplicant.findMany({
      where: filter,
      include: {
        jobOpening: {
          select: {
            id: true,
            title: true,
            department: { select: { name: true } },
          },
        },
        interviews: true,
        jobOffer: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(applicants);
  } catch (error) {
    console.error('[GET APPLICANTS ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Submit a job application.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const applyForJob = async (req, res) => {
  try {
    const { jobOpeningId, fullName, email, phone, coverLetter, experience, skills, source } = req.body;

    const applicantSource = source ? String(source).trim().toUpperCase() : 'CAREER_PORTAL';
    if (!APPLICANT_SOURCES.has(applicantSource)) {
      return res.status(400).json({ error: 'Invalid applicant source' });
    }

    const normalized = {
      jobOpeningId: cleanText(jobOpeningId),
      fullName: cleanText(fullName),
      email: cleanText(email),
      phone: cleanText(phone),
      coverLetter: cleanText(coverLetter),
      experience: cleanText(experience),
      skills: cleanText(skills),
      currentCtc: cleanText(req.body.currentCtc),
      expectedCtc: cleanText(req.body.expectedCtc),
      noticePeriod: cleanText(req.body.noticePeriod),
    };

    if (!normalized.jobOpeningId || !normalized.fullName || !normalized.email || !normalized.phone) {
      return res.status(400).json({ error: 'Required applicant details missing' });
    }

    if (applicantSource === 'CAREER_PORTAL') {
      const validationError = validateCareerPortalCompensation(normalized);
      if (validationError) return res.status(400).json({ error: validationError });
    }

    const job = await prisma.jobOpening.findUnique({
      where: { id: normalized.jobOpeningId },
      select: { id: true, title: true, status: true },
    });
    if (!job) return res.status(404).json({ error: 'Job opening not found' });
    if (job.status !== 'OPEN') {
      return res.status(400).json({ error: 'This job opening is no longer accepting applications.' });
    }

    // Check for duplicate applicant for this specific job opening by email or phone number
    const existingApplicant = await prisma.jobApplicant.findFirst({
      where: {
        jobOpeningId: normalized.jobOpeningId,
        OR: [
          { email: normalized.email },
          { phone: normalized.phone }
        ]
      }
    });

    if (existingApplicant) {
      return res.status(400).json({ error: 'A candidate with this email or phone number has already applied for this position.' });
    }

    let resumeUrl = null;
    if (req.file) {
      resumeUrl = `resumes/${req.file.filename}`;
    }

    const applicant = await prisma.jobApplicant.create({
      data: {
        jobOpeningId: normalized.jobOpeningId,
        fullName: normalized.fullName,
        email: normalized.email,
        phone: normalized.phone,
        coverLetter: normalized.coverLetter,
        resumeUrl,
        experience: normalized.experience,
        skills: normalized.skills,
        currentCtc: normalized.currentCtc,
        expectedCtc: normalized.expectedCtc,
        noticePeriod: normalized.noticePeriod,
        source: applicantSource,
        stage: 'APPLIED',
      },
    });

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully.',
      application: {
        id: applicant.id,
        candidateName: applicant.fullName,
        jobId: job.id,
        jobTitle: job.title,
        createdAt: applicant.createdAt,
      },
    });
  } catch (error) {
    console.error('[SUBMIT APPLICATION ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Update candidate stage (e.g. Applied -> Interview -> Hired)
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const updateApplicantStage = async (req, res) => {
  try {
    const { id } = req.params;
    const { stage, rating, notes } = req.body;

    const existingApplicant = await prisma.jobApplicant.findUnique({
      where: { id },
      select: { id: true, stage: true },
    });
    if (!existingApplicant) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const requestedStage = stage || existingApplicant.stage;
    const isMetadataOnlyUpdate = requestedStage === existingApplicant.stage
      && (Object.prototype.hasOwnProperty.call(req.body, 'rating') || Object.prototype.hasOwnProperty.call(req.body, 'notes'));
    const transitionError = isMetadataOnlyUpdate ? null : validateApplicantStageTransition(existingApplicant.stage, requestedStage);
    if (transitionError) {
      return res.status(400).json({ error: transitionError });
    }

    const applicant = await prisma.jobApplicant.update({
      where: { id },
      data: { stage: requestedStage, rating, notes },
    });

    // ──── AUTOMATION: Recruitment → Onboarding Pipeline ────
    // When a candidate reaches ONBOARDING, automatically:
    //   1. Create an Employee record with accountStage = 'ONBOARDING'
    //   2. Create a linked User account  
    //   3. Auto-instantiate the first matching ONBOARDING checklist template
    if (existingApplicant.stage !== ONBOARDING_APPLICANT_STAGE && requestedStage === ONBOARDING_APPLICANT_STAGE) {
      const fullApplicant = await prisma.jobApplicant.findUnique({
        where: { id },
        include: {
          jobOpening: true,
          jobOffer: true,
        },
      });

      if (fullApplicant) {
        const existingEmp = await prisma.employee.findUnique({ where: { email: fullApplicant.email } });
        const existingUser = await prisma.user.findUnique({ where: { email: fullApplicant.email } });
        if (!existingEmp && !existingUser) {
          const { hashPassword } = require('../utils/password');
          const { generateTempPassword } = require('../services/validators');
          const tempPassword = generateTempPassword();
          const hashedPassword = await hashPassword(tempPassword);

          const { getDefaultPermissions } = require('./permissionController');

          const user = await prisma.user.create({
            data: {
              email: fullApplicant.email,
              password: hashedPassword,
              name: fullApplicant.fullName,
              role: 'EMPLOYEE',
              mustChangePassword: true,
              permissions: {
                create: getDefaultPermissions('EMPLOYEE'),
              },
            },
          });

          const count = await prisma.employee.count();
          const employeeId = `EMP${String(count + 1).padStart(5, '0')}`;

          const names = fullApplicant.fullName.split(' ');
          const firstName = names[0];
          const lastName = names.slice(1).join(' ') || 'Employee';
          const salaryVal = fullApplicant.jobOffer?.offeredSalary || 60000;

          const newEmployee = await prisma.employee.create({
            data: {
              employeeId,
              userId: user.id,
              firstName,
              lastName,
              email: fullApplicant.email,
              phone: fullApplicant.phone,
              jobTitle: fullApplicant.jobOpening.title,
              departmentId: fullApplicant.jobOpening.departmentId,
              salary: salaryVal,
              employmentType: fullApplicant.jobOpening.employmentType || 'FULL_TIME',
              joinDate: fullApplicant.jobOffer?.joiningDate || new Date(),
              location: fullApplicant.jobOpening.location || null,
              accountStage: ONBOARDING_APPLICANT_STAGE,
              isActive: true,
            },
          });

          // ──── AUTO-INSTANTIATE ONBOARDING CHECKLIST ────
          // Find the first available onboarding template and create tasks for this employee
          const onboardingTemplate = await prisma.checklistTemplate.findFirst({
            where: { type: 'ONBOARDING' },
            include: { tasks: { orderBy: { order: 'asc' } } },
          });

          if (onboardingTemplate && onboardingTemplate.tasks.length > 0) {
            for (const t of onboardingTemplate.tasks) {
              await prisma.employeeChecklistTask.create({
                data: {
                  employeeId: newEmployee.id,
                  type: 'ONBOARDING',
                  title: t.title,
                  description: t.description || null,
                  status: 'PENDING',
                },
              });
            }
            console.log(`[AUTOMATION] Auto-instantiated ${onboardingTemplate.tasks.length} onboarding tasks from "${onboardingTemplate.name}" for ${fullApplicant.fullName}`);
          }

          console.log(`[AUTOMATION] Recruitment→Onboarding: Created employee ${employeeId} (${fullApplicant.fullName}) in ONBOARDING stage`);
        }
      }
    }

    res.json(applicant);
  } catch (error) {
    console.error('[UPDATE STAGE ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// ──── Interviews ───────────────────────────────────────────────────────────

/**
 * Schedule a interview round.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const updateApplicantEvaluation = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, reviewNotes, notes, updatedAt } = req.body;

    const existingApplicant = await prisma.jobApplicant.findUnique({
      where: { id },
      select: { id: true, rating: true, notes: true, stage: true, updatedAt: true },
    });
    if (!existingApplicant) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    if (updatedAt && new Date(updatedAt).getTime() !== existingApplicant.updatedAt.getTime()) {
      return res.status(409).json({ error: 'This record was updated by another user. Refresh before saving.' });
    }

    const nextNotes = String(reviewNotes ?? notes ?? '').trim();
    if (nextNotes.length > 5000) {
      return res.status(400).json({ error: 'Review notes cannot exceed 5000 characters.' });
    }

    const nextRating = rating === undefined || rating === null || rating === ''
      ? null
      : Number(rating);
    if (nextRating !== null && (!Number.isInteger(nextRating) || nextRating < 0 || nextRating > 5)) {
      return res.status(400).json({ error: 'Rating must be a whole number between 0 and 5.' });
    }

    const applicant = await prisma.jobApplicant.update({
      where: { id },
      data: {
        rating: nextRating,
        notes: nextNotes,
      },
      select: {
        id: true,
        rating: true,
        notes: true,
        stage: true,
        updatedAt: true,
      },
    });

    res.json({
      success: true,
      candidate: {
        ...applicant,
        reviewNotes: applicant.notes,
      },
    });
  } catch (error) {
    console.error('[UPDATE APPLICANT EVALUATION ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const getApplicantReviews = async (req, res) => {
  try {
    const { applicantId } = req.params;
    const applicant = await prisma.jobApplicant.findUnique({
      where: { id: applicantId },
      select: {
        id: true,
        rating: true,
        notes: true,
        stage: true,
        updatedAt: true,
        reviews: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        interviews: {
          where: {
            feedback: { not: null },
          },
          select: {
            id: true,
            interviewerName: true,
            roundName: true,
            feedback: true,
            rating: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!applicant) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const reviews = applicant.reviews.map(formatCandidateReview);
    const interviewReviews = applicant.interviews
      .filter((interview) => interview.feedback)
      .map(formatInterviewFeedbackReview);
    const legacyReviews = reviews.length === 0 && (applicant.notes || applicant.rating)
      ? [{
          id: `legacy-${applicant.id}`,
          reviewerName: 'Legacy review',
          reviewerRole: 'Recruitment',
          rating: applicant.rating || 0,
          reviewText: applicant.notes || '',
          candidateStage: applicant.stage,
          reviewType: 'LEGACY_REVIEW',
          interviewRoundId: null,
          interviewRoundName: null,
          createdAt: applicant.updatedAt,
          updatedAt: applicant.updatedAt,
        }]
      : [];

    const combined = [...reviews, ...interviewReviews, ...legacyReviews]
      .filter((review) => review.reviewText || review.rating)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({ success: true, reviews: combined });
  } catch (error) {
    console.error('[GET APPLICANT REVIEWS ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const getApplicantAiAssessments = async (req, res) => {
  try {
    const assessments = await prisma.aiCandidateAssessment.findMany({
      where: { applicationId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ assessments: assessments.map(formatAssessment), currentAssessment: formatAssessment(assessments[0]) });
  } catch (error) {
    console.error('[GET AI ASSESSMENTS ERROR]:', error.message);
    res.status(500).json({ error: 'Unable to load AI assessments.' });
  }
};

const runApplicantAiScreening = async (req, res) => {
  try {
    if (!canRunAiScreening(req.user)) {
      return res.status(403).json({ code: 'RECRUITER_ACCESS_DENIED', error: 'You are not authorized to run AI screening.' });
    }
    const applicant = await prisma.jobApplicant.findUnique({
      where: { id: req.params.id },
      include: { jobOpening: true },
    });
    if (!applicant) return res.status(404).json({ code: 'APPLICATION_NOT_FOUND', error: 'Candidate application not found.' });
    if (!applicant.resumeUrl && !applicant.skills && !applicant.experience && !applicant.coverLetter) {
      return res.status(400).json({ code: 'RESUME_NOT_FOUND', error: 'Candidate resume or screening profile evidence is required.' });
    }
    const organizationId = applicant.jobOpening.companyId || req.user.companyId;
    if (req.user.companyId && organizationId !== req.user.companyId) {
      return res.status(403).json({ code: 'ORGANIZATION_ACCESS_DENIED', error: 'Organization access denied.' });
    }
    const body = {
      tenantId: organizationId,
      organizationId,
      jobId: applicant.jobOpeningId,
      applicationId: applicant.id,
      candidateId: applicant.id,
      requestedBy: req.user.id,
    };
    const result = await callAiService('/api/v1/screenings', { method: 'POST', body });
    res.status(202).json(result);
  } catch (error) {
    console.error('[RUN AI SCREENING ERROR]:', error.message);
    res.status(error.status || 500).json({ code: error.code || 'AI_SCREENING_FAILED', error: 'Unable to run AI screening.' });
  }
};

const approveApplicantAiAssessment = async (req, res) => {
  try {
    if (!canRunAiScreening(req.user)) {
      return res.status(403).json({ code: 'RECRUITER_ACCESS_DENIED', error: 'You are not authorized to approve AI screening.' });
    }
    const decision = String(req.body?.decision || '').toUpperCase();
    if (!['APPROVED', 'REJECTED', 'NEEDS_REVIEW'].includes(decision)) {
      return res.status(400).json({ code: 'INVALID_APPROVAL_DECISION', error: 'Invalid approval decision.' });
    }
    const assessment = await prisma.aiCandidateAssessment.findUnique({ where: { workflowId: req.params.workflowId } });
    if (!assessment || assessment.applicationId !== req.params.id) {
      return res.status(404).json({ code: 'WORKFLOW_NOT_FOUND', error: 'Workflow not found.' });
    }
    if (req.user.companyId && assessment.organizationId !== req.user.companyId) {
      return res.status(403).json({ code: 'ORGANIZATION_ACCESS_DENIED', error: 'Organization access denied.' });
    }
    const result = await callAiService(`/api/v1/screenings/${req.params.workflowId}/approval`, {
      method: 'POST',
      body: {
        workflowId: req.params.workflowId,
        decision,
        approvedBy: req.user.id,
        comments: req.body?.comments || null,
      },
    });
    res.json(result);
  } catch (error) {
    console.error('[APPROVE AI SCREENING ERROR]:', error.message);
    res.status(error.status || 500).json({ code: error.code || 'AI_SCREENING_FAILED', error: 'Unable to record AI screening approval.' });
  }
};

const createApplicantReview = async (req, res) => {
  try {
    const { applicantId } = req.params;
    const { rating, reviewText, interviewRoundId } = req.body;
    const parsedRating = Number(rating);
    const text = String(reviewText ?? '').trim();

    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
    }
    if (!text) {
      return res.status(400).json({ error: 'Review text is required.' });
    }
    if (text.length > 5000) {
      return res.status(400).json({ error: 'Review text cannot exceed 5000 characters.' });
    }

    const applicant = await prisma.jobApplicant.findUnique({
      where: { id: applicantId },
      select: { id: true, stage: true },
    });
    if (!applicant) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    let interviewRoundName = null;
    if (interviewRoundId) {
      const interview = await prisma.interview.findFirst({
        where: { id: interviewRoundId, applicantId },
        select: { roundName: true },
      });
      if (!interview) {
        return res.status(400).json({ error: 'Interview round does not belong to this candidate.' });
      }
      interviewRoundName = interview.roundName;
    }

    const reviewer = req.user?.id
      ? await prisma.user.findUnique({
          where: { id: req.user.id },
          select: { id: true, name: true, role: true },
        })
      : null;

    const review = await prisma.candidateReview.create({
      data: {
        applicantId,
        reviewerId: reviewer?.id || req.user?.id || null,
        reviewerName: reviewer?.name || req.user?.email || 'Unknown user',
        reviewerRole: reviewer?.role || req.user?.role || null,
        rating: parsedRating,
        reviewText: text,
        candidateStage: applicant.stage,
        reviewType: interviewRoundId ? 'INTERVIEW_FEEDBACK' : 'GENERAL_REVIEW',
        interviewRoundId: interviewRoundId || null,
        interviewRoundName,
      },
    });

    await prisma.jobApplicant.update({
      where: { id: applicantId },
      data: { rating: parsedRating, notes: text },
    });

    res.status(201).json({ success: true, review: formatCandidateReview(review) });
  } catch (error) {
    console.error('[CREATE APPLICANT REVIEW ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const scheduleInterview = async (req, res) => {
  try {
    const { applicantId, interviewerName, interviewDate, roundName } = req.body;

    if (!applicantId || !interviewerName || !interviewDate || !roundName) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    const scheduledAt = parseFutureDate(interviewDate);
    if (!scheduledAt) {
      return res.status(400).json({ error: 'Please select a future interview date and time.' });
    }

    const interviewDetails = normalizeInterviewDetails(req.body);
    if (interviewDetails.error) {
      return res.status(400).json({ error: interviewDetails.error });
    }

    const interview = await prisma.$transaction(async (tx) => {
      const applicant = await tx.jobApplicant.findUnique({
        where: { id: applicantId },
        select: { id: true, stage: true },
      });
      if (!applicant) {
        const error = new Error('Candidate not found');
        error.statusCode = 404;
        throw error;
      }

      const schedulingError = validateInterviewSchedulingStage(applicant.stage);
      if (schedulingError) {
        const error = new Error(schedulingError);
        error.statusCode = 400;
        error.payload = { success: false, message: schedulingError };
        throw error;
      }

      const createdInterview = await tx.interview.create({
        data: {
          applicantId,
          interviewerName: String(interviewerName).trim(),
          interviewDate: scheduledAt,
          roundName: String(roundName).trim(),
          interviewMode: interviewDetails.interviewMode,
          meetingLink: interviewDetails.meetingLink,
          location: interviewDetails.location,
          instructions: interviewDetails.instructions,
          emailStatus: 'PENDING',
          status: 'SCHEDULED',
        },
      });

      return createdInterview;
    });

    const delivery = await deliverInterviewScheduledEmail(prisma, interview.id);

    res.status(201).json({
      success: true,
      message: interviewResponseMessage(delivery.emailStatus),
      emailStatus: delivery.emailStatus,
      interview: delivery.interview,
    });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json(error.payload || { error: error.message });
    console.error('[SCHEDULE INTERVIEW ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const resendInterviewEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.interview.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Interview round not found.' });

    await prisma.interview.update({
      where: { id },
      data: { emailStatus: 'PENDING', emailFailureReason: null },
    });

    const delivery = await deliverInterviewScheduledEmail(prisma, id);
    res.json({
      success: true,
      message: delivery.emailStatus === 'SENT'
        ? 'Interview email resent successfully.'
        : 'Interview email could not be resent.',
      emailStatus: delivery.emailStatus,
      interview: delivery.interview,
    });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('[RESEND INTERVIEW EMAIL ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Log interview feedback and score.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const submitInterviewFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { feedback, rating, status } = req.body;

    const interview = await prisma.interview.update({
      where: { id },
      data: {
        feedback,
        rating,
        status: status || 'COMPLETED',
      },
    });

    res.json(interview);
  } catch (error) {
    console.error('[SUBMIT FEEDBACK ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// ──── Job Offers ───────────────────────────────────────────────────────────

/**
 * Generate a formal job offer.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const legacyCreateJobOffer = async (req, res) => {
  try {
    const { applicantId, offeredSalary, joiningDate } = req.body;

    if (!applicantId || !offeredSalary || !joiningDate) {
      return res.status(400).json({ error: 'Required offer details missing' });
    }

    const applicant = await prisma.jobApplicant.findUnique({
      where: { id: applicantId },
      select: { id: true, stage: true },
    });
    if (!applicant) return res.status(404).json({ error: 'Candidate not found' });
    if (!OFFER_CREATABLE_STAGES.includes(applicant.stage)) {
      return res.status(400).json({ error: 'Offer letters can only be created once the candidate is in Offer Extended.' });
    }

    const joinDateTime = new Date(joiningDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (joinDateTime < today) {
      return res.status(400).json({ error: 'Offered joining date cannot be in the past.' });
    }

    const offer = await prisma.jobOffer.create({
      data: {
        applicantId,
        offeredSalary: parseFloat(offeredSalary),
        joiningDate: joinDateTime,
        status: 'SENT',
      },
    });

    res.status(201).json(offer);
  } catch (error) {
    console.error('[CREATE OFFER ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Generate PDF Job Offer letter.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const legacyDownloadOfferLetter = async (req, res) => {
  try {
    const { id } = req.params;
    const offer = await prisma.jobOffer.findUnique({
      where: { id },
      include: {
        applicant: {
          include: { jobOpening: true },
        },
      },
    });

    if (!offer) {
      return res.status(404).json({ error: 'Job offer not found' });
    }

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=offer-${offer.applicant.fullName.replace(/\s+/g, '_')}.pdf`);
    doc.pipe(res);

    // PDF Layout Styling
    doc.fillColor('#0A2540').fontSize(24).text('PID HCMS', { align: 'center' }).moveDown();
    doc.strokeColor('#0A2540').lineWidth(2).moveTo(50, 80).lineTo(562, 80).stroke().moveDown(2);

    doc.fillColor('#333333').fontSize(14).text(`Date: ${new Date().toLocaleDateString()}`);
    doc.text(`To: ${offer.applicant.fullName}`);
    doc.text(`Email: ${offer.applicant.email}`).moveDown(2);

    doc.fillColor('#0A2540').fontSize(18).text('LETTER OF OFFER', { underline: true }).moveDown();

    doc.fillColor('#333333').fontSize(12).lineGap(6);
    doc.text(`Dear ${offer.applicant.fullName},`);
    doc.text(`We are pleased to offer you employment with PID hcms for the position of ` +
      `"${offer.applicant.jobOpening.title}". We were incredibly impressed by your background ` +
      `and interviews, and we are thrilled at the prospect of having you join our team.`);
    
    doc.moveDown();
    doc.text(`Your compensation structure and details are outlined below:`, { underline: true });
    doc.text(`• Position Title: ${offer.applicant.jobOpening.title}`);
    doc.text(`• Offered Annual CTC: INR ${offer.offeredSalary.toLocaleString()}`);
    doc.text(`• Joining Date: ${new Date(offer.joiningDate).toLocaleDateString()}`);
    doc.text(`• Location: ${offer.applicant.jobOpening.location}`);

    doc.moveDown(2);
    doc.text('Please sign and return this document to accept our offer. We look forward to welcome you!');
    
    doc.moveDown(3);
    doc.text('Sincerely,', { align: 'left' });
    doc.text('HR Department', { align: 'left' });
    doc.text('PID hcms Management System', { align: 'left' });

    doc.end();
  } catch (error) {
    console.error('[DOWNLOAD OFFER ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const getApplicantOffers = async (req, res) => {
  try {
    const offers = await prisma.jobOffer.findMany({
      where: { applicantId: req.params.applicantId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ offers, currentOffer: offers[0] || null });
  } catch (error) {
    console.error('[GET OFFERS ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const createJobOffer = async (req, res) => {
  try {
    if (!canManageOffers(req.user)) return res.status(403).json({ error: 'Not authorized to manage job offers.' });
    const applicantId = req.params.applicantId || req.body.applicantId;
    const isLegacyPayload = !req.params.applicantId && req.body.offeredSalary && !req.body.offerExpiryDate;
    if (isLegacyPayload) {
      return legacyCreateJobOffer(req, res);
    }
    const normalizedBody = {
      ...req.body,
      offeredCtc: req.body.offeredCtc ?? req.body.offeredSalary,
      workLocation: req.body.workLocation ?? req.body.location,
      offerExpiryDate: req.body.offerExpiryDate ?? req.body.expiryDate,
      signatoryName: req.body.signatoryName ?? 'HR Department',
      signatoryDesignation: req.body.signatoryDesignation ?? 'Human Resources',
    };
    const validation = validateOfferInput(normalizedBody);
    if (validation.error) return res.status(400).json({ error: validation.error });

    const applicant = await prisma.jobApplicant.findUnique({
      where: { id: applicantId },
      include: { jobOpening: true, jobOffer: true },
    });
    if (!applicant) return res.status(404).json({ error: 'Candidate not found' });
    if (!OFFER_CREATABLE_STAGES.includes(applicant.stage)) {
      return res.status(400).json({ error: 'Offer letters can only be created once the candidate is in Offer Extended.' });
    }
    if (applicant.jobOffer && ACTIVE_OFFER_STATUSES.includes(normalizeOfferStatus(applicant.jobOffer.status))) {
      return res.status(409).json({ error: 'An active offer already exists for this candidate.' });
    }

    const offer = await prisma.jobOffer.create({
      data: {
        applicantId,
        ...validation.values,
        status: 'DRAFT',
        createdBy: getActor(req),
      },
    });
    await logOfferAudit(req, 'OFFER_DRAFT_CREATED', offer);
    res.status(201).json(offer);
  } catch (error) {
    console.error('[CREATE OFFER ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const getJobOffer = async (req, res) => {
  try {
    const offer = await prisma.jobOffer.findUnique({ where: { id: req.params.id } });
    if (!offer) return res.status(404).json({ error: 'Job offer not found' });
    res.json(offer);
  } catch (error) {
    console.error('[GET OFFER ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const updateJobOffer = async (req, res) => {
  try {
    if (!canManageOffers(req.user)) return res.status(403).json({ error: 'Not authorized to manage job offers.' });
    const existing = await prisma.jobOffer.findUnique({
      where: { id: req.params.id },
      include: { applicant: true },
    });
    if (!existing) return res.status(404).json({ error: 'Job offer not found' });
    if (normalizeOfferStatus(existing.status) !== 'DRAFT') return res.status(409).json({ error: 'Only draft offers can be edited.' });
    if (req.body.updatedAt && new Date(req.body.updatedAt).getTime() !== existing.updatedAt.getTime()) {
      return res.status(409).json({ error: 'Offer draft was updated by another user. Reload before saving.' });
    }

    const validation = validateOfferInput({
      ...existing,
      ...req.body,
      offeredCtc: req.body.offeredCtc ?? req.body.offeredSalary ?? existing.offeredCtc ?? existing.offeredSalary,
    });
    if (validation.error) return res.status(400).json({ error: validation.error });
    const offer = await prisma.jobOffer.update({
      where: { id: existing.id },
      data: validation.values,
    });
    await logOfferAudit(req, 'OFFER_UPDATED', offer);
    res.json(offer);
  } catch (error) {
    console.error('[UPDATE OFFER ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const loadOfferRenderData = async (offerId) => {
  const offer = await prisma.jobOffer.findUnique({
    where: { id: offerId },
    include: {
      applicant: {
        include: {
          jobOpening: { include: { department: true } },
        },
      },
    },
  });
  if (!offer) return null;
  const company = offer.applicant.jobOpening.companyId
    ? await prisma.company.findUnique({ where: { id: offer.applicant.jobOpening.companyId } })
    : null;
  return {
    offer,
    applicant: offer.applicant,
    job: offer.applicant.jobOpening,
    company,
  };
};

const generateJobOfferPdf = async (req, res) => {
  try {
    if (!canManageOffers(req.user)) return res.status(403).json({ error: 'Not authorized to manage job offers.' });
    const data = await loadOfferRenderData(req.params.id);
    if (!data) return res.status(404).json({ error: 'Job offer not found' });
    const status = normalizeOfferStatus(data.offer.status);
    if (['ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED'].includes(status)) {
      return res.status(409).json({ error: 'Terminal offers cannot be regenerated.' });
    }
    const buffer = await generateOfferLetterPdf(data);
    const fileName = buildOfferFileName({ candidateName: data.applicant.fullName, jobTitle: data.job.title });
    const stored = await writeOfferPdf({ offerId: data.offer.id, fileName, buffer });
    const offer = await prisma.jobOffer.update({
      where: { id: data.offer.id },
      data: {
        status: status === 'SENT' || status === 'VIEWED' ? status : 'GENERATED',
        pdfFileName: stored.fileName,
        pdfStorageKey: stored.storageKey,
        offerLetter: stored.storageKey,
      },
    });
    await logOfferAudit(req, 'OFFER_GENERATED', offer);
    res.json(offer);
  } catch (error) {
    console.error('[GENERATE OFFER PDF ERROR]:', error.message);
    res.status(500).json({ error: 'Unable to generate offer PDF.' });
  }
};

const downloadOfferLetter = async (req, res) => {
  try {
    const offer = await prisma.jobOffer.findUnique({
      where: { id: req.params.id },
      include: { applicant: { include: { jobOpening: true } } },
    });
    if (!offer) return res.status(404).json({ error: 'Job offer not found' });
    if (!offer.pdfStorageKey && !offer.offerLetter) return legacyDownloadOfferLetter(req, res);
    const buffer = await readOfferPdf(offer.pdfStorageKey || offer.offerLetter);
    await logOfferAudit(req, 'OFFER_DOWNLOADED', offer);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${offer.pdfFileName || buildOfferFileName({ candidateName: offer.applicant.fullName, jobTitle: offer.applicant.jobOpening.title })}"`);
    res.send(buffer);
  } catch (error) {
    console.error('[DOWNLOAD OFFER ERROR]:', error.message);
    res.status(500).json({ error: 'Unable to download offer PDF.' });
  }
};

const sendJobOffer = async (req, res) => {
  try {
    if (!canManageOffers(req.user)) return res.status(403).json({ error: 'You are not authorized to send offer letters.' });
    const data = await loadOfferRenderData(req.params.id);
    if (!data) return res.status(404).json({ error: 'Offer not found.' });
    const status = normalizeOfferStatus(data.offer.status);
    if (['ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED'].includes(status)) {
      return res.status(400).json({ error: 'This offer cannot be sent in its current status.' });
    }
    if (!data.offer.pdfStorageKey && !data.offer.offerLetter) {
      return res.status(400).json({ error: 'Generate the offer PDF before sharing.' });
    }
    if (!isValidEmailAddress(data.applicant.email)) {
      return res.status(400).json({ error: 'Candidate email address is missing or invalid.' });
    }
    await readOfferPdf(data.offer.pdfStorageKey || data.offer.offerLetter);
    const token = crypto.randomBytes(32).toString('hex');
    const tokenExpiresAt = addDays(new Date(), Number(process.env.OFFER_TOKEN_EXPIRY_DAYS || 7));
    const delivery = await deliverOfferLetterEmail({ ...data, token });
    const sentAt = delivery.status === 'SENT' ? new Date() : data.offer.sentAt;
    const offer = await prisma.jobOffer.update({
      where: { id: data.offer.id },
      data: {
        status: delivery.status === 'SENT' ? 'SENT' : status,
        publicTokenHash: hashOfferToken(token),
        tokenExpiresAt,
        sentAt,
        emailStatus: delivery.status,
        emailFailureReason: delivery.failureReason,
      },
    });
    const action = delivery.status === 'SENT'
      ? (status === 'SENT' || status === 'VIEWED' ? 'OFFER_RESENT' : 'OFFER_SENT')
      : 'OFFER_EMAIL_FAILED';
    await logOfferAudit(req, action, offer, {
      emailStatus: delivery.status,
      recipient: data.applicant.email,
      failureReason: delivery.failureReason || undefined,
    });
    res.json(offer);
  } catch (error) {
    console.error('[SEND OFFER ERROR]:', error.message);
    res.status(500).json({ error: 'Unable to send offer email.' });
  }
};

const cancelJobOffer = async (req, res) => {
  try {
    if (!canManageOffers(req.user)) return res.status(403).json({ error: 'Not authorized to manage job offers.' });
    const existing = await prisma.jobOffer.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Job offer not found' });
    if (['ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED'].includes(normalizeOfferStatus(existing.status))) {
      return res.status(409).json({ error: 'Terminal offers cannot be cancelled again.' });
    }
    const offer = await prisma.jobOffer.update({
      where: { id: existing.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    await logOfferAudit(req, 'OFFER_CANCELLED', offer);
    res.json(offer);
  } catch (error) {
    console.error('[CANCEL OFFER ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const findPublicOffer = async (token) => {
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) return null;
  return prisma.jobOffer.findFirst({
    where: { publicTokenHash: hashOfferToken(token) },
    include: {
      applicant: {
        include: {
          jobOpening: { include: { department: true } },
        },
      },
    },
  });
};

const getPublicOffer = async (req, res) => {
  try {
    const offer = await findPublicOffer(req.params.token);
    if (!offer) return res.status(404).json({ error: 'Offer not found or link expired.' });
    if (offer.tokenExpiresAt && offer.tokenExpiresAt < new Date()) {
      const expired = await prisma.jobOffer.update({ where: { id: offer.id }, data: { status: 'EXPIRED' } });
      await logOfferAudit(req, 'OFFER_EXPIRED', expired);
      return res.status(410).json({ error: 'Offer link has expired.' });
    }
    if (!['SENT', 'VIEWED', 'ACCEPTED', 'REJECTED'].includes(normalizeOfferStatus(offer.status))) {
      return res.status(409).json({ error: 'Offer is not available.' });
    }
    const updated = normalizeOfferStatus(offer.status) === 'SENT'
      ? await prisma.jobOffer.update({ where: { id: offer.id }, data: { status: 'VIEWED', viewedAt: new Date() } })
      : offer;
    if (normalizeOfferStatus(offer.status) === 'SENT') await logOfferAudit(req, 'OFFER_VIEWED', updated);
    res.json({
      id: updated.id,
      status: updated.status,
      candidateName: offer.applicant.fullName,
      jobTitle: offer.applicant.jobOpening.title,
      department: offer.applicant.jobOpening.department?.name || null,
      joiningDate: offer.joiningDate,
      offerExpiryDate: offer.offerExpiryDate,
      offeredCtc: offer.offeredCtc || offer.offeredSalary,
      companyName: 'PID HCMS',
      pdfAvailable: Boolean(offer.pdfStorageKey || offer.offerLetter),
      acceptedAt: offer.acceptedAt,
      rejectedAt: offer.rejectedAt,
    });
  } catch (error) {
    console.error('[PUBLIC OFFER ERROR]:', error.message);
    res.status(500).json({ error: 'Unable to load offer.' });
  }
};

const downloadPublicOffer = async (req, res) => {
  try {
    const offer = await findPublicOffer(req.params.token);
    if (!offer) return res.status(404).json({ error: 'Offer not found or link expired.' });
    if (offer.tokenExpiresAt && offer.tokenExpiresAt < new Date()) return res.status(410).json({ error: 'Offer link has expired.' });
    if (!['SENT', 'VIEWED', 'ACCEPTED', 'REJECTED'].includes(normalizeOfferStatus(offer.status))) {
      return res.status(409).json({ error: 'Offer is not available.' });
    }
    const buffer = await readOfferPdf(offer.pdfStorageKey || offer.offerLetter);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${offer.pdfFileName || 'offer-letter.pdf'}"`);
    res.send(buffer);
  } catch (error) {
    console.error('[PUBLIC OFFER DOWNLOAD ERROR]:', error.message);
    res.status(500).json({ error: 'Unable to download offer.' });
  }
};

const acceptPublicOffer = async (req, res) => {
  try {
    const offer = await findPublicOffer(req.params.token);
    if (!offer) return res.status(404).json({ error: 'Offer not found or link expired.' });
    if (!req.body?.acceptedTerms) return res.status(400).json({ error: 'Terms acceptance is required.' });
    if (offer.tokenExpiresAt && offer.tokenExpiresAt < new Date()) return res.status(410).json({ error: 'Offer link has expired.' });
    if (!['SENT', 'VIEWED'].includes(normalizeOfferStatus(offer.status))) {
      return res.status(409).json({ error: 'Offer has already been actioned or is unavailable.' });
    }
    const updated = await prisma.jobOffer.update({
      where: { id: offer.id },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
        candidateResponseName: cleanText(req.body.candidateName),
      },
    });
    await logOfferAudit(req, 'OFFER_ACCEPTED', updated);
    res.json({ status: updated.status, acceptedAt: updated.acceptedAt });
  } catch (error) {
    console.error('[PUBLIC OFFER ACCEPT ERROR]:', error.message);
    res.status(500).json({ error: 'Unable to accept offer.' });
  }
};

const rejectPublicOffer = async (req, res) => {
  try {
    const offer = await findPublicOffer(req.params.token);
    if (!offer) return res.status(404).json({ error: 'Offer not found or link expired.' });
    if (offer.tokenExpiresAt && offer.tokenExpiresAt < new Date()) return res.status(410).json({ error: 'Offer link has expired.' });
    if (!['SENT', 'VIEWED'].includes(normalizeOfferStatus(offer.status))) {
      return res.status(409).json({ error: 'Offer has already been actioned or is unavailable.' });
    }
    const updated = await prisma.jobOffer.update({
      where: { id: offer.id },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectionReason: cleanText(req.body?.reason),
      },
    });
    await logOfferAudit(req, 'OFFER_REJECTED', updated);
    res.json({ status: updated.status, rejectedAt: updated.rejectedAt });
  } catch (error) {
    console.error('[PUBLIC OFFER REJECT ERROR]:', error.message);
    res.status(500).json({ error: 'Unable to reject offer.' });
  }
};

module.exports = {
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
  getPublicOffer,
  downloadPublicOffer,
  acceptPublicOffer,
  rejectPublicOffer,
};
