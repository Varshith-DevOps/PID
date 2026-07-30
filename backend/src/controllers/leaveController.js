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

const sendControllerError = (res, error, fallback = 'Could not update the leave request. Please try again.') => {
  const status = error.status || error.statusCode || 500;
  if (status >= 500) {
    console.error('[LEAVE ACTION ERROR]:', error.message);
  }
  return res.status(status).json({ error: error.message || fallback });
};

const leaveActionResponse = (res, message, leaveRequest) => res.json({
  success: true,
  message,
  leaveRequest,
});

const getApprovalAvailability = async (leave) => {
  const year = new Date(leave.startDate).getFullYear();
  const quota = await prisma.leaveQuota.findFirst({
    where: {
      employeeId: leave.employeeId,
      year,
      leaveType: leave.leaveType,
    },
  });

  if (!quota) return null;

  const approved = await prisma.leave.aggregate({
    where: {
      employeeId: leave.employeeId,
      leaveType: leave.leaveType,
      status: 'APPROVED',
      startDate: { gte: new Date(year, 0, 1) },
      endDate: { lte: new Date(year, 11, 31, 23, 59, 59, 999) },
      id: { not: leave.id },
    },
    _sum: { days: true },
  });

  const used = approved._sum.days || 0;
  return { quota, used, remaining: quota.quota - used };
};

const ensureLeaveQuotas = async (employeeId, year) => {
  let quotas = await prisma.leaveQuota.findMany({
    where: { employeeId, year },
    orderBy: { leaveType: 'asc' },
  });

  const existingTypes = new Set(quotas.map((q) => q.leaveType));
  const missingQuotas = DEFAULT_LEAVE_QUOTAS.filter((q) => !existingTypes.has(q.leaveType));

  if (missingQuotas.length > 0) {
    await prisma.leaveQuota.createMany({
      data: missingQuotas.map((quota) => ({ ...quota, employeeId, year })),
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

const checkLeaveCollision = async (employeeId, startDate, endDate) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { department: true }
    });
    if (!employee || !employee.departmentId) return null;

    const totalDeptEmployees = await prisma.employee.count({
      where: { departmentId: employee.departmentId, isActive: true }
    });
    if (totalDeptEmployees === 0) return null;

    const overlappingLeaves = await prisma.leave.findMany({
      where: {
        employee: { departmentId: employee.departmentId, isActive: true },
        status: 'APPROVED',
        startDate: { lte: new Date(endDate) },
        endDate: { gte: new Date(startDate) }
      },
      select: {
        startDate: true,
        endDate: true,
        employeeId: true
      }
    });

    const start = new Date(startDate);
    const end = new Date(endDate);
    let maxAbsentPct = 0;
    let maxAbsentCount = 0;

    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const currentDay = new Date(d);
      const absentEmployees = new Set();
      
      overlappingLeaves.forEach(leave => {
        const leaveStart = new Date(leave.startDate);
        const leaveEnd = new Date(leave.endDate);
        if (currentDay >= leaveStart && currentDay <= leaveEnd) {
          absentEmployees.add(leave.employeeId);
        }
      });
      absentEmployees.add(employeeId);

      const pct = (absentEmployees.size / totalDeptEmployees) * 100;
      if (pct > maxAbsentPct) {
        maxAbsentPct = pct;
        maxAbsentCount = absentEmployees.size;
      }
    }

    if (maxAbsentPct > 30) {
      return {
        warning: true,
        message: `Warning: Absenteeism in the ${employee.department.name} department will reach ${Math.round(maxAbsentPct)}% (${maxAbsentCount} of ${totalDeptEmployees} employees) during this period.`,
        percentage: Math.round(maxAbsentPct),
        absentCount: maxAbsentCount,
        totalCount: totalDeptEmployees
      };
    }
  } catch (err) {
    console.error('[COLLISION CHECKER ERROR]:', err.message);
  }
  return null;
};

const createLeaveRequest = async (req, res) => {
  try {
    const { employeeId, leaveType, startDate, endDate, reason } = req.body;

    if (!employeeId || !leaveType || !startDate || !endDate) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    if (!employee.isActive) return res.status(403).json({ error: 'Inactive employees cannot create new leave requests.' });
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
      if (!quota) {
        return res.status(400).json({ error: `Leave type ${leaveType} is not configured for this employee.` });
      }
      if (quota.remaining < days) {
        return res.status(400).json({ error: `Insufficient leave balance. Remaining: ${quota.remaining} days, Requested: ${days} days.` });
      }
    }

    const collisionWarning = await checkLeaveCollision(employeeId, start, end);

    const leave = await prisma.leave.create({
      data: { employeeId, leaveType, startDate: start, endDate: end, days, reason },
      include: { employee: { select: { id: true, firstName: true, lastName: true } } },
    });

    res.status(201).json({
      ...leave,
      collisionWarning: collisionWarning || null
    });
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
    const leave = await prisma.leave.findUnique({ where: { id }, include: { employee: true } });
    if (!leave) return res.status(404).json({ error: 'Leave not found' });
    if (!leave.employee) return res.status(404).json({ error: 'Employee not found for this leave request.' });
    if (!(await canApproveEmployeeWorkflow(req.user, leave.employeeId))) {
      return res.status(403).json({ error: 'You are not authorized to approve or reject this leave request.' });
    }
    if (leave.status !== 'PENDING') return res.status(409).json({ error: 'This leave request has already been processed.' });
    if (new Date(leave.endDate) < new Date(leave.startDate)) {
      return res.status(400).json({ error: 'Leave request date range is invalid.' });
    }
    await assertPayrollRangeOpen(leave.startDate, leave.endDate, 'Leave approval');

    const overlappingLeave = await prisma.leave.findFirst({
      where: {
        employeeId: leave.employeeId,
        id: { not: id },
        status: 'APPROVED',
        startDate: { lte: leave.endDate },
        endDate: { gte: leave.startDate },
      },
      select: { id: true },
    });
    if (overlappingLeave) {
      return res.status(409).json({ error: 'This leave request overlaps an already approved leave.' });
    }

    if (leave.leaveType !== 'UNPAID') {
      const availability = await getApprovalAvailability(leave);
      if (!availability) {
        return res.status(400).json({ error: 'Leave balance is not configured for this employee.' });
      }
      if (availability.remaining < leave.days) {
        return res.status(400).json({ error: `Insufficient leave balance. Remaining: ${availability.remaining} days, Requested: ${leave.days} days.` });
      }
    }

    const updated = await prisma.$transaction(async (tx) => tx.leave.update({
      where: { id },
      data: { status: 'APPROVED', approvedBy: req.user?.id, approvedAt: new Date(), rejectReason: null },
      include: { employee: { select: { id: true, firstName: true, lastName: true, department: true } } },
    }));

    const collisionWarning = await checkLeaveCollision(leave.employeeId, leave.startDate, leave.endDate);

    return res.json({
      success: true,
      message: 'Leave request approved successfully.',
      leaveRequest: updated,
      collisionWarning: collisionWarning || null
    });
  } catch (error) {
    return sendControllerError(res, error);
  }
};

const rejectLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const rejectReason = String(req.body?.rejectReason || req.body?.reason || '').trim();
    if (!rejectReason) return res.status(400).json({ error: 'Rejection reason is required.' });

    const leave = await prisma.leave.findUnique({ where: { id }, include: { employee: true } });
    if (!leave) return res.status(404).json({ error: 'Leave not found' });
    if (!leave.employee) return res.status(404).json({ error: 'Employee not found for this leave request.' });
    if (!(await canApproveEmployeeWorkflow(req.user, leave.employeeId))) {
      return res.status(403).json({ error: 'You are not authorized to approve or reject this leave request.' });
    }
    if (leave.status !== 'PENDING') return res.status(409).json({ error: 'This leave request has already been processed.' });

    const updated = await prisma.$transaction(async (tx) => tx.leave.update({
      where: { id },
      data: { status: 'REJECTED', approvedBy: req.user?.id, rejectReason },
      include: { employee: { select: { id: true, firstName: true, lastName: true, department: true } } },
    }));

    return leaveActionResponse(res, 'Leave request rejected successfully.', updated);
  } catch (error) {
    return sendControllerError(res, error);
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
    return sendControllerError(res, error);
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
