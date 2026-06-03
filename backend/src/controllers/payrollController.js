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
        totalPendingArrears: employeeSummaries.reduce((sum, s) => sum + s.pendingArrears, 0)
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
    const existing = await prisma.payrollRun.findUnique({
      where: { month_year: { month: targetMonth, year: targetYear } },
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
      where: { isActive: true },
      include: { salaryStructure: true, addresses: true, pfDetails: true },
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

    // Delete reversed run if it was there to allow overwrite or upsert
    if (existing && existing.status === 'REVERSED') {
      await prisma.payrollRecord.deleteMany({ where: { payrollRunId: existing.id } });
      await prisma.payrollRun.delete({ where: { id: existing.id } });
    }

    const payrollRun = await prisma.payrollRun.create({
      data: {
        month: targetMonth,
        year: targetYear,
        status: 'DRAFT',
        processedBy: req.user?.email || 'admin@nexushr.com',
        processedAt: new Date()
      },
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
      const payableDays = Math.max(0, workDays - unpaidLeaves);
      const employeeAdjustments = adjustments[employee.id] || {};
      let arrears = 0;
      if (employeeAdjustments.arrears !== undefined) {
        arrears = money(employeeAdjustments.arrears);
      } else {
        const arrearsResult = await calculateArrears(employee.id, targetMonth, targetYear);
        arrears = arrearsResult.netArrears;
      }
      const incentives = money(employeeAdjustments.incentives);
      const otHours = approvedOvertime.filter((ot) => ot.employeeId === employee.id).reduce((sum, ot) => sum + ot.otHours, 0);
      const otPay = money(salaryCalculator.calculateOTPay(structure.basicSalary, otHours));

      const currentAddress = employee.addresses?.find(a => a.type === 'CURRENT') || employee.addresses?.[0];
      const stateName = currentAddress ? currentAddress.state : 'DEFAULT';
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

      const calc = payableDays < workDays
        ? await salaryCalculator.calculateProportionalSalary(structure, payableDays, workDays, calcOptions)
        : await salaryCalculator.calculateNetSalary(structure, calcOptions);
      
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
          complianceNotes: employeeAdjustments.notes || '',
          status: 'PROCESSED'
        },
      });

      totalAmount += calc.netSalary;
      totalPf += calc.breakdowns.deductions.employerPf;
      totalTds += calc.breakdowns.deductions.tds;
      if (employee.joinDate) {
        const years = (new Date() - new Date(employee.joinDate)) / (365.25 * 24 * 60 * 60 * 1000);
        totalGratuity += salaryCalculator.calculateGratuity(structure.basicSalary, structure.da || 0, years);
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

    // Maker-checker approval logs
    await prisma.payrollApproval.create({
      data: {
        payrollRunId: payrollRun.id,
        action: 'DRAFT',
        actorId: req.user?.id || 'admin-id',
        actorEmail: req.user?.email || 'admin@nexushr.com',
        comments: 'Payroll run generated as DRAFT.'
      }
    });

    await logPayrollEvent({
      userEmail: req.user?.email || 'admin@nexushr.com',
      action: 'PAYROLL_DRAFT_CREATED',
      entity: 'PayrollRun',
      entityId: payrollRun.id,
      newDetails: updated,
      ipAddress: req.ip
    });

    res.json({ payrollRun: updated, records, summary: { totalPf, totalTds, totalGratuity } });
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
        reviewedBy: req.user?.email || 'reviewer@nexushr.com',
        reviewedAt: new Date()
      }
    });

    await prisma.payrollApproval.create({
      data: {
        payrollRunId: runId,
        action: 'REVIEWED',
        actorId: req.user?.id || 'reviewer-id',
        actorEmail: req.user?.email || 'reviewer@nexushr.com',
        comments: comments || 'Payroll run reviewed.'
      }
    });

    await logPayrollEvent({
      userEmail: req.user?.email || 'reviewer@nexushr.com',
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
        approvedBy: req.user?.email || 'approver@nexushr.com',
        approvedAt: new Date()
      }
    });

    await prisma.payrollApproval.create({
      data: {
        payrollRunId: runId,
        action: 'APPROVED',
        actorId: req.user?.id || 'approver-id',
        actorEmail: req.user?.email || 'approver@nexushr.com',
        comments: comments || 'Payroll run approved.'
      }
    });

    await logPayrollEvent({
      userEmail: req.user?.email || 'approver@nexushr.com',
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
        processedBy: req.user?.email || 'admin@nexushr.com',
        processedAt: new Date()
      }
    });

    await prisma.payrollApproval.create({
      data: {
        payrollRunId: runId,
        action: 'PROCESSED',
        actorId: req.user?.id || 'admin-id',
        actorEmail: req.user?.email || 'admin@nexushr.com',
        comments: comments || 'Payroll run finalized and processed.'
      }
    });

    await logPayrollEvent({
      userEmail: req.user?.email || 'admin@nexushr.com',
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
        actorEmail: req.user?.email || 'reviewer@nexushr.com',
        comments: comments || 'Payroll run rejected/returned to DRAFT.'
      }
    });

    await logPayrollEvent({
      userEmail: req.user?.email || 'reviewer@nexushr.com',
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
          reversedBy: req.user?.email || 'admin@nexushr.com',
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
        actorEmail: req.user?.email || 'admin@nexushr.com',
        comments: `Payroll run reversed. Reason: ${justification}`
      }
    });

    await logPayrollEvent({
      userEmail: req.user?.email || 'admin@nexushr.com',
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
