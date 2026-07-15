const { sendMail, sanitizeEmailError, logDevelopmentEmailError } = require('./emailService');
const { formatDate } = require('../templates/offerLetterTemplate');

const deliverOfferLetterEmail = async ({ offer, applicant, job, company, token }) => {
  const baseUrl = String(process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const companyName = company?.name || 'PID HCMS';
  const viewUrl = `${baseUrl}/career-portal/offers/${token}`;

  try {
    await sendMail({
      to: applicant.email,
      subject: `Offer of Employment - ${job.title} at ${companyName}`,
      text: [
        `Dear ${applicant.fullName},`,
        '',
        `We are pleased to share your offer for ${job.title} at ${companyName}.`,
        `Joining date: ${formatDate(offer.joiningDate)}`,
        `Offer valid until: ${formatDate(offer.offerExpiryDate)}`,
        '',
        `View, download, accept, or reject the offer here: ${viewUrl}`,
      ].join('\n'),
      html: `
        <p>Dear ${applicant.fullName},</p>
        <p>We are pleased to share your offer for <strong>${job.title}</strong> at <strong>${companyName}</strong>.</p>
        <p><strong>Joining date:</strong> ${formatDate(offer.joiningDate)}<br />
        <strong>Offer valid until:</strong> ${formatDate(offer.offerExpiryDate)}</p>
        <p><a href="${viewUrl}" style="display:inline-block;padding:10px 16px;background:#0f766e;color:#fff;text-decoration:none;border-radius:6px;">View Offer</a></p>
        <p>If the button does not work, open this secure link: ${viewUrl}</p>
      `,
    });
    return { status: 'SENT', failureReason: null };
  } catch (error) {
    logDevelopmentEmailError(error);
    return { status: 'FAILED', failureReason: sanitizeEmailError(error) };
  }
};

module.exports = {
  deliverOfferLetterEmail,
};
