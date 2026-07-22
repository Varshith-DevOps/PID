const VARIABLE_PATTERN = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

const DEFAULT_TEMPLATES = [
  {
    name: 'Interview Invitation',
    event: 'INTERVIEW_SCHEDULED',
    channel: 'EMAIL',
    subject: 'Interview Invitation - {{JobTitle}}',
    body: [
      'Dear {{CandidateName}},',
      '',
      'Congratulations. Your application for {{JobTitle}} has been shortlisted.',
      '',
      'Interview Details',
      'Date: {{InterviewDate}}',
      'Time: {{InterviewTime}}',
      'Interviewer: {{Interviewer}}',
      'Meeting Link: {{MeetingLink}}',
      'Location: {{Location}}',
      '',
      'Please join 10 minutes early.',
      '',
      'Regards',
      'HR Team',
    ].join('\n'),
  },
  {
    name: 'Interview Reminder',
    event: 'INTERVIEW_REMINDER',
    channel: 'SMS',
    subject: null,
    body: 'Interview reminder: {{JobTitle}} on {{InterviewDate}} at {{InterviewTime}}. {{MeetingLink}}',
  },
  {
    name: 'Leave Approved',
    event: 'LEAVE_APPROVED',
    channel: 'IN_APP',
    subject: null,
    body: 'Your {{LeaveType}} leave request has been approved.',
  },
  {
    name: 'Helpdesk Ticket Updated',
    event: 'HELPDESK_TICKET_UPDATED',
    channel: 'IN_APP',
    subject: null,
    body: 'Ticket {{TicketID}} has been updated.',
  },
  {
    name: 'Course Assigned',
    event: 'COURSE_ASSIGNED',
    channel: 'IN_APP',
    subject: null,
    body: 'You have been assigned {{CourseName}}.',
  },
];

const stringifyValue = (value) => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
};

const renderTemplate = (template, variables = {}) => {
  const render = (value) => String(value || '').replace(VARIABLE_PATTERN, (_, key) => stringifyValue(variables[key] ?? variables[key.charAt(0).toLowerCase() + key.slice(1)]));
  return {
    subject: render(template?.subject),
    body: render(template?.body),
  };
};

const resolveTemplate = async (prisma, { companyId, event, channel, locale = 'en-IN' }) => {
  if (!event || !channel) return null;
  const where = { event, channel, active: true, locale };
  const scoped = companyId
    ? await prisma.notificationTemplate.findFirst({ where: { ...where, companyId } })
    : null;
  if (scoped) return scoped;
  return prisma.notificationTemplate.findFirst({ where: { ...where, companyId: null } });
};

const seedDefaultTemplates = async (prisma, companyId = null) => {
  const rows = [];
  for (const template of DEFAULT_TEMPLATES) {
    const existing = await prisma.notificationTemplate.findFirst({
      where: { companyId, event: template.event, channel: template.channel, locale: 'en-IN' },
    });
    if (existing) rows.push(existing);
    else rows.push(await prisma.notificationTemplate.create({ data: { ...template, companyId, locale: 'en-IN' } }));
  }
  return rows;
};

module.exports = {
  DEFAULT_TEMPLATES,
  renderTemplate,
  resolveTemplate,
  seedDefaultTemplates,
};
