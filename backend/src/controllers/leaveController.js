/**
 * @fileoverview Leave management controller.
 * Handles leave requests, approvals, rejections, balance tracking,
 * and leave calendar views.
 * @module controllers/leaveController
 */

const prisma = require('../config/database');
const { canAccessEmployee, canApproveEmployeeWorkflow, getEmployeeScopeIds, isHr, isPayroll } = require('../services/accessControl');
const { assertPayrollRangeOpen } = require('../services/payrollPeriodGuard');

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
      status: { in: ['APPROVED', 'PENDING'] },
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
    if (!(await canAccessEmployee(req.user, employeeId))) {
      return res.status(403).json({ error: 'Access denied. You can only request leave for authorized employees.' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      return res.status(400).json({ error: 'End date cannot be before start date' });
    }
    await assertPayrollRangeOpen(start, end, 'Leave request');
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    if (leaveType !== 'UNPAID') {
      const year = start.getFullYear();
      const balances = await buildLeaveBalance(employeeId, year);
      const quota = balances.find(b => b.leaveType === leaveType);
      if (quota && quota.remaining < days) {
        return res.status(400).json({ error: `Insufficient leave balance. Remaining: ${quota.remaining} days, Requested: ${days} days.` });
      }
    }

    const leave = await prisma.leave.create({
      data: { employeeId, leaveType, startDate: start, endDate: end, days, reason },
      include: { employee: { select: { id: true, firstName: true, lastName: true } } },
    });

    res.status(201).json(leave);
  } catch (error) {
    console.error('[CREATE LEAVE REQUEST ERROR]:', error);
    res.status(500).json({ error: 'Server error', message: error.message });
  }
};

const getLeaveRequests = async (req, res) => {
  try {
    const { employeeId, status, page = 1, limit = 20 } = req.query;
    const where = {};

    if (employeeId) where.employeeId = employeeId;
    if (employeeId && !(await canAccessEmployee(req.user, employeeId))) {
      return res.status(403).json({ error: 'Access denied for requested employee leave records' });
    }
    if (!employeeId && !(isHr(req.user) || isPayroll(req.user))) {
      const scopeIds = await getEmployeeScopeIds(req.user);
      where.employeeId = { in: scopeIds.length ? scopeIds : ['__no_employee_scope__'] };
    }
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
    if (!(await canApproveEmployeeWorkflow(req.user, leave.employeeId))) return res.status(403).json({ error: 'Access denied. You can only approve leave for your authorized team.' });
    if (leave.status !== 'PENDING') return res.status(400).json({ error: 'Leave request is already processed' });
    await assertPayrollRangeOpen(leave.startDate, leave.endDate, 'Leave approval');

    if (leave.leaveType !== 'UNPAID') {
      const year = new Date(leave.startDate).getFullYear();
      const balances = await buildLeaveBalance(leave.employeeId, year);
      const quota = balances.find(b => b.leaveType === leave.leaveType);
      if (quota && quota.remaining < leave.days) {
        return res.status(400).json({ error: `Insufficient leave balance. Remaining: ${quota.remaining} days, Requested: ${leave.days} days.` });
      }
    }

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
    if (!(await canApproveEmployeeWorkflow(req.user, leave.employeeId))) return res.status(403).json({ error: 'Access denied. You can only reject leave for your authorized team.' });
    await assertPayrollRangeOpen(leave.startDate, leave.endDate, 'Leave rejection');

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
    if (!(await canAccessEmployee(req.user, leave.employeeId))) {
      return res.status(403).json({ error: 'Access denied. You can only cancel authorized leave requests.' });
    }
    await assertPayrollRangeOpen(leave.startDate, leave.endDate, 'Leave cancellation');

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
    const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });
    if (!employee) return res.status(404).json({ error: 'Employee profile not found' });

    const where = { employeeId: employee.id };
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
    if (!(await canAccessEmployee(req.user, employeeId))) {
      return res.status(403).json({ error: 'Access denied for requested employee leave balance' });
    }

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
    const scopeIds = (isHr(req.user) || isPayroll(req.user)) ? null : await getEmployeeScopeIds(req.user);
    const employees = await prisma.employee.findMany({
      where: { isActive: true, ...(scopeIds ? { id: { in: scopeIds.length ? scopeIds : ['__no_employee_scope__'] } } : {}) },
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
    if (employeeId && !(await canAccessEmployee(req.user, employeeId))) {
      return res.status(403).json({ error: 'Access denied for requested employee leave calendar' });
    }

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    const where = {
      startDate: { lte: end },
      endDate: { gte: start },
      ...(employeeId ? { employeeId } : {}),
    };
    if (!employeeId && !(isHr(req.user) || isPayroll(req.user))) {
      const scopeIds = await getEmployeeScopeIds(req.user);
      where.employeeId = { in: scopeIds.length ? scopeIds : ['__no_employee_scope__'] };
    }

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
