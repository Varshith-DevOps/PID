const { sendMail, sanitizeEmailError, logDevelopmentEmailError } = require('./emailService');
const { formatDate, formatMoney, escapeHtml } = require('../templates/offerLetterTemplate');

const deliverOfferLetterEmail = async ({ offer, applicant, job, company, token }) => {
  const baseUrl = String(process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const companyName = company?.name || 'PID HCMS';
  const viewUrl = `${baseUrl}/career-portal/offers/${token}`;
  const department = job.department?.name || 'Not specified';
  const workLocation = offer.workLocation || job.location || 'Not specified';
  const offeredCtc = formatMoney(offer.offeredCtc || offer.offeredSalary);
  const expiryText = offer.offerExpiryDate
    ? `Please review and respond to this offer on or before ${formatDate(offer.offerExpiryDate)}.`
    : '';

  try {
    await sendMail({
      to: applicant.email,
      subject: `Offer of Employment - ${job.title} at ${companyName}`,
      text: [
        `Hello ${applicant.fullName},`,
        '',
        `We are pleased to share your employment offer for the position of ${job.title} at ${companyName}.`,
        '',
        'Offer details:',
        `Position: ${job.title}`,
        `Department: ${department}`,
        `Work Location: ${workLocation}`,
        `Joining Date: ${formatDate(offer.joiningDate)}`,
        `Offered CTC: ${offeredCtc}`,
        ...(expiryText ? ['', expiryText] : []),
        '',
        `Secure View Offer link: ${viewUrl}`,
        `Download Offer Letter link: ${viewUrl}`,
        `Accept Offer link: ${viewUrl}`,
        `Reject Offer link: ${viewUrl}`,
        '',
        'For any questions, please reply to this email or contact the recruitment team.',
        '',
        'Regards,',
        companyName,
        'Recruitment Team',
      ].join('\n'),
      html: `
        <p>Hello ${escapeHtml(applicant.fullName)},</p>
        <p>We are pleased to share your employment offer for the position of <strong>${escapeHtml(job.title)}</strong> at <strong>${escapeHtml(companyName)}</strong>.</p>
        <p><strong>Offer details:</strong></p>
        <ul>
          <li><strong>Position:</strong> ${escapeHtml(job.title)}</li>
          <li><strong>Department:</strong> ${escapeHtml(department)}</li>
          <li><strong>Work Location:</strong> ${escapeHtml(workLocation)}</li>
          <li><strong>Joining Date:</strong> ${formatDate(offer.joiningDate)}</li>
          <li><strong>Offered CTC:</strong> ${offeredCtc}</li>
        </ul>
        ${expiryText ? `<p>${escapeHtml(expiryText)}</p>` : ''}
        <p>
          <a href="${viewUrl}" style="display:inline-block;margin:0 8px 8px 0;padding:10px 16px;background:#0f766e;color:#fff;text-decoration:none;border-radius:6px;">Secure View Offer</a>
          <a href="${viewUrl}" style="display:inline-block;margin:0 8px 8px 0;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Download Offer Letter</a>
          <a href="${viewUrl}" style="display:inline-block;margin:0 8px 8px 0;padding:10px 16px;background:#16a34a;color:#fff;text-decoration:none;border-radius:6px;">Accept Offer</a>
          <a href="${viewUrl}" style="display:inline-block;margin:0 8px 8px 0;padding:10px 16px;background:#dc2626;color:#fff;text-decoration:none;border-radius:6px;">Reject Offer</a>
        </p>
        <p>If the buttons do not work, open this secure link: ${viewUrl}</p>
        <p>For any questions, please reply to this email or contact the recruitment team.</p>
        <p>Regards,<br />${escapeHtml(companyName)}<br />Recruitment Team</p>
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
