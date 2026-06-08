/**
 * @fileoverview Overtime management controller.
 * Handles automatic overtime detection from timesheets,
 * OT approval/rejection workflows, and overtime pay calculations.
 * @module controllers/overtimeController
 */

const prisma = require('../config/database');

const getSettings = async () => {
  let settings = await prisma.payrollSettings.findFirst();
  if (!settings) {
    settings = await prisma.payrollSettings.create({ data: {} });
  }
  return settings;
};

const detectAndCreateOvertime = async (employeeId, date, hoursWorked) => {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return null;

  const activeAssignment = await prisma.shiftAssignment.findFirst({
    where: {
      employeeId,
      startDate: { lte: new Date(date) },
      OR: [{ endDate: null }, { endDate: { gte: new Date(date) } }]
    },
    include: { shiftType: true }
  });

  const dailyStandardHours = activeAssignment?.shiftType?.minimumWorkHours || 8;
  if (hoursWorked <= dailyStandardHours) return null;

  const otHours = hoursWorked - dailyStandardHours;

  // Indian Factories Act Section 59 daily work hour warning (> 12 hours)
  if (hoursWorked > 12) {
    console.warn(`[Statutory warning]: Employee ${employeeId} worked ${hoursWorked} hours, exceeding the daily 12-hour limit under the Factories Act.`);
  }

  // Quarterly legal cap check (75 hours limit under state amendments)
  const quarterStart = new Date(date);
  const currentMonth = quarterStart.getMonth();
  const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
  quarterStart.setMonth(quarterStartMonth, 1);
  quarterStart.setHours(0, 0, 0, 0);

  const quarterEnd = new Date(quarterStart);
  quarterEnd.setMonth(quarterStartMonth + 3, 0);
  quarterEnd.setHours(23, 59, 59, 999);

  const totalQuarterOT = await prisma.overtime.aggregate({
    where: {
      employeeId,
      status: 'APPROVED',
      date: { gte: quarterStart, lte: quarterEnd }
    },
    _sum: { otHours: true }
  });

  const currentQuarterHours = totalQuarterOT._sum.otHours || 0;
  const exceedsLimit = currentQuarterHours + otHours > 75;
  if (exceedsLimit) {
    console.warn(`[Statutory cap limit]: Employee ${employeeId} quarterly overtime is reaching ${currentQuarterHours + otHours} hours (legal limit: 75 hours).`);
  }

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const existingOt = await prisma.overtime.findFirst({
    where: { employeeId, date: { gte: startOfDay, lte: endOfDay } },
  });

  if (existingOt) {
    return await prisma.overtime.update({
      where: { id: existingOt.id },
      data: { otHours, exceedsLimit, updatedAt: new Date() },
    });
  }

  return await prisma.overtime.create({
    data: {
      employeeId,
      date: new Date(date),
      regularHours: dailyStandardHours,
      otHours,
      status: 'PENDING',
      exceedsLimit,
    },
  });
};

const getEmployeeOvertime = async (req, res) => {
  try {
    const { employeeId, status, startDate, endDate } = req.query;
    const where = {};

    // BOLA/IDOR Check: EMPLOYEE can only view their own overtime records
    if (req.user?.role === 'EMPLOYEE') {
      const linkedEmployee = await prisma.employee.findUnique({ where: { userId: req.user.id } });
      if (!linkedEmployee) return res.status(403).json({ error: 'No employee profile linked to your account' });
      where.employeeId = linkedEmployee.id;
    } else if (employeeId) {
      where.employeeId = employeeId;
    }

    if (status) where.status = status;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const overtime = await prisma.overtime.findMany({
      where,
      include: { employee: { select: { id: true, firstName: true, lastName: true, department: true } } },
      orderBy: { date: 'desc' },
    });

    res.json(overtime);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const approveOvertime = async (req, res) => {
  try {
    const { id } = req.params;

    const overtime = await prisma.overtime.findUnique({ where: { id } });
    if (!overtime) return res.status(404).json({ error: 'Overtime not found' });

    if (overtime.status !== 'PENDING') {
      return res.status(400).json({ error: 'Already processed' });
    }

    const updated = await prisma.overtime.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: req.user?.id,
        approvedAt: new Date(),
      },
      include: { employee: true },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const rejectOvertime = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectReason } = req.body;

    const overtime = await prisma.overtime.findUnique({ where: { id } });
    if (!overtime) return res.status(404).json({ error: 'Overtime not found' });

    const updated = await prisma.overtime.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvedBy: req.user?.id,
        rejectReason,
      },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const calculateOTPay = (structureOrBasic, otHours, settings, employee) => {
  const isIndia = !employee || !employee.timezone || employee.timezone === 'Asia/Kolkata';
  const defaultMultiplier = isIndia ? 2.0 : 1.5;
  const multiplier = settings?.otMultiplier !== undefined && settings.otMultiplier !== 1.5
    ? settings.otMultiplier
    : defaultMultiplier;

  let ordinaryWages = 0;
  if (typeof structureOrBasic === 'object' && structureOrBasic !== null) {
    const basic = structureOrBasic.basicSalary || 0;
    const da = structureOrBasic.da || 0;
    const allowances = (structureOrBasic.hra || 0) + (structureOrBasic.conveyance || 0) + (structureOrBasic.medical || 0) + (structureOrBasic.specialAllowance || 0) + (structureOrBasic.otherAllowance || 0);
    ordinaryWages = basic + da + allowances;
  } else {
    ordinaryWages = Number(structureOrBasic) || 0;
  }

  const hourlyRate = ordinaryWages / (settings?.standardHours || 176);
  const otRate = hourlyRate * multiplier;
  return Math.round(otHours * otRate * 100) / 100;
};

const getOTSummary = async (req, res) => {
  try {
    const { month, year } = req.query;
    const targetMonth = parseInt(month) || new Date().getMonth() + 1;
    const targetYear = parseInt(year) || new Date().getFullYear();

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0);

    const approvedOvertime = await prisma.overtime.findMany({
      where: {
        status: 'APPROVED',
        date: { gte: startDate, lte: endDate },
      },
      include: { employee: { include: { salaryStructure: true } } },
    });

    const settings = await getSettings();
    let totalOTPay = 0;
    const summary = [];

    for (const ot of approvedOvertime) {
      const basicSalary = ot.employee.salaryStructure?.basicSalary || 0;
      const otPay = calculateOTPay(ot.employee.salaryStructure || basicSalary, ot.otHours, settings, ot.employee);
      totalOTPay += otPay;

      summary.push({
        employee: ot.employee,
        otHours: ot.otHours,
        basicSalary,
        otPay,
      });
    }

    res.json({ month: targetMonth, year: targetYear, totalOTPay, summary, settings });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const updateSettings = async (req, res) => {
  try {
    const { otMultiplier, standardHours } = req.body;

    const settings = await prisma.payrollSettings.updateMany({
      data: {
        ...(otMultiplier !== undefined && { otMultiplier }),
        ...(standardHours !== undefined && { standardHours }),
      },
    });

    res.json(await getSettings());
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  detectAndCreateOvertime,
  getEmployeeOvertime,
  approveOvertime,
  rejectOvertime,
  calculateOTPay,
  getOTSummary,
  updateSettings,
};