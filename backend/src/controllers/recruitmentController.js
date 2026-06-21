/**
 * @fileoverview Recruitment & Applicant Tracking System (ATS) controller.
 * Handles job postings, applicant tracking (Kanban stages),
 * interview scheduling, and job offer letter generation.
 * @module controllers/recruitmentController
 */

const prisma = require('../config/database');
const { generatePayslipPDF } = require('../services/pdfService'); // We will reuse or create PDF helpers
const PDFDocument = require('pdfkit');

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
    const { jobOpeningId, fullName, email, phone, coverLetter } = req.body;

    if (!jobOpeningId || !fullName || !email || !phone) {
      return res.status(400).json({ error: 'Required applicant details missing' });
    }

    const job = await prisma.jobOpening.findUnique({
      where: { id: jobOpeningId },
      select: { id: true, status: true },
    });
    if (!job) return res.status(404).json({ error: 'Job opening not found' });
    if (job.status !== 'OPEN') {
      return res.status(400).json({ error: 'This job opening is not accepting applications.' });
    }

    // Check for duplicate applicant for this specific job opening by email or phone number
    const existingApplicant = await prisma.jobApplicant.findFirst({
      where: {
        jobOpeningId,
        OR: [
          { email: email },
          { phone: phone }
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
        jobOpeningId,
        fullName,
        email,
        phone,
        coverLetter,
        resumeUrl,
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

    const applicant = await prisma.jobApplicant.update({
      where: { id },
      data: { stage, rating, notes },
    });

    // ──── AUTOMATION: Recruitment → Onboarding Pipeline ────
    // When a candidate is HIRED, automatically:
    //   1. Create an Employee record with accountStage = 'ONBOARDING'
    //   2. Create a linked User account  
    //   3. Auto-instantiate the first matching ONBOARDING checklist template
    if (stage === 'HIRED') {
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
          const bcrypt = require('bcryptjs');
          const { generateTempPassword } = require('../services/validators');
          const tempPassword = generateTempPassword();
          const hashedPassword = await bcrypt.hash(tempPassword, 10);

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
const scheduleInterview = async (req, res) => {
  try {
    const { applicantId, interviewerName, interviewDate, roundName } = req.body;

    if (!applicantId || !interviewerName || !interviewDate || !roundName) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    const interview = await prisma.interview.create({
      data: {
        applicantId,
        interviewerName,
        interviewDate: new Date(interviewDate),
        roundName,
        status: 'SCHEDULED',
      },
    });

    // Automatically transition applicant stage to 'INTERVIEW'
    await prisma.jobApplicant.update({
      where: { id: applicantId },
      data: { stage: 'INTERVIEW' },
    });

    res.status(201).json(interview);
  } catch (error) {
    console.error('[SCHEDULE INTERVIEW ERROR]:', error.message);
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
};
