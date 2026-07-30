const prisma = require('../config/database');
const { sendMail } = require('../services/emailService');

const createTicket = async (req, res) => {
  try {
    const { category, subject, description, priority } = req.body;

    const employee = await prisma.employee.findFirst({ where: { userId: req.user.id } });
    if (!employee) return res.status(404).json({ error: 'Employee profile not found.' });

    const ticket = await prisma.helpdeskTicket.create({
      data: {
        employeeId: employee.id,
        category: category || 'HR',
        subject,
        description,
        priority: priority || 'MEDIUM',
        status: 'OPEN'
      }
    });

    // Fire-and-forget SMTP mail alert to HR (with try-catch safety)
    try {
      await sendMail({
        to: 'hr@company.com',
        subject: `[Helpdesk] New ${ticket.priority} Ticket: ${ticket.subject}`,
        text: `Hello HR/Support Team,\n\nA new helpdesk ticket has been opened by employee ${employee.firstName} ${employee.lastName}.\n\nCategory: ${ticket.category}\nSubject: ${ticket.subject}\nPriority: ${ticket.priority}\n\nDescription:\n${ticket.description}\n\nRegards,\nPID Portal Alert System`,
        html: `<p>Hello HR/Support Team,</p><p>A new helpdesk ticket has been opened by employee <strong>${employee.firstName} ${employee.lastName}</strong>.</p><ul><li><strong>Category:</strong> ${ticket.category}</li><li><strong>Subject:</strong> ${ticket.subject}</li><li><strong>Priority:</strong> ${ticket.priority}</li></ul><p><strong>Description:</strong><br/>${ticket.description}</p><p>Regards,<br/>PID Portal Alert System</p>`
      });
    } catch (mailError) {
      console.warn('[HELPDESK SMTP ALERT WARNING]:', mailError.message);
    }

    res.status(201).json(ticket);
  } catch (error) {
    console.error('[CREATE TICKET ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const getEmployeeTickets = async (req, res) => {
  try {
    const employee = await prisma.employee.findFirst({ where: { userId: req.user.id } });
    if (!employee) return res.status(404).json({ error: 'Employee profile not found.' });

    const list = await prisma.helpdeskTicket.findMany({
      where: { employeeId: employee.id },
      orderBy: { createdAt: 'desc' }
    });

    res.json(list);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const getAdminTickets = async (req, res) => {
  try {
    // Tickets are relation-isolated. We query tickets that belong to the active company's employees.
    const companyId = req.user.companyId;
    if (!companyId) return res.status(400).json({ error: 'Company context missing.' });

    const list = await prisma.helpdeskTicket.findMany({
      where: { employee: { companyId } },
      include: {
        employee: { select: { firstName: true, lastName: true, jobTitle: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(list);
  } catch (error) {
    console.error('[GET ADMIN TICKETS ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const resolveTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution } = req.body;

    const ticket = await prisma.helpdeskTicket.findUnique({ where: { id } });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });

    const updated = await prisma.helpdeskTicket.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolution: resolution || 'Resolved by support'
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('[RESOLVE TICKET ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  createTicket,
  getEmployeeTickets,
  getAdminTickets,
  resolveTicket
};
