/**
 * @fileoverview Payroll processing controller.
 * Manages salary structures, payroll runs with preflight checks,
 * payroll reports, exports (CSV/PDF/Excel), and payroll settings.
 * Implements Maker-Checker approval workflow and rollback functionality.
 * @module controllers/payrollController
 */

const prisma = require('../config/database');
const salaryCalculator = require('../services/salaryService');
const { logPayrollEvent } = require('../services/auditService');
const { calculateArrears } = require('../services/arrearsService');
const { createWorkflowInstance } = require('../services/platformService');
const PDFDocument = require('pdfkit');
const { canAccessEmployee } = require('../services/accessControl');

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

const isValidPAN = (pan) => /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(String(pan || '').toUpperCase());
const isValidIFSC = (ifsc) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(String(ifsc || '').toUpperCase());
const isValidUAN = (uan) => /^[0-9]{12}$/.test(String(uan || '').replace(/\s/g, ''));
const isEsiEnabledForPayroll = (employee) => Boolean(employee.salaryStructure)
  && employee.salaryStructure.esiEnabled !== false
  && salaryCalculator.calculateGrossEarnings(employee.salaryStructure) <= 21000;

const { roundMoney } = require('../utils/money');
const money = (value) => roundMoney(value);

const dayMs = 24 * 60 * 60 * 1000;
const startOfDay = (dateLike) => {
  const date = new Date(dateLike);
  date.setHours(0, 0, 0, 0);
  return date;
};
const endOfDay = (dateLike) => {
  const date = new Date(dateLike);
  date.setHours(23, 59, 59, 999);
  return date;
};
const inclusiveDays = (start, end) => Math.max(0, Math.floor((startOfDay(end) - startOfDay(start)) / dayMs) + 1);
const overlapDays = (startA, endA, startB, endB) => {
  const start = startOfDay(Math.max(startOfDay(startA).getTime(), startOfDay(startB).getTime()));
  const end = startOfDay(Math.min(startOfDay(endA).getTime(), startOfDay(endB).getTime()));
  return end < start ? 0 : inclusiveDays(start, end);
};

const salaryComponents = ['basicSalary', 'hra', 'da', 'conveyance', 'medical', 'specialAllowance', 'otherAllowance', 'insurance', 'otherDeduction'];

const scaleStructureToMonthlyGross = (structure, monthlyGross) => {
  const currentGross = salaryCalculator.calculateGrossEarnings(structure);
  const factor = currentGross > 0 && monthlyGross > 0 ? monthlyGross / currentGross : 1;
  const scaled = { ...structure };
  for (const component of salaryComponents) {
    if (scaled[component] !== undefined && scaled[component] !== null) {
      scaled[component] = money(scaled[component] * factor);
    }
  }
  return scaled;
};

const getStructureForDate = (baseStructure, revisions, date) => {
  const target = startOfDay(date);
  const sorted = [...(revisions || [])].sort((a, b) => new Date(a.effectiveDate) - new Date(b.effectiveDate));
  const activeRevision = [...sorted].reverse().find((revision) => startOfDay(revision.effectiveDate) <= target);
  if (activeRevision) return scaleStructureToMonthlyGross(baseStructure, activeRevision.revisedSalary);

  const nextRevision = sorted.find((revision) => startOfDay(revision.effectiveDate) > target);
  if (nextRevision) return scaleStructureToMonthlyGross(baseStructure, nextRevision.previousSalary);

  return baseStructure;
};

const buildEarnedStructure = ({ employee, startDate, endDate, workDays, payableDays }) => {
  const eligibleStart = startOfDay(Math.max(startOfDay(startDate).getTime(), startOfDay(employee.joinDate || startDate).getTime()));
  const exitDate = employee.exitDetails?.lastWorkingDate ? endOfDay(employee.exitDetails.lastWorkingDate) : endOfDay(endDate);
  const eligibleEnd = startOfDay(Math.min(startOfDay(endDate).getTime(), startOfDay(exitDate).getTime()));
  if (eligibleEnd < eligibleStart || payableDays <= 0) return null;

  const revisions = (employee.salaryRevisions || [])
    .filter((revision) => startOfDay(revision.effectiveDate) > eligibleStart && startOfDay(revision.effectiveDate) <= eligibleEnd)
    .sort((a, b) => new Date(a.effectiveDate) - new Date(b.effectiveDate));

  const rawSegments = [];
  let cursor = eligibleStart;
  for (const revision of revisions) {
    const revisionStart = startOfDay(revision.effectiveDate);
    const segmentEnd = new Date(revisionStart);
    segmentEnd.setDate(segmentEnd.getDate() - 1);
    if (segmentEnd >= cursor) rawSegments.push({ start: cursor, end: segmentEnd });
    cursor = revisionStart;
  }
  rawSegments.push({ start: cursor, end: eligibleEnd });

  const eligibleDays = inclusiveDays(eligibleStart, eligibleEnd);
  const paidRatio = Math.min(1, payableDays / eligibleDays);
  const earnedStructure = { ...employee.salaryStructure };
  for (const component of salaryComponents) earnedStructure[component] = 0;

  for (const segment of rawSegments) {
    const segmentDays = inclusiveDays(segment.start, segment.end);
    const segmentPayableDays = segmentDays * paidRatio;
    const factor = segmentPayableDays / workDays;
    const segmentStructure = getStructureForDate(employee.salaryStructure, employee.salaryRevisions, segment.start);
    for (const component of salaryComponents) {
      earnedStructure[component] = money((earnedStructure[component] || 0) + ((segmentStructure[component] || 0) * factor));
    }
  }

  return { earnedStructure, eligibleStart, eligibleEnd, eligibleDays };
};

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
    if (!(await canAccessEmployee(req.user, employeeId))) {
      return res.status(403).json({ error: 'Access denied for payroll structure' });
    }
    const structure = await prisma.salaryStructure.findUnique({ where: { employeeId } });
    if (!structure) return res.json(null);

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { joinDate: true },
    });

    const yearsOfService = employee?.joinDate
      ? (new Date() - new Date(employee.joinDate)) / (365.25 * 24 * 60 * 60 * 1000)
      : 0;

    const monthlyGross = salaryCalculator.calculateGrossEarnings(structure);
    const pf = salaryCalculator.calculatePF(structure.basicSalary, structure.da || 0, structure.pfEnabled);
    const tds = structure.tdsEnabled
      ? salaryCalculator.calculateTDS(monthlyGross)
      : 0;
    const gratuity = salaryCalculator.calculateGratuity(structure.basicSalary, structure.da || 0, yearsOfService);

    res.json({ ...structure, calculations: { pf, tds, gratuity, yearsOfService: yearsOfService.toFixed(1) } });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const setSalaryStructure = async (req, res) => {
  try {
    const { 
      employeeId, basicSalary, hra, da, conveyance, conveyence, medical, specialAllowance, otherAllowance, 
      pfEnabled, pfRate, tdsEnabled, esiEnabled, professionalTaxEnabled, lwfEnabled, npsEnabled, npsRate,
      insurance, otherDeduction, usePercentSettings 
    } = req.body;

    if (!employeeId || basicSalary === undefined) {
      return res.status(400).json({ error: 'Employee ID and basic salary required' });
    }

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    let settings = await prisma.payrollSettings.findFirst();
    if (!settings) {
      settings = await prisma.payrollSettings.create({ data: {} });
    }

    let resolvedUsePercent = usePercentSettings;
    if (resolvedUsePercent === undefined) {
      const hasCustom = 
        (hra !== undefined && Number(hra) !== 0) ||
        (da !== undefined && Number(da) !== 0) ||
        (conveyance !== undefined && Number(conveyance) !== 0) ||
        (conveyence !== undefined && Number(conveyence) !== 0) ||
        (medical !== undefined && Number(medical) !== 0) ||
        (specialAllowance !== undefined && Number(specialAllowance) !== 0) ||
        (insurance !== undefined && Number(insurance) !== 0);
      resolvedUsePercent = !hasCustom;
    }

    const basicVal = Number(basicSalary);
    let finalHra = Number(hra || 0);
    let finalDa = Number(da || 0);
    let finalConveyance = Number(conveyance ?? conveyence ?? 0);
    let finalMedical = Number(medical || 0);
    let finalSpecial = Number(specialAllowance || 0);
    let finalInsurance = Number(insurance || 0);

    if (resolvedUsePercent) {
      finalHra = money(basicVal * (settings.hraPercent ?? 40.0) / 100);
      finalDa = money(basicVal * (settings.daPercent ?? 20.0) / 100);
      finalConveyance = money(basicVal * (settings.conveyancePercent ?? 10.0) / 100);
      finalMedical = money(basicVal * (settings.medicalPercent ?? 5.0) / 100);
      finalSpecial = money(basicVal * (settings.specialAllowancePercent ?? 15.0) / 100);
      finalInsurance = money(basicVal * (settings.insurancePercent ?? 5.0) / 100);
    }

    const structure = await prisma.salaryStructure.upsert({
      where: { employeeId },
      create: {
        employeeId,
        basicSalary: basicVal,
        hra: finalHra,
        da: finalDa,
        conveyance: finalConveyance,
        medical: finalMedical,
        specialAllowance: finalSpecial,
        otherAllowance: Number(otherAllowance || 0),
        pfEnabled: pfEnabled !== false,
        pfRate: pfRate || 0.12,
        tdsEnabled: tdsEnabled !== false,
        esiEnabled: esiEnabled !== false,
        professionalTaxEnabled: professionalTaxEnabled !== false,
        lwfEnabled: lwfEnabled !== false,
        npsEnabled: npsEnabled === true,
        npsRate: npsRate || 0.10,
        insurance: finalInsurance,
        otherDeduction: Number(otherDeduction || 0),
        usePercentSettings: resolvedUsePercent,
      },
      update: {
        basicSalary: basicVal,
        hra: finalHra,
        da: finalDa,
        conveyance: finalConveyance,
        medical: finalMedical,
        specialAllowance: finalSpecial,
        otherAllowance: otherAllowance !== undefined ? Number(otherAllowance) : undefined,
        pfEnabled: pfEnabled !== undefined ? pfEnabled : undefined,
        pfRate: pfRate !== undefined ? pfRate : undefined,
        tdsEnabled: tdsEnabled !== undefined ? tdsEnabled : undefined,
        esiEnabled: esiEnabled !== undefined ? esiEnabled : undefined,
        professionalTaxEnabled: professionalTaxEnabled !== undefined ? professionalTaxEnabled : undefined,
        lwfEnabled: lwfEnabled !== undefined ? lwfEnabled : undefined,
        npsEnabled: npsEnabled !== undefined ? npsEnabled : undefined,
        npsRate: npsRate !== undefined ? npsRate : undefined,
        insurance: finalInsurance,
        otherDeduction: otherDeduction !== undefined ? Number(otherDeduction) : undefined,
        usePercentSettings: resolvedUsePercent,
      },
    });

    res.json(structure);
  } catch (error) {
    console.error('SET SALARY STRUCTURE ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getPayrollPreflight = async (req, res) => {
  try {
    const { targetMonth, targetYear } = getPeriod(req.query.month, req.query.year);
    const { startDate, endDate } = getPeriodDates(targetMonth, targetYear);

    const existing = await prisma.payrollRun.findFirst({
      where: { month: targetMonth, year: targetYear },
    });
    const employees = await prisma.employee.findMany({
      where: {
        joinDate: { lte: endDate },
        OR: [
          { isActive: true },
          { deactivationEffectiveDate: { gte: startDate } },
          { exitDetails: { is: { lastWorkingDate: { gte: startDate } } } },
        ],
      },
      include: {
        salaryStructure: true,
        bankDetails: true,
        pfDetails: true,
        addresses: true,
        exitDetails: true,
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
    const invalidPan = employees.filter((e) => e.salaryStructure?.tdsEnabled !== false && !isValidPAN(e.panNumber));
    const invalidBank = employees.filter((e) => !e.bankDetails || !isValidIFSC(e.bankDetails.ifscCode) || !e.bankDetails.accountNumber);
    const missingUan = employees.filter((e) => e.salaryStructure?.pfEnabled !== false && !isValidUAN(e.pfDetails?.uanNumber));
    const missingEsiNumber = employees.filter((e) => isEsiEnabledForPayroll(e) && !e.pfDetails?.esiNumber);
    const missingWorkState = employees.filter((e) => {
      const currentAddress = e.addresses?.find((a) => a.type === 'CURRENT') || e.addresses?.[0];
      return !currentAddress?.state;
    });
    const employeeSummaries = await Promise.all(employees.map(async (employee) => {
      const empAttendance = attendances.filter((a) => a.employeeId === employee.id);
      const lopDays = unpaidLeaves.filter((l) => l.employeeId === employee.id).reduce((sum, leave) => sum + leave.days, 0);
      const otHours = approvedOvertime.filter((ot) => ot.employeeId === employee.id).reduce((sum, ot) => sum + ot.otHours, 0);
      const arrearsResult = await calculateArrears(employee.id, targetMonth, targetYear);
      return {
        id: employee.id,
        employeeId: employee.employeeId,
        name: `${employee.firstName} ${employee.lastName}`,
        salaryReady: Boolean(employee.salaryStructure),
        bankReady: Boolean(employee.bankDetails),
        pfReady: Boolean(employee.pfDetails),
        statutoryReady: isValidPAN(employee.panNumber)
          && (!employee.salaryStructure?.pfEnabled || isValidUAN(employee.pfDetails?.uanNumber))
          && (!isEsiEnabledForPayroll(employee) || Boolean(employee.pfDetails?.esiNumber)),
        workStateReady: Boolean((employee.addresses?.find((a) => a.type === 'CURRENT') || employee.addresses?.[0])?.state),
        attendanceEntries: empAttendance.length,
        lopDays,
        overtimeHours: otHours,
        latestRevision: employee.salaryRevisions[0] || null,
        pendingArrears: arrearsResult.netArrears
      };
    }));

    const automaticChecks = [
      { key: 'notAlreadyRun', label: 'Payroll not already processed for this period', passed: !existing || existing.status === 'REVERSED', blocking: true, detail: existing && existing.status !== 'REVERSED' ? 'Payroll already exists for this month.' : 'No active payroll run exists for this period.' },
      { key: 'salaryStructures', label: 'Salary structures configured for active employees', passed: missingSalary.length === 0, blocking: true, detail: `${missingSalary.length} employee(s) missing salary structure.` },
      { key: 'pendingOvertime', label: 'No pending overtime approvals', passed: pendingOvertime === 0, blocking: true, detail: `${pendingOvertime} pending overtime request(s).` },
      { key: 'panReady', label: 'PAN available and valid for TDS employees', passed: invalidPan.length === 0, blocking: true, detail: `${invalidPan.length} employee(s) missing valid PAN.` },
      { key: 'bankIfscReady', label: 'Bank account and IFSC ready for salary transfer', passed: invalidBank.length === 0, blocking: true, detail: `${invalidBank.length} employee(s) missing bank account or valid IFSC.` },
      { key: 'uanReady', label: 'UAN available for PF-enabled employees', passed: missingUan.length === 0, blocking: true, detail: `${missingUan.length} PF-enabled employee(s) missing valid UAN.` },
      { key: 'esiReady', label: 'ESIC IP number available for ESI-eligible employees', passed: missingEsiNumber.length === 0, blocking: true, detail: `${missingEsiNumber.length} ESI-eligible employee(s) missing ESIC IP number.` },
      { key: 'workStateReady', label: 'Work state available for PT/LWF calculation', passed: missingWorkState.length === 0, blocking: true, detail: `${missingWorkState.length} employee(s) missing current work state.` },
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
        totalPendingArrears: employeeSummaries.reduce((sum, s) => sum + s.pendingArrears, 0),
        statutoryIssues: invalidPan.length + invalidBank.length + missingUan.length + missingEsiNumber.length + missingWorkState.length
      },
      canRun: automaticChecks.every((check) => !check.blocking || check.passed),
    });
  } catch (error) {
    console.error('PAYROLL PREFLIGHT ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Initiates the payroll processing run (creates DRAFT status).
 */
const runPayroll = async (req, res) => {
  try {
    const { month, year, confirmations = {}, adjustments = {} } = req.body;
    const { targetMonth, targetYear } = getPeriod(month, year);

    // If a run exists, check status
    const existing = await prisma.payrollRun.findFirst({
      where: { month: targetMonth, year: targetYear },
    });
    if (existing && existing.status !== 'REVERSED') {
      return res.status(400).json({ error: `Payroll run already exists in status: ${existing.status}` });
    }

    const missingConfirmations = MANUAL_PAYROLL_STAGES
      .filter((stage) => stage.required && confirmations[stage.key] !== true)
      .map((stage) => stage.label);
    if (missingConfirmations.length > 0) {
      return res.status(400).json({ error: 'Complete all manual payroll checks before running payroll', missingConfirmations });
    }

    const { startDate, endDate } = getPeriodDates(targetMonth, targetYear);

    const employees = await prisma.employee.findMany({
      where: {
        joinDate: { lte: endDate },
        OR: [
          { isActive: true },
          { deactivationEffectiveDate: { gte: startDate } },
          { exitDetails: { is: { lastWorkingDate: { gte: startDate } } } },
        ],
      },
      include: {
        salaryStructure: true,
        addresses: true,
        pfDetails: true,
        exitDetails: true,
        salaryRevisions: {
          where: { effectiveDate: { lte: endDate } },
          orderBy: { effectiveDate: 'asc' },
        },
      },
    });
    const employeesWithSalary = employees.filter((employee) => employee.salaryStructure);
    if (employeesWithSalary.length === 0) {
      return res.status(400).json({ error: 'No payroll-eligible employees have salary structures configured' });
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
    const approvedExpenseClaims = await prisma.expenseClaim.findMany({
      where: {
        status: 'APPROVED_BY_FINANCE',
        payrollRecordId: null,
        claimDate: { lte: endDate },
      },
    });
    const settings = await prisma.payrollSettings.findFirst();
    if (settings) salaryCalculator.updateSettings(settings);

    // Run the entire generation within an atomic transaction block
    const transactionResult = await prisma.$transaction(async (tx) => {
      // Delete reversed run if it was there to allow overwrite or upsert
      if (existing && existing.status === 'REVERSED') {
        await tx.payrollRecord.deleteMany({ where: { payrollRunId: existing.id } });
        await tx.payrollRun.delete({ where: { id: existing.id } });
      }

      const payrollRun = await tx.payrollRun.create({
        data: {
          month: targetMonth,
          year: targetYear,
          status: 'DRAFT',
          processedBy: req.user?.email || 'admin@pid-hcms.com',
          processedAt: new Date()
        },
      });

      let totalAmount = 0;
      let totalPf = 0;
      let totalTds = 0;
      let totalGratuity = 0;
      const records = [];

      for (const employee of employeesWithSalary) {

        const structure = employee.salaryStructure;
        const empAttendance = attendances.filter((a) => a.employeeId === employee.id);
        const daysWorked = empAttendance.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length;
        const workDays = new Date(targetYear, targetMonth, 0).getDate();
        const exitDate = employee.exitDetails?.lastWorkingDate ? employee.exitDetails.lastWorkingDate : endDate;
        const eligibleStart = startOfDay(Math.max(startOfDay(startDate).getTime(), startOfDay(employee.joinDate || startDate).getTime()));
        const eligibleEnd = startOfDay(Math.min(startOfDay(endDate).getTime(), startOfDay(exitDate).getTime()));
        if (eligibleEnd < eligibleStart) continue;
        const eligibleDays = inclusiveDays(eligibleStart, eligibleEnd);

        // Fetch annual leave details to compute excess leave LOP docking (Bug 16)
        const allYearApprovedLeaves = await tx.leave.findMany({
          where: {
            employeeId: employee.id,
            status: 'APPROVED',
            startDate: { gte: new Date(targetYear, 0, 1) },
            endDate: { lte: new Date(targetYear, 11, 31, 23, 59, 59, 999) }
          },
          orderBy: { startDate: 'asc' }
        });

        const quotas = await tx.leaveQuota.findMany({
          where: { employeeId: employee.id, year: targetYear }
        });
        const quotaMap = {};
        for (const q of quotas) {
          quotaMap[q.leaveType] = q.quota;
        }

        let extraLopDays = 0;
        const leavesByType = {};
        for (const l of allYearApprovedLeaves) {
          if (l.leaveType === 'UNPAID') continue;
          if (!leavesByType[l.leaveType]) leavesByType[l.leaveType] = [];
          leavesByType[l.leaveType].push(l);
        }

        for (const [type, typeLeaves] of Object.entries(leavesByType)) {
          const quotaLimit = quotaMap[type] || 0;
          let runningSum = 0;
          for (const l of typeLeaves) {
            let curr = new Date(l.startDate);
            const end = new Date(l.endDate);
            let safety = 0;
            while (curr <= end && safety < 100) {
              safety++;
              runningSum += 1;
              if (runningSum > quotaLimit) {
                const dStr = curr.toISOString().slice(0, 10);
                const startStr = startDate.toISOString().slice(0, 10);
                const endStr = endDate.toISOString().slice(0, 10);
                if (dStr >= startStr && dStr <= endStr) {
                  extraLopDays += 1;
                }
              }
              curr.setDate(curr.getDate() + 1);
            }
          }
        }

        const unpaidLeavesRaw = leaveDeductions
          .filter((l) => l.employeeId === employee.id)
          .reduce((sum, l) => sum + overlapDays(l.startDate, l.endDate, eligibleStart, eligibleEnd), 0) + extraLopDays;
        const unpaidLeaves = Math.min(workDays, unpaidLeavesRaw); // Cap LOP days at maximum calendar days in the month
        const payableDays = Math.max(0, eligibleDays - unpaidLeaves);
        const employeeAdjustments = adjustments[employee.id] || {};
        let arrears = 0;
        if (employeeAdjustments.arrears !== undefined) {
          arrears = money(employeeAdjustments.arrears);
        } else {
          const arrearsResult = await calculateArrears(employee.id, targetMonth, targetYear);
          arrears = arrearsResult.netArrears;
        }
        const incentives = money(employeeAdjustments.incentives);
        const employeeClaims = approvedExpenseClaims.filter((claim) => claim.employeeId === employee.id);
        const reimbursements = money(
          employeeAdjustments.reimbursements !== undefined
            ? employeeAdjustments.reimbursements
            : employeeClaims.reduce((sum, claim) => sum + claim.amount, 0)
        );
        const loanDeduction = money((employeeAdjustments.loanDeduction || 0) + (employeeAdjustments.advanceRecovery || 0));
        const otHours = approvedOvertime.filter((ot) => ot.employeeId === employee.id).reduce((sum, ot) => sum + ot.otHours, 0);
        const otPay = money(salaryCalculator.calculateOTPay(
          structure.basicSalary,
          structure.da || 0,
          (structure.hra || 0) + (structure.conveyance || 0) + (structure.medical || 0) + (structure.specialAllowance || 0) + (structure.otherAllowance || 0),
          otHours,
          settings
        ));

        const currentAddress = employee.addresses?.find(a => a.type === 'CURRENT') || employee.addresses?.[0];
        const stateName = currentAddress ? currentAddress.state : 'DEFAULT';
        const earnedResult = buildEarnedStructure({ employee, startDate, endDate, workDays, payableDays });
        if (!earnedResult) continue;
        const earnedStructure = earnedResult.earnedStructure;
        const permanentGross = salaryCalculator.calculateGrossEarnings(structure);
        const esiCycleEligible = permanentGross <= 21000;

        const calcOptions = {
          employeeId: employee.id,
          tdsEnabled: structure.tdsEnabled,
          employeePf: structure.pfEnabled,
          state: stateName,
          gender: employee.gender || 'Male',
          month: targetMonth,
          year: targetYear,
          esiCycleEligible,
          vpfPercentage: employee.pfDetails?.vpfPercentage || 0,
          taxOptions: { regime: 'NEW' }
        };

        const calc = await salaryCalculator.calculateNetSalary(earnedStructure, calcOptions);
        
        calc.grossEarnings = money(calc.grossEarnings + arrears + incentives + otPay + reimbursements);
        calc.totalDeductions = money(calc.totalDeductions + loanDeduction);
        calc.netSalary = money(calc.netSalary + arrears + incentives + otPay + reimbursements - loanDeduction);
        calc.breakdowns.earnings.otherAllowance = money(calc.breakdowns.earnings.otherAllowance + arrears + incentives + otPay + reimbursements);
        calc.breakdowns.deductions.otherDeductions = money((calc.breakdowns.deductions.otherDeductions || 0) + loanDeduction);

        const record = await tx.payrollRecord.create({
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
            vpfAmount: calc.breakdowns.deductions.vpfAmount || 0.0,
            lwfEmployee: calc.breakdowns.deductions.employeeLwf || 0.0,
            lwfEmployer: calc.breakdowns.deductions.employerLwf || 0.0,
            npsEmployee: calc.breakdowns.deductions.employeeNps || 0.0,
            npsEmployer: calc.breakdowns.deductions.employerNps || 0.0,
            tax: calc.breakdowns.deductions.tds,
            esi: calc.breakdowns.deductions.employeeEsi || 0,
            professionalTax: calc.breakdowns.deductions.professionalTax || 0,
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
            complianceNotes: [
              employeeAdjustments.notes || '',
              `Eligible days: ${payableDays}/${eligibleDays}; period ${earnedResult.eligibleStart.toISOString().slice(0, 10)} to ${earnedResult.eligibleEnd.toISOString().slice(0, 10)}`,
              reimbursements ? `Reimbursements included: ${reimbursements}` : '',
              loanDeduction ? `Loan/advance recovery deducted: ${loanDeduction}` : '',
            ].filter(Boolean).join(' | '),
            status: 'PROCESSED'
          },
        });

        if (employeeClaims.length > 0) {
          await tx.expenseClaim.updateMany({
            where: { id: { in: employeeClaims.map((claim) => claim.id) } },
            data: { payrollRecordId: record.id, status: 'PAID' },
          });
        }

        totalAmount += calc.netSalary;
        totalPf += calc.breakdowns.deductions.employerPf;
        totalTds += calc.breakdowns.deductions.tds;
        if (employee.joinDate) {
          const years = (new Date() - new Date(employee.joinDate)) / (365.25 * 24 * 60 * 60 * 1000);
          totalGratuity += salaryCalculator.calculateGratuity(structure.basicSalary, structure.da || 0, years);
        }
        records.push(record);
      }

      const updated = await tx.payrollRun.update({
        where: { id: payrollRun.id },
        data: {
          totalAmount,
          employeeCount: records.length,
          totalPf,
          totalTds,
          totalGratuity,
        },
      });

      // Maker-checker approval logs
      await tx.payrollApproval.create({
        data: {
          payrollRunId: payrollRun.id,
          action: 'DRAFT',
          actorId: req.user?.id || 'admin-id',
          actorEmail: req.user?.email || 'admin@pid-hcms.com',
          comments: 'Payroll run generated as DRAFT.'
        }
      });

      return { updated, records, totalPf, totalTds, totalGratuity };
    });

    await logPayrollEvent({
      userEmail: req.user?.email || 'admin@pid-hcms.com',
      action: 'PAYROLL_DRAFT_CREATED',
      entity: 'PayrollRun',
      entityId: transactionResult.updated.id,
      newDetails: transactionResult.updated,
      ipAddress: req.ip
    });

    const existingWorkflow = await prisma.workflowInstance.findFirst({
      where: { module: 'PAYROLL', entityType: 'PayrollRun', entityId: transactionResult.updated.id },
    });
    if (!existingWorkflow) {
      await createWorkflowInstance({
        module: 'PAYROLL',
        entityType: 'PayrollRun',
        entityId: transactionResult.updated.id,
        title: `Payroll close ${String(targetMonth).padStart(2, '0')}/${targetYear}`,
        requester: req.user,
        triggerEvent: 'PAYROLL_RUN_CREATED',
        context: {
          month: targetMonth,
          year: targetYear,
          employeeCount: transactionResult.records.length,
          totalNetPay: transactionResult.updated.totalAmount,
          totalPf: transactionResult.totalPf,
          totalTds: transactionResult.totalTds,
        },
      });
    }

    res.json({
      payrollRun: transactionResult.updated,
      records: transactionResult.records,
      summary: {
        totalPf: transactionResult.totalPf,
        totalTds: transactionResult.totalTds,
        totalGratuity: transactionResult.totalGratuity
      }
    });
  } catch (error) {
    console.error('RUN PAYROLL ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Maker-Checker: Review Draft payroll (Status transitions to REVIEWED)
 */
const reviewPayroll = async (req, res) => {
  try {
    const { runId } = req.params;
    const { comments } = req.body;

    const payrollRun = await prisma.payrollRun.findUnique({ where: { id: runId } });
    if (!payrollRun) return res.status(404).json({ error: 'Payroll run not found' });
    if (payrollRun.status !== 'DRAFT') {
      return res.status(400).json({ error: `Only DRAFT payroll runs can be reviewed. Current: ${payrollRun.status}` });
    }

    const updated = await prisma.payrollRun.update({
      where: { id: runId },
      data: {
        status: 'REVIEWED',
        reviewedBy: req.user?.email || 'reviewer@pid-hcms.com',
        reviewedAt: new Date()
      }
    });

    await prisma.payrollApproval.create({
      data: {
        payrollRunId: runId,
        action: 'REVIEWED',
        actorId: req.user?.id || 'reviewer-id',
        actorEmail: req.user?.email || 'reviewer@pid-hcms.com',
        comments: comments || 'Payroll run reviewed.'
      }
    });

    await logPayrollEvent({
      userEmail: req.user?.email || 'reviewer@pid-hcms.com',
      action: 'PAYROLL_REVIEWED',
      entity: 'PayrollRun',
      entityId: runId,
      newDetails: updated,
      ipAddress: req.ip
    });

    res.json(updated);
  } catch (error) {
    console.error('REVIEW PAYROLL ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Maker-Checker: Approve payroll (Status transitions to APPROVED)
 */
const approvePayroll = async (req, res) => {
  try {
    const { runId } = req.params;
    const { comments } = req.body;

    const payrollRun = await prisma.payrollRun.findUnique({ where: { id: runId } });
    if (!payrollRun) return res.status(404).json({ error: 'Payroll run not found' });
    if (payrollRun.status !== 'REVIEWED') {
      return res.status(400).json({ error: `Only REVIEWED payroll runs can be approved. Current: ${payrollRun.status}` });
    }

    const updated = await prisma.payrollRun.update({
      where: { id: runId },
      data: {
        status: 'APPROVED',
        approvedBy: req.user?.email || 'approver@pid-hcms.com',
        approvedAt: new Date()
      }
    });

    await prisma.payrollApproval.create({
      data: {
        payrollRunId: runId,
        action: 'APPROVED',
        actorId: req.user?.id || 'approver-id',
        actorEmail: req.user?.email || 'approver@pid-hcms.com',
        comments: comments || 'Payroll run approved.'
      }
    });

    await logPayrollEvent({
      userEmail: req.user?.email || 'approver@pid-hcms.com',
      action: 'PAYROLL_APPROVED',
      entity: 'PayrollRun',
      entityId: runId,
      newDetails: updated,
      ipAddress: req.ip
    });

    res.json(updated);
  } catch (error) {
    console.error('APPROVE PAYROLL ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Maker-Checker: Process/Finalize payroll (Status transitions to PROCESSED, writes to TDS ledger)
 */
const processPayroll = async (req, res) => {
  try {
    const { runId } = req.params;
    const { comments } = req.body;

    const payrollRun = await prisma.payrollRun.findUnique({
      where: { id: runId },
      include: { records: true }
    });
    if (!payrollRun) return res.status(404).json({ error: 'Payroll run not found' });
    if (payrollRun.status !== 'APPROVED') {
      return res.status(400).json({ error: `Only APPROVED payroll runs can be processed/finalized. Current: ${payrollRun.status}` });
    }

    // Write final tax deductions into the TDS ledger
    const ledgerPromises = payrollRun.records.map((record) => {
      return prisma.tDSLedger.upsert({
        where: {
          employeeId_month_year: {
            employeeId: record.employeeId,
            month: payrollRun.month,
            year: payrollRun.year
          }
        },
        create: {
          employeeId: record.employeeId,
          payrollRecordId: record.id,
          month: payrollRun.month,
          year: payrollRun.year,
          taxableIncome: record.grossEarnings - record.pf - (record.vpfAmount || 0), // rough estimate of monthly taxable income
          tdsDeducted: record.tax
        },
        update: {
          payrollRecordId: record.id,
          taxableIncome: record.grossEarnings - record.pf - (record.vpfAmount || 0),
          tdsDeducted: record.tax
        }
      });
    });

    await Promise.all(ledgerPromises);

    const updated = await prisma.payrollRun.update({
      where: { id: runId },
      data: {
        status: 'PROCESSED',
        processedBy: req.user?.email || 'admin@pid-hcms.com',
        processedAt: new Date()
      }
    });

    await prisma.payrollApproval.create({
      data: {
        payrollRunId: runId,
        action: 'PROCESSED',
        actorId: req.user?.id || 'admin-id',
        actorEmail: req.user?.email || 'admin@pid-hcms.com',
        comments: comments || 'Payroll run finalized and processed.'
      }
    });

    await logPayrollEvent({
      userEmail: req.user?.email || 'admin@pid-hcms.com',
      action: 'PAYROLL_PROCESSED',
      entity: 'PayrollRun',
      entityId: runId,
      newDetails: updated,
      ipAddress: req.ip
    });

    res.json(updated);
  } catch (error) {
    console.error('PROCESS PAYROLL ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Maker-Checker: Reject Draft/Reviewed payroll back to DRAFT or REJECTED.
 */
const rejectPayroll = async (req, res) => {
  try {
    const { runId } = req.params;
    const { comments } = req.body;

    const payrollRun = await prisma.payrollRun.findUnique({ where: { id: runId } });
    if (!payrollRun) return res.status(404).json({ error: 'Payroll run not found' });
    
    if (payrollRun.status === 'PROCESSED' || payrollRun.status === 'LOCKED') {
      return res.status(400).json({ error: 'Processed or Locked payroll runs cannot be rejected. Use Reversal instead.' });
    }

    const updated = await prisma.payrollRun.update({
      where: { id: runId },
      data: { status: 'DRAFT' }
    });

    await prisma.payrollApproval.create({
      data: {
        payrollRunId: runId,
        action: 'REJECTED',
        actorId: req.user?.id || 'reviewer-id',
        actorEmail: req.user?.email || 'reviewer@pid-hcms.com',
        comments: comments || 'Payroll run rejected/returned to DRAFT.'
      }
    });

    await logPayrollEvent({
      userEmail: req.user?.email || 'reviewer@pid-hcms.com',
      action: 'PAYROLL_REJECTED',
      entity: 'PayrollRun',
      entityId: runId,
      newDetails: { comments },
      ipAddress: req.ip
    });

    res.json(updated);
  } catch (error) {
    console.error('REJECT PAYROLL ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Payroll Rollback Engine (Reversal of PROCESSED/LOCKED runs)
 * Immutable reversal records: stores authorizer, date, and justification.
 */
const reversePayroll = async (req, res) => {
  try {
    const { runId } = req.params;
    const { justification } = req.body;

    if (!justification || justification.trim().length < 10) {
      return res.status(400).json({ error: 'Reversal requires a detailed justification (minimum 10 characters).' });
    }

    const payrollRun = await prisma.payrollRun.findUnique({ where: { id: runId } });
    if (!payrollRun) return res.status(404).json({ error: 'Payroll run not found' });

    if (payrollRun.status !== 'PROCESSED' && payrollRun.status !== 'LOCKED') {
      return res.status(400).json({ error: `Only processed or locked payroll runs can be reversed. Current: ${payrollRun.status}` });
    }

    // Delete TDS Ledger records associated with this run's records
    const records = await prisma.payrollRecord.findMany({ where: { payrollRunId: runId } });
    const recordIds = records.map(r => r.id);

    // Wrap deletes and updates in transaction
    const updated = await prisma.$transaction(async (tx) => {
      // 1. Delete matching TDS ledgers
      await tx.tDSLedger.deleteMany({
        where: {
          payrollRecordId: { in: recordIds }
        }
      });

      // 2. Mark payroll run as REVERSED and update fields
      return await tx.payrollRun.update({
        where: { id: runId },
        data: {
          status: 'REVERSED',
          reversedBy: req.user?.email || 'admin@pid-hcms.com',
          reversalReason: justification,
          reversedAt: new Date()
        }
      });
    });

    await prisma.payrollApproval.create({
      data: {
        payrollRunId: runId,
        action: 'REVERSED',
        actorId: req.user?.id || 'admin-id',
        actorEmail: req.user?.email || 'admin@pid-hcms.com',
        comments: `Payroll run reversed. Reason: ${justification}`
      }
    });

    await logPayrollEvent({
      userEmail: req.user?.email || 'admin@pid-hcms.com',
      action: 'PAYROLL_REVERSED',
      entity: 'PayrollRun',
      entityId: runId,
      oldDetails: payrollRun,
      newDetails: { justification, reversedAt: new Date() },
      ipAddress: req.ip
    });

    res.json({
      message: 'Payroll run and associated tax records have been successfully reversed.',
      payrollRun: updated
    });
  } catch (error) {
    console.error('REVERSE PAYROLL ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getPayrollReport = async (req, res) => {
  try {
    const { month, year } = req.query;
    const targetMonth = parseInt(month) || new Date().getMonth() + 1;
    const targetYear = parseInt(year) || new Date().getFullYear();

    const payrollRun = await prisma.payrollRun.findFirst({
      where: { month: targetMonth, year: targetYear },
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
  employeeEsi: record.esi || 0,
  professionalTax: record.professionalTax || 0,
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
    const payrollRun = await prisma.payrollRun.findFirst({
      where: { month: targetMonth, year: targetYear },
    });
    if (!payrollRun) return res.status(404).json({ error: 'Payroll not run for this period' });

    const records = await prisma.payrollRecord.findMany({
      where: { payrollRunId: payrollRun.id },
      include: { employee: { include: { department: true } } },
    });
    const rows = buildPayrollExportRows(records);
    const headers = Object.keys(rows[0] || {
      employeeId: '', employeeName: '', department: '', workDays: '', payableDays: '', lopDays: '', basicSalary: '', hra: '', da: '', conveyance: '', medical: '', specialAllowance: '', otherAllowance: '', arrears: '', incentives: '', overtimeHours: '', overtimePay: '', grossEarnings: '', employeePf: '', employeeEsi: '', professionalTax: '', incomeTax: '', insurance: '', otherDeductions: '', lopDeduction: '', totalDeductions: '', netSalary: '', incomeTaxDeclaration: '', investmentProofs: '', notes: '',
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
        doc.fontSize(9).text(`${row.employeeId}  ${row.employeeName}  Net: ${row.netSalary}  Gross: ${row.grossEarnings}  PF: ${row.employeePf}  ESI: ${row.employeeEsi}  PT: ${row.professionalTax}  Tax: ${row.incomeTax}  LOP: ${row.lopDays}  OT: ${row.overtimePay}`);
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
    if (!(await canAccessEmployee(req.user, employeeId))) {
      return res.status(403).json({ error: 'Access denied for salary calculation' });
    }
    const { month, year } = req.query;

    const structure = await prisma.salaryStructure.findUnique({ where: { employeeId } });
    if (!structure) return res.status(404).json({ error: 'Salary structure not found' });

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { addresses: true, pfDetails: true },
    });

    const targetMonth = parseInt(month) || new Date().getMonth() + 1;
    const targetYear = parseInt(year) || new Date().getFullYear();
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0);

    const attendances = await prisma.attendance.findMany({
      where: { employeeId, date: { gte: startDate, lte: endDate } },
    });

    const daysWorked = attendances.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length;
    const workDays = new Date(targetYear, targetMonth, 0).getDate();

    const currentAddress = employee?.addresses?.find(a => a.type === 'CURRENT') || employee?.addresses?.[0];
    const stateName = currentAddress ? currentAddress.state : 'DEFAULT';
    const permanentGross = salaryCalculator.calculateGrossEarnings(structure);
    const esiCycleEligible = permanentGross <= 21000;

    const calcOptions = {
      employeeId,
      tdsEnabled: structure.tdsEnabled,
      employeePf: structure.pfEnabled,
      state: stateName,
      gender: employee?.gender || 'Male',
      month: targetMonth,
      year: targetYear,
      esiCycleEligible,
      vpfPercentage: employee?.pfDetails?.vpfPercentage || 0,
      taxOptions: { regime: 'NEW' }
    };

    const calc = daysWorked < workDays
      ? await salaryCalculator.calculateProportionalSalary(structure, daysWorked, workDays, calcOptions)
      : await salaryCalculator.calculateNetSalary(structure, calcOptions);

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
    const { 
      pfRate, maxPf, gratuityRate, tdsEnabled, epfEnabled, epsEnabled, adminPf,
      hraPercent, daPercent, conveyancePercent, medicalPercent, specialAllowancePercent, insurancePercent
    } = req.body;

    const data = {
      ...(pfRate !== undefined && { pfRate: Number(pfRate) }),
      ...(maxPf !== undefined && { maxPf: Number(maxPf) }),
      ...(gratuityRate !== undefined && { gratuityRate: Number(gratuityRate) }),
      ...(tdsEnabled !== undefined && { tdsEnabled: Boolean(tdsEnabled) }),
      ...(epfEnabled !== undefined && { epfEnabled: Boolean(epfEnabled) }),
      ...(epsEnabled !== undefined && { epsEnabled: Boolean(epsEnabled) }),
      ...(adminPf !== undefined && { adminPf: Boolean(adminPf) }),
      ...(hraPercent !== undefined && { hraPercent: Number(hraPercent) }),
      ...(daPercent !== undefined && { daPercent: Number(daPercent) }),
      ...(conveyancePercent !== undefined && { conveyancePercent: Number(conveyancePercent) }),
      ...(medicalPercent !== undefined && { medicalPercent: Number(medicalPercent) }),
      ...(specialAllowancePercent !== undefined && { specialAllowancePercent: Number(specialAllowancePercent) }),
      ...(insurancePercent !== undefined && { insurancePercent: Number(insurancePercent) }),
    };

    await prisma.payrollSettings.updateMany({ data });

    const settings = await prisma.payrollSettings.findFirst();

    // Trigger recalculation if any percentage changes
    if (
      hraPercent !== undefined ||
      daPercent !== undefined ||
      conveyancePercent !== undefined ||
      medicalPercent !== undefined ||
      specialAllowancePercent !== undefined ||
      insurancePercent !== undefined
    ) {
      const structures = await prisma.salaryStructure.findMany({
        where: { usePercentSettings: true },
      });

      for (const struct of structures) {
        await prisma.salaryStructure.update({
          where: { id: struct.id },
          data: {
            hra: money(struct.basicSalary * (settings.hraPercent ?? 40.0) / 100),
            da: money(struct.basicSalary * (settings.daPercent ?? 20.0) / 100),
            conveyance: money(struct.basicSalary * (settings.conveyancePercent ?? 10.0) / 100),
            medical: money(struct.basicSalary * (settings.medicalPercent ?? 5.0) / 100),
            specialAllowance: money(struct.basicSalary * (settings.specialAllowancePercent ?? 15.0) / 100),
            insurance: money(struct.basicSalary * (settings.insurancePercent ?? 5.0) / 100),
          },
        });
      }
    }

    if (pfRate !== undefined) salaryCalculator.updateSettings({ pfRate });
    if (maxPf !== undefined) salaryCalculator.updateSettings({ maxPf });

    res.json(settings);
  } catch (error) {
    console.error('UPDATE PAYROLL SETTINGS ERROR:', error);
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
  reviewPayroll,
  approvePayroll,
  processPayroll,
  rejectPayroll,
  reversePayroll
};
