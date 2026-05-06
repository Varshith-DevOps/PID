const prisma = require('../config/database');

const DEFAULT_LEAVE_QUOTAS = [
  { leaveType: 'ANNUAL', quota: 20 },
  { leaveType: 'SICK', quota: 10 },
  { leaveType: 'CASUAL', quota: 5 },
];

const ensureLeaveQuotas = async (employeeId, year) => {
  let quotas = await prisma.leaveQuota.findMany({
    where: { employeeId, year },
    orderBy: { leaveType: 'asc' },
  });

  if (quotas.length === 0) {
    await prisma.leaveQuota.createMany({
      data: DEFAULT_LEAVE_QUOTAS.map((quota) => ({ ...quota, employeeId, year })),
    });
    quotas = await prisma.leaveQuota.findMany({
      where: { employeeId, year },
      orderBy: { leaveType: 'asc' },
    });
  }

  return quotas;
};

const buildLeaveBalance = async (employeeId, year) => {
  const quotas = await ensureLeaveQuotas(employeeId, year);
  const leaves = await prisma.leave.groupBy({
    by: ['leaveType'],
    where: {
      employeeId,
      status: 'APPROVED',
      startDate: { gte: new Date(year, 0, 1) },
      endDate: { lte: new Date(year, 11, 31, 23, 59, 59, 999) },
    },
    _sum: { days: true },
  });

  const usedMap = {};
  for (const leave of leaves) {
    usedMap[leave.leaveType] = leave._sum.days || 0;
  }

  return quotas.map((quota) => ({
    ...quota,
    used: usedMap[quota.leaveType] || 0,
    remaining: quota.quota - (usedMap[quota.leaveType] || 0),
  }));
};

const createLeaveRequest = async (req, res) => {
  try {
    const { employeeId, leaveType, startDate, endDate, reason } = req.body;

    if (!employeeId || !leaveType || !startDate || !endDate) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    const leave = await prisma.leave.create({
      data: { employeeId, leaveType, startDate: start, endDate: end, days, reason },
      include: { employee: { select: { id: true, firstName: true, lastName: true } } },
    });

    res.status(201).json(leave);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const getLeaveRequests = async (req, res) => {
  try {
    const { employeeId, status, page = 1, limit = 20 } = req.query;
    const where = {};

    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;

    const leaves = await prisma.leave.findMany({
      where,
      include: { employee: { select: { id: true, firstName: true, lastName: true, department: true } } },
      skip: (page - 1) * limit,
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
    });

    const total = await prisma.leave.count({ where });
    res.json({ leaves, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const approveLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const leave = await prisma.leave.findUnique({ where: { id } });
    if (!leave) return res.status(404).json({ error: 'Leave not found' });

    const updated = await prisma.leave.update({
      where: { id },
      data: { status: 'APPROVED', approvedBy: req.user?.id, approvedAt: new Date() },
      include: { employee: true },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const rejectLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectReason } = req.body;
    const leave = await prisma.leave.findUnique({ where: { id } });
    if (!leave) return res.status(404).json({ error: 'Leave not found' });

    const updated = await prisma.leave.update({
      where: { id },
      data: { status: 'REJECTED', approvedBy: req.user?.id, rejectReason },
      include: { employee: true },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const cancelLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const leave = await prisma.leave.findUnique({ where: { id } });
    if (!leave) return res.status(404).json({ error: 'Leave not found' });

    if (leave.status !== 'PENDING') {
      return res.status(400).json({ error: 'Can only cancel pending leaves' });
    }

    const updated = await prisma.leave.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const getMyLeaves = async (req, res) => {
  try {
    const { status } = req.query;
    const where = { employeeId: req.user.id };
    if (status) where.status = status;

    const leaves = await prisma.leave.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json(leaves);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const getLeaveBalance = async (req, res) => {
  try {
    const { employeeId, year } = req.query;
    if (!employeeId) return res.status(400).json({ error: 'Employee is required' });

    const targetYear = parseInt(year || new Date().getFullYear());
    const balance = await buildLeaveBalance(employeeId, targetYear);
    res.json(balance);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const getAllLeaveBalances = async (req, res) => {
  try {
    const targetYear = parseInt(req.query.year || new Date().getFullYear());
    const employees = await prisma.employee.findMany({
      where: { isActive: true },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        jobTitle: true,
        department: { select: { name: true } },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    const balances = await Promise.all(
      employees.map(async (employee) => ({
        employee,
        balances: await buildLeaveBalance(employee.id, targetYear),
      }))
    );

    res.json({ year: targetYear, employees: balances });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const getLeaveCalendar = async (req, res) => {
  try {
    const year = parseInt(req.query.year || new Date().getFullYear());
    const month = parseInt(req.query.month || new Date().getMonth() + 1);
    const employeeId = req.query.employeeId;

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    const where = {
      startDate: { lte: end },
      endDate: { gte: start },
      ...(employeeId ? { employeeId } : {}),
    };

    const leaves = await prisma.leave.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: [{ startDate: 'asc' }, { createdAt: 'desc' }],
    });

    res.json({ year, month, leaves });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  createLeaveRequest,
  getLeaveRequests,
  approveLeave,
  rejectLeave,
  cancelLeave,
  getMyLeaves,
  getLeaveBalance,
  getAllLeaveBalances,
  getLeaveCalendar,
};
