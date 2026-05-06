const prisma = require('../config/database');
const salaryCalculator = require('../services/salaryService');
const PDFDocument = require('pdfkit');

const MANUAL_PAYROLL_STAGES = [
  { key: 'attendanceLocked', label: 'Attendance locked for previous month', required: true },
  { key: 'lopsAdded', label: 'LOP / unpaid leaves added and verified', required: true },
  { key: 'salaryRevisionUpdated', label: 'Salary revision history updated', required: true },
  { key: 'incomeTaxDeclaration', label: 'Income tax declarations reviewed', required: true },
  { key: 'investmentProofs', label: 'Investment forms / proofs verified', required: true },
  { key: 'arrearsReviewed', label: 'Arrears reviewed and entered if any', required: true },
  { key: 'incentivesReviewed', label: 'Incentives reviewed and entered if any', required: true },
  { key: 'overtimeApproved', label: 'Overtime requests approved/rejected', required: true },
  { key: 'statutoryComplianceReviewed', label: 'PF, ESI/PT if applicable, TDS and gratuity compliance checked', required: true },
  { key: 'bankAndPayoutVerified', label: 'Bank details and payout file inputs verified', required: true },
];

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
const getPeriod = (month, year) => {
  const now = new Date();
  return {
    targetMonth: parseInt(month) || now.getMonth() + 1,
    targetYear: parseInt(year) || now.getFullYear(),
  };
};
const getPeriodDates = (month, year) => ({
  startDate: new Date(year, month - 1, 1),
  endDate: new Date(year, month, 0, 23, 59, 59, 999),
});
const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const getSalaryStructure = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const structure = await prisma.salaryStructure.findUnique({ where: { employeeId } });
    if (!structure) return res.json(null);

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { joinDate: true },
    });

    const yearsOfService = employee?.joinDate
      ? (new Date() - new Date(employee.joinDate)) / (365.25 * 24 * 60 * 60 * 1000)
      : 0;

    const pf = salaryCalculator.calculatePF(structure.basicSalary, structure.pfEnabled);
    const tds = structure.tdsEnabled
      ? salaryCalculator.calculateTDS(structure.basicSalary)
      : 0;
    const gratuity = salaryCalculator.calculateGratuity(structure.basicSalary, yearsOfService);

    res.json({ ...structure, calculations: { pf, tds, gratuity, yearsOfService: yearsOfService.toFixed(1) } });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const setSalaryStructure = async (req, res) => {
  try {
    const { employeeId, basicSalary, hra, da, conveyance, conveyence, medical, specialAllowance, otherAllowance, pfEnabled, pfRate, tdsEnabled, insurance, otherDeduction } = req.body;

    if (!employeeId || !basicSalary) {
      return res.status(400).json({ error: 'Employee ID and basic salary required' });
    }

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const structure = await prisma.salaryStructure.upsert({
      where: { employeeId },
      create: {
        employeeId,
        basicSalary,
        hra: hra || 0,
        da: da || 0,
        conveyance: conveyance ?? conveyence ?? 0,
        medical: medical || 0,
        specialAllowance: specialAllowance || 0,
        otherAllowance: otherAllowance || 0,
        pfEnabled: pfEnabled !== false,
        pfRate: pfRate || 0.12,
        tdsEnabled: tdsEnabled !== false,
        insurance: insurance || 0,
        otherDeduction: otherDeduction || 0,
      },
      update: {
        basicSalary,
        hra,
        da,
        conveyance: conveyance ?? conveyence ?? 0,
        medical,
        specialAllowance,
        otherAllowance,
        pfEnabled: pfEnabled !== undefined ? pfEnabled : true,
        pfRate,
        tdsEnabled: tdsEnabled !== undefined ? tdsEnabled : true,
        insurance,
        otherDeduction,
      },
    });

    res.json(structure);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const getPayrollPreflight = async (req, res) => {
  try {
    const { targetMonth, targetYear } = getPeriod(req.query.month, req.query.year);
    const { startDate, endDate } = getPeriodDates(targetMonth, targetYear);

    const existing = await prisma.payrollRun.findUnique({
      where: { month_year: { month: targetMonth, year: targetYear } },
    });
    const employees = await prisma.employee.findMany({
      where: { isActive: true },
      include: {
        salaryStructure: true,
        bankDetails: true,
        pfDetails: true,
        salaryRevisions: { where: { effectiveDate: { lte: endDate } }, orderBy: { effectiveDate: 'desc' } },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
    const attendances = await prisma.attendance.findMany({ where: { date: { gte: startDate, lte: endDate } } });
    const unpaidLeaves = await prisma.leave.findMany({
      where: { status: 'APPROVED', leaveType: 'UNPAID', startDate: { lte: endDate }, endDate: { gte: startDate } },
    });
    const pendingOvertime = await prisma.overtime.count({ where: { status: 'PENDING', date: { gte: startDate, lte: endDate } } });
    const approvedOvertime = await prisma.overtime.findMany({ where: { status: 'APPROVED', date: { gte: startDate, lte: endDate } } });

    const missingSalary = employees.filter((e) => !e.salaryStructure);
    const missingBank = employees.filter((e) => !e.bankDetails);
    const missingPf = employees.filter((e) => !e.pfDetails);
    const employeeSummaries = employees.map((employee) => {
      const empAttendance = attendances.filter((a) => a.employeeId === employee.id);
      const lopDays = unpaidLeaves.filter((l) => l.employeeId === employee.id).reduce((sum, leave) => sum + leave.days, 0);
      const otHours = approvedOvertime.filter((ot) => ot.employeeId === employee.id).reduce((sum, ot) => sum + ot.otHours, 0);
      return {
        id: employee.id,
        employeeId: employee.employeeId,
        name: `${employee.firstName} ${employee.lastName}`,
        salaryReady: Boolean(employee.salaryStructure),
        bankReady: Boolean(employee.bankDetails),
        pfReady: Boolean(employee.pfDetails),
        attendanceEntries: empAttendance.length,
        lopDays,
        overtimeHours: otHours,
        latestRevision: employee.salaryRevisions[0] || null,
      };
    });

    const automaticChecks = [
      { key: 'notAlreadyRun', label: 'Payroll not already processed for this period', passed: !existing, blocking: true, detail: existing ? 'Payroll already exists for this month.' : 'No payroll run exists for this period.' },
      { key: 'salaryStructures', label: 'Salary structures configured for active employees', passed: missingSalary.length === 0, blocking: true, detail: `${missingSalary.length} employee(s) missing salary structure.` },
      { key: 'pendingOvertime', label: 'No pending overtime approvals', passed: pendingOvertime === 0, blocking: true, detail: `${pendingOvertime} pending overtime request(s).` },
      { key: 'attendanceCaptured', label: 'Attendance entries available for the payroll month', passed: attendances.length > 0, blocking: false, detail: `${attendances.length} attendance record(s) found.` },
      { key: 'bankDetails', label: 'Bank details available', passed: missingBank.length === 0, blocking: false, detail: `${missingBank.length} employee(s) missing bank details.` },
      { key: 'pfDetails', label: 'PF details available where applicable', passed: missingPf.length === 0, blocking: false, detail: `${missingPf.length} employee(s) missing PF details.` },
    ];

    res.json({
      month: targetMonth,
      year: targetYear,
      manualStages: MANUAL_PAYROLL_STAGES,
      automaticChecks,
      employeeSummaries,
      summary: {
        activeEmployees: employees.length,
        lopDays: unpaidLeaves.reduce((sum, leave) => sum + leave.days, 0),
        approvedOvertimeHours: approvedOvertime.reduce((sum, ot) => sum + ot.otHours, 0),
        pendingOvertime,
      },
      canRun: automaticChecks.every((check) => !check.blocking || check.passed),
    });
  } catch (error) {
    console.error('PAYROLL PREFLIGHT ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const runPayroll = async (req, res) => {
  try {
    const { month, year, confirmations = {}, adjustments = {} } = req.body;
    const { targetMonth, targetYear } = getPeriod(month, year);

    const existing = await prisma.payrollRun.findUnique({
      where: { month_year: { month: targetMonth, year: targetYear } },
    });
    if (existing) return res.status(400).json({ error: 'Payroll already run for this period' });

    const missingConfirmations = MANUAL_PAYROLL_STAGES
      .filter((stage) => stage.required && confirmations[stage.key] !== true)
      .map((stage) => stage.label);
    if (missingConfirmations.length > 0) {
      return res.status(400).json({ error: 'Complete all manual payroll checks before running payroll', missingConfirmations });
    }

    const { startDate, endDate } = getPeriodDates(targetMonth, targetYear);

    const employees = await prisma.employee.findMany({
      where: { isActive: true },
      include: { salaryStructure: true },
    });
    const missingSalary = employees.filter((employee) => !employee.salaryStructure);
    if (missingSalary.length > 0) {
      return res.status(400).json({ error: `${missingSalary.length} active employee(s) missing salary structure` });
    }

    const attendances = await prisma.attendance.findMany({
      where: { date: { gte: startDate, lte: endDate } },
    });

    const leaveDeductions = await prisma.leave.findMany({
      where: { startDate: { lte: endDate }, endDate: { gte: startDate }, status: 'APPROVED', leaveType: 'UNPAID' },
    });

    const pendingOvertime = await prisma.overtime.count({
      where: { status: 'PENDING', date: { gte: startDate, lte: endDate } },
    });
    if (pendingOvertime > 0) return res.status(400).json({ error: `${pendingOvertime} overtime request(s) are still pending` });

    const approvedOvertime = await prisma.overtime.findMany({
      where: { status: 'APPROVED', date: { gte: startDate, lte: endDate } },
    });
    const settings = await prisma.payrollSettings.findFirst();
    if (settings) salaryCalculator.updateSettings(settings);

    const payrollRun = await prisma.payrollRun.create({
      data: { month: targetMonth, year: targetYear, status: 'PROCESSED', processedBy: req.user?.id, processedAt: new Date() },
    });

    let totalAmount = 0;
    let totalPf = 0;
    let totalTds = 0;
    let totalGratuity = 0;
    const records = [];

    for (const employee of employees) {
      if (!employee.salaryStructure) continue;

      const structure = employee.salaryStructure;
      const empAttendance = attendances.filter((a) => a.employeeId === employee.id);
      const daysWorked = empAttendance.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length;
      const unpaidLeaves = leaveDeductions.filter((l) => l.employeeId === employee.id).reduce((sum, l) => sum + l.days, 0);
      const workDays = new Date(targetYear, targetMonth, 0).getDate();
      const payableDays = Math.max(0, Math.min(workDays, daysWorked || workDays) - unpaidLeaves);
      const employeeAdjustments = adjustments[employee.id] || {};
      const arrears = money(employeeAdjustments.arrears);
      const incentives = money(employeeAdjustments.incentives);
      const otHours = approvedOvertime.filter((ot) => ot.employeeId === employee.id).reduce((sum, ot) => sum + ot.otHours, 0);
      const otPay = money(salaryCalculator.calculateOTPay(structure.basicSalary, otHours));

      const calc = payableDays < workDays
        ? salaryCalculator.calculateProportionalSalary(structure, payableDays, workDays, { tdsEnabled: structure.tdsEnabled, employeePf: structure.pfEnabled })
        : salaryCalculator.calculateNetSalary(structure, { tdsEnabled: structure.tdsEnabled, employeePf: structure.pfEnabled });
      calc.grossEarnings = money(calc.grossEarnings + arrears + incentives + otPay);
      calc.netSalary = money(calc.netSalary + arrears + incentives + otPay);
      calc.breakdowns.earnings.otherAllowance = money(calc.breakdowns.earnings.otherAllowance + arrears + incentives + otPay);

      const record = await prisma.payrollRecord.create({
        data: {
          payrollRunId: payrollRun.id,
          employeeId: employee.id,
          basicSalary: calc.breakdowns.earnings.basicSalary,
          hra: calc.breakdowns.earnings.hra,
          da: calc.breakdowns.earnings.da,
          conveyance: calc.breakdowns.earnings.conveyance,
          medical: calc.breakdowns.earnings.medical,
          specialAllowance: calc.breakdowns.earnings.specialAllowance,
          otherAllowance: calc.breakdowns.earnings.otherAllowance,
          grossEarnings: calc.grossEarnings,
          pf: calc.breakdowns.deductions.employeePf,
          tax: calc.breakdowns.deductions.tds,
          insurance: calc.breakdowns.deductions.insurance,
          otherDeductions: calc.breakdowns.deductions.otherDeductions,
          totalDeductions: calc.totalDeductions,
          netSalary: calc.netSalary,
          workDays,
          daysWorked: payableDays,
          leaves: unpaidLeaves,
          deductions: unpaidLeaves * (structure.basicSalary / workDays),
          lopDays: unpaidLeaves,
          lopDeduction: money(unpaidLeaves * (structure.basicSalary / workDays)),
          overtimeHours: otHours,
          overtimePay: otPay,
          arrears,
          incentives,
          incomeTaxDeclaration: confirmations.incomeTaxDeclaration === true,
          investmentProofs: confirmations.investmentProofs === true,
          complianceNotes: employeeAdjustments.notes || '',
        },
      });

      totalAmount += calc.netSalary;
      totalPf += calc.breakdowns.deductions.employerPf;
      totalTds += calc.breakdowns.deductions.tds;
      if (employee.joinDate) {
        const years = (new Date() - new Date(employee.joinDate)) / (365.25 * 24 * 60 * 60 * 1000);
        totalGratuity += salaryCalculator.calculateGratuity(structure.basicSalary, years);
      }
      records.push(record);
    }

    const updated = await prisma.payrollRun.update({
      where: { id: payrollRun.id },
      data: {
        totalAmount,
        employeeCount: records.length,
        totalPf,
        totalTds,
        totalGratuity,
      },
    });

    res.json({ payrollRun: updated, records, summary: { totalPf, totalTds, totalGratuity } });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const getPayrollReport = async (req, res) => {
  try {
    const { month, year } = req.query;
    const targetMonth = parseInt(month) || new Date().getMonth() + 1;
    const targetYear = parseInt(year) || new Date().getFullYear();

    const payrollRun = await prisma.payrollRun.findUnique({
      where: { month_year: { month: targetMonth, year: targetYear } },
    });

    if (!payrollRun) return res.status(404).json({ error: 'Payroll not run for this period' });

    const records = await prisma.payrollRecord.findMany({
      where: { payrollRunId: payrollRun.id },
      include: { employee: { include: { department: true } } },
    });

    res.json({ payrollRun, records, summary: { totalPf: payrollRun.totalPf, totalTds: payrollRun.totalTds, totalGratuity: payrollRun.totalGratuity } });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const getAllPayrollRuns = async (req, res) => {
  try {
    const runs = await prisma.payrollRun.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(runs);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const buildPayrollExportRows = (records) => records.map((record) => ({
  employeeId: record.employee.employeeId,
  employeeName: `${record.employee.firstName} ${record.employee.lastName}`,
  department: record.employee.department?.name || '',
  workDays: record.workDays,
  payableDays: record.daysWorked,
  lopDays: record.lopDays ?? record.leaves ?? 0,
  basicSalary: record.basicSalary,
  hra: record.hra,
  da: record.da,
  conveyance: record.conveyance,
  medical: record.medical,
  specialAllowance: record.specialAllowance,
  otherAllowance: record.otherAllowance,
  arrears: record.arrears || 0,
  incentives: record.incentives || 0,
  overtimeHours: record.overtimeHours || 0,
  overtimePay: record.overtimePay || 0,
  grossEarnings: record.grossEarnings,
  employeePf: record.pf,
  incomeTax: record.tax,
  insurance: record.insurance,
  otherDeductions: record.otherDeductions,
  lopDeduction: record.lopDeduction ?? record.deductions ?? 0,
  totalDeductions: record.totalDeductions,
  netSalary: record.netSalary,
  incomeTaxDeclaration: record.incomeTaxDeclaration ? 'Yes' : 'No',
  investmentProofs: record.investmentProofs ? 'Yes' : 'No',
  notes: record.complianceNotes || '',
}));

const getPayrollExport = async (req, res) => {
  try {
    const { format = 'csv' } = req.query;
    const { targetMonth, targetYear } = getPeriod(req.query.month, req.query.year);
    const payrollRun = await prisma.payrollRun.findUnique({
      where: { month_year: { month: targetMonth, year: targetYear } },
    });
    if (!payrollRun) return res.status(404).json({ error: 'Payroll not run for this period' });

    const records = await prisma.payrollRecord.findMany({
      where: { payrollRunId: payrollRun.id },
      include: { employee: { include: { department: true } } },
    });
    const rows = buildPayrollExportRows(records);
    const headers = Object.keys(rows[0] || {
      employeeId: '', employeeName: '', department: '', workDays: '', payableDays: '', lopDays: '', basicSalary: '', hra: '', da: '', conveyance: '', medical: '', specialAllowance: '', otherAllowance: '', arrears: '', incentives: '', overtimeHours: '', overtimePay: '', grossEarnings: '', employeePf: '', incomeTax: '', insurance: '', otherDeductions: '', lopDeduction: '', totalDeductions: '', netSalary: '', incomeTaxDeclaration: '', investmentProofs: '', notes: '',
    });
    const fileBase = `payroll-${targetYear}-${String(targetMonth).padStart(2, '0')}`;

    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileBase}.pdf"`);
      const doc = new PDFDocument({ margin: 24, size: 'A4', layout: 'landscape' });
      doc.pipe(res);
      doc.fontSize(14).text(`Payroll Salary Breakup - ${targetMonth}/${targetYear}`);
      doc.moveDown();
      rows.forEach((row) => {
        doc.fontSize(9).text(`${row.employeeId}  ${row.employeeName}  Net: ${row.netSalary}  Gross: ${row.grossEarnings}  PF: ${row.employeePf}  Tax: ${row.incomeTax}  LOP: ${row.lopDays}  OT: ${row.overtimePay}`);
      });
      doc.end();
      return;
    }

    if (format === 'excel') {
      res.setHeader('Content-Type', 'application/vnd.ms-excel');
      res.setHeader('Content-Disposition', `attachment; filename="${fileBase}.xls"`);
      const htmlRows = rows.map((row) => `<tr>${headers.map((header) => `<td>${row[header] ?? ''}</td>`).join('')}</tr>`).join('');
      return res.send(`<table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${htmlRows}</tbody></table>`);
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fileBase}.csv"`);
    const csv = [headers.join(','), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(','))].join('\n');
    return res.send(csv);
  } catch (error) {
    console.error('PAYROLL EXPORT ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const calculateEmployeeSalary = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { month, year } = req.query;

    const structure = await prisma.salaryStructure.findUnique({ where: { employeeId } });
    if (!structure) return res.status(404).json({ error: 'Salary structure not found' });

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { joinDate: true },
    });

    const targetMonth = parseInt(month) || new Date().getMonth() + 1;
    const targetYear = parseInt(year) || new Date().getFullYear();
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0);

    const attendances = await prisma.attendance.findMany({
      where: { employeeId, date: { gte: startDate, lte: endDate } },
    });

    const daysWorked = attendances.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length;
    const workDays = 20;

    const calc = daysWorked < workDays
      ? salaryCalculator.calculateProportionalSalary(structure, daysWorked, workDays, { tdsEnabled: structure.tdsEnabled, employeePf: structure.pfEnabled })
      : salaryCalculator.calculateNetSalary(structure, { tdsEnabled: structure.tdsEnabled, employeePf: structure.pfEnabled });

    const yearsOfService = employee?.joinDate
      ? (new Date() - new Date(employee.joinDate)) / (365.25 * 24 * 60 * 60 * 1000)
      : 0;

    res.json({
      employeeId,
      month: targetMonth,
      year: targetYear,
      yearsOfService: yearsOfService.toFixed(1),
      baseSalary: structure.basicSalary,
      calculation: calc,
      settings: salaryCalculator.getSettings(),
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const getPayrollSettings = async (req, res) => {
  try {
    let settings = await prisma.payrollSettings.findFirst();
    if (!settings) {
      settings = await prisma.payrollSettings.create({ data: {} });
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const updatePayrollSettings = async (req, res) => {
  try {
    const { pfRate, maxPf, gratuityRate, tdsEnabled, epfEnabled, epsEnabled, adminPf } = req.body;

    const settings = await prisma.payrollSettings.updateMany({
      data: {
        ...(pfRate !== undefined && { pfRate }),
        ...(maxPf !== undefined && { maxPf }),
        ...(gratuityRate !== undefined && { gratuityRate }),
        ...(tdsEnabled !== undefined && { tdsEnabled }),
        ...(epfEnabled !== undefined && { epfEnabled }),
        ...(epsEnabled !== undefined && { epsEnabled }),
        ...(adminPf !== undefined && { adminPf }),
      },
    });

    if (pfRate !== undefined) salaryCalculator.updateSettings({ pfRate });
    if (maxPf !== undefined) salaryCalculator.updateSettings({ maxPf });

    res.json(await prisma.payrollSettings.findFirst());
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getSalaryStructure,
  setSalaryStructure,
  getPayrollPreflight,
  runPayroll,
  getPayrollReport,
  getPayrollExport,
  getAllPayrollRuns,
  calculateEmployeeSalary,
  getPayrollSettings,
  updatePayrollSettings,
};
