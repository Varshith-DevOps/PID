const prisma = require('../config/database');
const { canAccessEmployee, getEmployeeScopeIds, isHr } = require('../services/accessControl');

const listTickets = async (req, res) => {
  try {
    const { status, employeeId } = req.query;
    const where = {};
    if (status) where.status = status;
    if (employeeId) {
      if (!(await canAccessEmployee(req.user, employeeId))) return res.status(403).json({ error: 'Access denied for requested tickets' });
      where.employeeId = employeeId;
    } else if (!isHr(req.user)) {
      const employeeIds = await getEmployeeScopeIds(req.user);
      where.employeeId = { in: employeeIds.length ? employeeIds : ['__no_employee_scope__'] };
    }

    const tickets = await prisma.helpdeskTicket.findMany({
      where,
      include: { employee: { select: { id: true, employeeId: true, firstName: true, lastName: true, department: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const createTicket = async (req, res) => {
  try {
    const { employeeId, category, subject, description, priority } = req.body;
    const ownerId = employeeId || req.user.employeeId;
    if (!ownerId || !subject || !description) {
      return res.status(400).json({ error: 'Employee, subject and description are required' });
    }
    if (!(await canAccessEmployee(req.user, ownerId))) return res.status(403).json({ error: 'Access denied. You cannot create tickets for this employee.' });

    const ticket = await prisma.helpdeskTicket.create({
      data: { employeeId: ownerId, category: category || 'HR', subject, description, priority: priority || 'MEDIUM' },
    });
    res.status(201).json(ticket);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const updateTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, assignedTo, resolution, priority } = req.body;
    const ticket = await prisma.helpdeskTicket.findUnique({ where: { id } });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (!isHr(req.user) && !(await canAccessEmployee(req.user, ticket.employeeId))) {
      return res.status(403).json({ error: 'Access denied for ticket' });
    }

    const updated = await prisma.helpdeskTicket.update({
      where: { id },
      data: {
        status: status || undefined,
        assignedTo: isHr(req.user) ? assignedTo : undefined,
        resolution: resolution !== undefined ? resolution : undefined,
        priority: isHr(req.user) ? priority : undefined,
      },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { listTickets, createTicket, updateTicket };
