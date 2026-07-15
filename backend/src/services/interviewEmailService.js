const { sendMail, sanitizeEmailError, logDevelopmentEmailError } = require('./emailService');
const { buildInterviewScheduledEmail } = require('../templates/interviewScheduledEmail');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getAppTimeZone = () => process.env.APP_TIMEZONE || 'Asia/Kolkata';

const loadInterviewEmailContext = async (prisma, interviewId) => {
  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: {
      applicant: {
        include: {
          jobOpening: {
            include: {
              department: true,
            },
          },
        },
      },
    },
  });

  if (!interview) {
    const error = new Error('Interview round not found.');
    error.statusCode = 404;
    throw error;
  }

  const company = interview.applicant.jobOpening.companyId
    ? await prisma.company.findUnique({ where: { id: interview.applicant.jobOpening.companyId } })
    : null;

  return {
    interview,
    candidate: interview.applicant,
    job: interview.applicant.jobOpening,
    companyName: company?.name || 'PID HCMS',
    contactEmail: company?.contactPersonEmail || company?.email || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || null,
    contactPhone: company?.contactPersonPhone || company?.phone || null,
    timeZone: getAppTimeZone(),
  };
};

const sendInterviewScheduledEmail = async (context) => {
  const { candidate, job, companyName, contactEmail, contactPhone, interview, timeZone } = context;
  const candidateEmail = String(candidate.email || '').trim();
  if (!EMAIL_RE.test(candidateEmail)) {
    const error = new Error('Candidate email address is invalid.');
    error.code = 'INVALID_RECIPIENT';
    throw error;
  }

  const email = buildInterviewScheduledEmail({
    candidate,
    job,
    companyName,
    contactEmail,
    contactPhone,
    interview,
    timeZone,
  });

  await sendMail({
    to: candidateEmail,
    ...email,
  });
};

const updateInterviewEmailStatus = async (prisma, interviewId, status, error) => {
  const data = status === 'SENT'
    ? { emailStatus: 'SENT', emailSentAt: new Date(), emailFailureReason: null }
    : { emailStatus: 'FAILED', emailSentAt: null, emailFailureReason: sanitizeEmailError(error) };

  return prisma.interview.update({
    where: { id: interviewId },
    data,
  });
};

const deliverInterviewScheduledEmail = async (prisma, interviewId) => {
  try {
    const context = await loadInterviewEmailContext(prisma, interviewId);
    await sendInterviewScheduledEmail(context);
    const interview = await updateInterviewEmailStatus(prisma, interviewId, 'SENT');
    return { emailStatus: 'SENT', interview };
  } catch (error) {
    logDevelopmentEmailError(error);
    const interview = await updateInterviewEmailStatus(prisma, interviewId, 'FAILED', error);
    return { emailStatus: 'FAILED', interview };
  }
};

module.exports = {
  deliverInterviewScheduledEmail,
  loadInterviewEmailContext,
  sendInterviewScheduledEmail,
};
