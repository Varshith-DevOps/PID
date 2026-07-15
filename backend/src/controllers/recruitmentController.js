/**
 * @fileoverview Recruitment & Applicant Tracking System (ATS) controller.
 * Handles job postings, applicant tracking (Kanban stages),
 * interview scheduling, and job offer letter generation.
 * @module controllers/recruitmentController
 */

const prisma = require('../config/database');
const { generatePayslipPDF } = require('../services/pdfService'); // We will reuse or create PDF helpers
const { deliverInterviewScheduledEmail } = require('../services/interviewEmailService');
const PDFDocument = require('pdfkit');

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
const ACTIVE_APPLICANT_STAGE_ORDER = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'ONBOARDING'];
const TERMINAL_APPLICANT_STAGE = 'REJECTED';

const cleanText = (value) => {
  const trimmed = String(value ?? '').trim();
  return trimmed || null;
};

const hasNegativeAmount = (value) => /^\s*-/.test(String(value ?? '')) || /-\s*\d/.test(String(value ?? ''));

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
  if (currentStage === 'ONBOARDING' || currentStage === TERMINAL_APPLICANT_STAGE) return [];
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
  if (stage !== 'INTERVIEW') return 'Interview rounds can only be scheduled when the candidate is in the Interviews stage.';
  return null;
};

const parseFutureDate = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed <= new Date()) return null;
  return parsed;
};

const INTERVIEW_MODES = new Set(['ONLINE', 'IN_PERSON', 'PHONE']);

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
  candidateStage: 'INTERVIEW',
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
        status: { in: ['OPEN', 'DRAFT'] },
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
        status: { in: ['OPEN', 'DRAFT'] },
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
 * Delete a job opening (Cascade deletes applicants and relations).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const deleteJobOpening = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.jobOpening.delete({ where: { id } });
    res.json({ message: 'Job opening deleted successfully' });
  } catch (error) {
    console.error('[DELETE JOB ERROR]:', error.message);
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
      select: { id: true, status: true },
    });
    if (!job) return res.status(404).json({ error: 'Job opening not found' });
    if (!['OPEN', 'DRAFT'].includes(job.status)) {
      return res.status(400).json({ error: 'This job opening is not accepting applications.' });
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

    res.status(201).json(applicant);
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
    if (existingApplicant.stage !== 'ONBOARDING' && requestedStage === 'ONBOARDING') {
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
              accountStage: 'ONBOARDING',
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
const createJobOffer = async (req, res) => {
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
    const transitionError = validateApplicantStageTransition(applicant.stage, 'OFFER');
    if (transitionError) return res.status(400).json({ error: transitionError });

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

    // Update applicant stage
    await prisma.jobApplicant.update({
      where: { id: applicantId },
      data: { stage: 'OFFER' },
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
const downloadOfferLetter = async (req, res) => {
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

module.exports = {
  getJobOpenings,
  getCareerConnectJobs,
  getCareerPortalJobById,
  getJobOpeningById,
  createJobOpening,
  updateJobOpening,
  deleteJobOpening,
  getApplicants,
  applyForJob,
  updateApplicantStage,
  updateApplicantEvaluation,
  getApplicantReviews,
  createApplicantReview,
  scheduleInterview,
  resendInterviewEmail,
  submitInterviewFeedback,
  createJobOffer,
  downloadOfferLetter,
};
