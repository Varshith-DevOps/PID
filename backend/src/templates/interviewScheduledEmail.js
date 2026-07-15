const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const formatParts = (date, timeZone) => {
  const value = new Date(date);
  return {
    date: new Intl.DateTimeFormat('en-IN', {
      timeZone,
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    }).format(value),
    time: new Intl.DateTimeFormat('en-IN', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(value),
  };
};

const buildInterviewScheduledEmail = ({ candidate, job, companyName, contactEmail, contactPhone, interview, timeZone }) => {
  const { date, time } = formatParts(interview.interviewDate, timeZone);
  const mode = interview.interviewMode || 'ONLINE';
  const meetingDetail = interview.meetingLink || interview.location || 'To be shared by the recruitment team';
  const instructions = interview.instructions || 'Please join the interview 10 minutes before the scheduled time.';
  const contactInfo = [contactEmail, contactPhone].filter(Boolean).join(' | ') || `${companyName} Recruitment Team`;
  const subject = `Interview Scheduled - ${job.title} at ${companyName}`;

  const text = [
    `Hello ${candidate.fullName},`,
    '',
    `Your interview has been scheduled for the position of ${job.title} at ${companyName}.`,
    '',
    'Interview details:',
    `Round: ${interview.roundName}`,
    `Date: ${date}`,
    `Time: ${time}`,
    `Time Zone: ${timeZone}`,
    `Interviewer: ${interview.interviewerName}`,
    `Mode: ${mode}`,
    `Meeting Link/Location: ${meetingDetail}`,
    '',
    'Instructions:',
    instructions,
    '',
    `Contact: ${contactInfo}`,
    '',
    'Please join the interview 10 minutes before the scheduled time.',
    '',
    'Regards,',
    companyName,
    'Recruitment Team',
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
      <p>Hello ${escapeHtml(candidate.fullName)},</p>
      <p>Your interview has been scheduled for the position of <strong>${escapeHtml(job.title)}</strong> at <strong>${escapeHtml(companyName)}</strong>.</p>
      <p><strong>Interview details:</strong></p>
      <ul>
        <li><strong>Round:</strong> ${escapeHtml(interview.roundName)}</li>
        <li><strong>Date:</strong> ${escapeHtml(date)}</li>
        <li><strong>Time:</strong> ${escapeHtml(time)}</li>
        <li><strong>Time Zone:</strong> ${escapeHtml(timeZone)}</li>
        <li><strong>Interviewer:</strong> ${escapeHtml(interview.interviewerName)}</li>
        <li><strong>Mode:</strong> ${escapeHtml(mode)}</li>
        <li><strong>Meeting Link/Location:</strong> ${escapeHtml(meetingDetail)}</li>
      </ul>
      <p><strong>Instructions:</strong><br>${escapeHtml(instructions)}</p>
      <p><strong>Contact:</strong> ${escapeHtml(contactInfo)}</p>
      <p>Please join the interview 10 minutes before the scheduled time.</p>
      <p>Regards,<br>${escapeHtml(companyName)}<br>Recruitment Team</p>
    </div>
  `;

  return { subject, text, html };
};

module.exports = {
  buildInterviewScheduledEmail,
};
