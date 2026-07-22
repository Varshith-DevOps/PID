const { sanitizeEmailError, logDevelopmentEmailError } = require('./emailService');
const { buildInterviewScheduledEmail } = require('../templates/interviewScheduledEmail');
const { createNotificationRecord } = require('./notificationService');

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

  await createNotificationRecord({
    companyId: job.companyId || null,
    title: email.subject,
    message: email.html,
    type: 'INTERVIEW_SCHEDULED',
    module: 'RECRUITMENT',
    channel: 'EMAIL',
    recipientType: 'CANDIDATE',
    recipientId: candidate.id,
    recipientEmail: candidateEmail,
    recipientPhone: candidate.phone || null,
    metadata: {
      applicantId: candidate.id,
      jobId: job.id,
      interviewId: interview.id,
      text: email.text,
      timeZone,
    },
  });

  const reminderOffsets = [
    { label: '24h', ms: 24 * 60 * 60 * 1000 },
    { label: '1h', ms: 60 * 60 * 1000 },
    { label: '15m', ms: 15 * 60 * 1000 },
  ];
  await Promise.all(reminderOffsets.map(({ label, ms }) => {
    const scheduledAt = new Date(new Date(interview.interviewDate).getTime() - ms);
    if (scheduledAt <= new Date()) return null;
    return createNotificationRecord({
      companyId: job.companyId || null,
      title: `Interview Reminder (${label})`,
      message: `Interview reminder: ${job.title} at ${companyName}. Please join on time. ${interview.meetingLink || interview.location || ''}`.trim(),
      type: 'INTERVIEW_REMINDER',
      module: 'RECRUITMENT',
      channel: candidate.phone ? 'SMS' : 'EMAIL',
      recipientType: 'CANDIDATE',
      recipientId: candidate.id,
      recipientEmail: candidateEmail,
      recipientPhone: candidate.phone || null,
      scheduledAt,
      metadata: { applicantId: candidate.id, jobId: job.id, interviewId: interview.id, reminder: label },
    });
  }));
};

const updateInterviewEmailStatus = async (prisma, interviewId, status, error) => {
  const data = status === 'QUEUED'
    ? { emailStatus: 'QUEUED', emailSentAt: null, emailFailureReason: null }
    : status === 'SENT'
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
    const interview = await updateInterviewEmailStatus(prisma, interviewId, 'QUEUED');
    return { emailStatus: 'QUEUED', interview };
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
