/**
 * @fileoverview Timesheet controller.
 * Manages daily work hour logging, aggregation, and attendance generation
 * from timesheet data. Auto-detects overtime entries.
 * @module controllers/timesheetController
 */

const prisma = require('../config/database');
const { canAccessEmployee, getEmployeeScopeIds, isHr } = require('../services/accessControl');

const getDayRange = (date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const recomputeTaskActualHours = async (taskId, tx = prisma) => {
  if (!taskId) return;
  const total = await tx.timesheet.aggregate({
    where: { taskId },
    _sum: { hoursWorked: true },
  });
  await tx.task.update({
    where: { id: taskId },
    data: { actualHours: total._sum.hoursWorked || 0 },
  });
};

const logTimesheet = async (req, res) => {
  try {
    const { employeeId, taskId, date, hoursWorked, description } = req.body;

    if (!employeeId || !hoursWorked || !date) {
      return res.status(400).json({ error: 'Employee, date and hours required' });
    }
    if (!(await canAccessEmployee(req.user, employeeId))) {
      return res.status(403).json({ error: 'Access denied. You can only log timesheets for authorized employees.' });
    }
    const parsedHours = Number(hoursWorked);
    if (!Number.isFinite(parsedHours) || parsedHours <= 0 || parsedHours > 24) {
      return res.status(400).json({ error: 'Hours worked must be greater than 0 and not exceed 24.' });
    }

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const safeTaskId = taskId || null;
    if (safeTaskId) {
      const task = await prisma.task.findUnique({
        where: { id: safeTaskId },
        select: { id: true, assigneeId: true },
      });
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      if (task.assigneeId !== employeeId) {
        return res.status(400).json({ error: 'Timesheets can only be logged against tasks assigned to the employee.' });
      }
    }

    const { start, end } = getDayRange(targetDate);
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.timesheet.findFirst({
        where: { employeeId, taskId: safeTaskId, date: targetDate }
      });

      const timesheet = existing
        ? await tx.timesheet.update({
          where: { id: existing.id },
          data: { hoursWorked: parsedHours, description: description || null },
          include: { task: { select: { id: true, title: true } }, employee: { select: { firstName: true, lastName: true } } },
        })
        : await tx.timesheet.create({
          data: { employeeId, taskId: safeTaskId, date: targetDate, hoursWorked: parsedHours, description: description || null },
          include: { task: { select: { id: true, title: true } }, employee: { select: { firstName: true, lastName: true } } },
        });

      await recomputeTaskActualHours(safeTaskId, tx);
      const totalForDay = await tx.timesheet.aggregate({
        where: { employeeId, date: { gte: start, lte: end } },
        _sum: { hoursWorked: true },
      });

      return { timesheet, totalHoursForDay: totalForDay._sum.hoursWorked || parsedHours };
    });

    const overtimeController = require('./overtimeController');
    await overtimeController.detectAndCreateOvertime(employeeId, targetDate, result.totalHoursForDay);

    res.json(result.timesheet);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getEmployeeTimesheets = async (req, res) => {
  try {
    const targetEmployeeId = req.params.employeeId || req.query.employeeId;

    if (!targetEmployeeId) {
      return res.status(400).json({ error: 'Employee ID is required' });
    }

    if (!(await canAccessEmployee(req.user, targetEmployeeId))) {
      return res.status(403).json({ error: 'Access denied for requested timesheets.' });
    }

    const { startDate, endDate } = req.query;
    const where = { employeeId: targetEmployeeId };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }
    if (!isHr(req.user)) {
      const employeeIds = await getEmployeeScopeIds(req.user);
      where.employeeId = { in: employeeIds.length ? employeeIds : ['__no_employee_scope__'] };
    }

    const timesheets = await prisma.timesheet.findMany({
      where,
      include: { task: { select: { id: true, title: true, project: true } } },
      orderBy: { date: 'desc' },
      take: 150,
    });

    const summary = {};
    let totalHours = 0;
    for (const t of timesheets) {
      const dateKey = t.date.toISOString().split('T')[0];
      if (!summary[dateKey]) summary[dateKey] = 0;
      summary[dateKey] += t.hoursWorked;
      totalHours += t.hoursWorked;
    }

    res.json({ timesheets, summary, totalHours });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getAllTimesheets = async (req, res) => {
  try {
    const { date, projectId, startDate, endDate } = req.query;
    const where = {};

    if (date) where.date = new Date(date);
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }
    if (projectId) {
      where.task = { projectId };
    }
    if (!isHr(req.user)) {
      const scopeIds = await getEmployeeScopeIds(req.user);
      where.employeeId = { in: scopeIds.length ? scopeIds : ['__no_employee_scope__'] };
    }

    const timesheets = await prisma.timesheet.findMany({
      where,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, department: true } },
        task: { include: { project: { select: { id: true, name: true } } } },
      },
      orderBy: { date: 'desc' },
    });

    const empWhere = { isActive: true };
    if (!isHr(req.user)) {
      const scopeIds = await getEmployeeScopeIds(req.user);
      empWhere.id = { in: scopeIds.length ? scopeIds : ['__no_employee_scope__'] };
    }
    const employees = await prisma.employee.findMany({ where: empWhere, include: { department: true } });
    const activeEmployeeIds = new Set(employees.map(e => e.id));

    const aggregated = {};
    for (const t of timesheets) {
      const eId = t.employeeId;
      if (!aggregated[eId]) {
        aggregated[eId] = {
          employee: t.employee,
          totalHours: 0,
          daily: {},
        };
      }
      aggregated[eId].totalHours += t.hoursWorked;
      const dateKey = t.date.toISOString().split('T')[0];
      if (!aggregated[eId].daily[dateKey]) aggregated[eId].daily[dateKey] = 0;
      aggregated[eId].daily[dateKey] += t.hoursWorked;
    }

    for (const tid of Object.keys(aggregated)) {
      if (!activeEmployeeIds.has(tid)) {
        delete aggregated[tid];
      }
    }

    const missingEmployees = employees.filter((employee) => !aggregated[employee.id]);
    for (const employee of missingEmployees) {
      aggregated[employee.id] = {
        employee,
        totalHours: 0,
        daily: {},
      };
    }

    res.json({ timesheets, aggregated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

const generateAttendanceFromTimesheet = async (req, res) => {
  try {
    const { date, month, year } = req.body;

    let targetDate;
    if (date) {
      targetDate = new Date(date);
    } else {
      const m = month || new Date().getMonth() + 1;
      const y = year || new Date().getFullYear();
      targetDate = new Date(y, m - 1, 1);
    }

    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);

    const timesheets = await prisma.timesheet.findMany({
      where: { date: { gte: startDate, lte: endDate } },
    });

    const employeeHours = {};
    for (const t of timesheets) {
      if (!employeeHours[t.employeeId]) employeeHours[t.employeeId] = 0;
      employeeHours[t.employeeId] += t.hoursWorked;
    }

    const employees = await prisma.employee.findMany({ where: { isActive: true } });

    const attendanceRecords = [];
    let created = 0;
    let updated = 0;

    for (const emp of employees) {
      const hours = employeeHours[emp.id] || 0;
      let status = 'ABSENT';
      if (hours === 0) status = 'ABSENT';
      else if (hours < 8) status = 'HALF_DAY';
      else if (hours >= 8) status = 'PRESENT';

      const existing = await prisma.attendance.findFirst({
        where: { employeeId: emp.id, date: { gte: startDate, lte: endDate } },
      });

      if (existing) {
        await prisma.attendance.update({
          where: { id: existing.id },
          data: { status, workHours: hours, updatedAt: new Date() },
        });
        updated++;
      } else {
        await prisma.attendance.create({
          data: { employeeId: emp.id, date: startDate, status, workHours: hours },
        });
        created++;
      }
      attendanceRecords.push({ employeeId: emp.id, hours, status });
    }

    res.json({ message: 'Created: ' + created + ', Updated: ' + updated, records: attendanceRecords });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getDailySummary = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = new Date(date || Date.now());
    targetDate.setHours(0, 0, 0, 0);
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);

    const timesheets = await prisma.timesheet.findMany({
      where: { date: { gte: targetDate, lte: endDate } },
      include: { employee: { select: { firstName: true, lastName: true } }, task: { select: { title: true } } },
    });
    const employeeIds = !isHr(req.user) ? new Set(await getEmployeeScopeIds(req.user)) : null;
    if (employeeIds) {
      timesheets.splice(0, timesheets.length, ...timesheets.filter((t) => employeeIds.has(t.employeeId)));
    }

    const employeeSummary = {};
    for (const t of timesheets) {
      const name = t.employee.firstName + ' ' + t.employee.lastName;
      if (!employeeSummary[name]) employeeSummary[name] = 0;
      employeeSummary[name] += t.hoursWorked;
    }

    const empWhere = { isActive: true };
    if (employeeIds) {
      empWhere.id = { in: employeeIds.size ? Array.from(employeeIds) : ['__no_employee_scope__'] };
    }
    const activeEmployees = await prisma.employee.findMany({ where: empWhere, select: { id: true } });

    const totalHours = timesheets.reduce(function(sum, t) { return sum + t.hoursWorked; }, 0);
    const presentKeys = Object.keys(employeeSummary).filter(function(name) { return employeeSummary[name] >= 8; });
    const partialKeys = Object.keys(employeeSummary).filter(function(name) { return employeeSummary[name] > 0 && employeeSummary[name] < 8; });
    const absent = Math.max(activeEmployees.length - presentKeys.length - partialKeys.length, 0);

    res.json({ date: targetDate.toISOString(), totalHours: totalHours, present: presentKeys.length, partial: partialKeys.length, absent, breakdown: employeeSummary });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  logTimesheet,
  getEmployeeTimesheets,
  getAllTimesheets,
  generateAttendanceFromTimesheet,
  getDailySummary,
};
