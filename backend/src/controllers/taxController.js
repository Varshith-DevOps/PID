/**
 * @fileoverview Tax and TDS management controller.
 * Handles investment declarations, previous employer income, and tax projection reports.
 */

const prisma = require('../config/database');
const { projectTDS, getFinancialYear } = require('../services/tdsEngine');
const { logPayrollEvent } = require('../services/auditService');

/**
 * Submit or update Form 12B previous employer income.
 * POST /api/tax/previous-employer
 */
const savePreviousEmployerIncome = async (req, res) => {
  try {
    const { employeeId, financialYear, previousEmployerGross, previousEmployerTDS, previousEmployerPF, previousEmployerPT } = req.body;

    if (!employeeId || !financialYear) {
      return res.status(400).json({ error: 'Employee ID and financial year are required' });
    }

    // Validate FY format
    if (!/^\d{4}-\d{2}$/.test(financialYear)) {
      return res.status(400).json({ error: 'Financial year must be in YYYY-YY format (e.g. 2025-26)' });
    }

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const prevIncome = await prisma.previousEmployerIncome.upsert({
      where: {
        employeeId_financialYear: { employeeId, financialYear }
      },
      create: {
        employeeId,
        financialYear,
        previousEmployerGross: Number(previousEmployerGross) || 0.0,
        previousEmployerTDS: Number(previousEmployerTDS) || 0.0,
        previousEmployerPF: Number(previousEmployerPF) || 0.0,
        previousEmployerPT: Number(previousEmployerPT) || 0.0,
      },
      update: {
        previousEmployerGross: Number(previousEmployerGross) || 0.0,
        previousEmployerTDS: Number(previousEmployerTDS) || 0.0,
        previousEmployerPF: Number(previousEmployerPF) || 0.0,
        previousEmployerPT: Number(previousEmployerPT) || 0.0,
      }
    });

    // Log audit event
    await logPayrollEvent({
      userEmail: req.user?.email || 'admin@pid-hcms.com',
      action: 'PREV_EMPLOYER_INCOME_UPDATE',
      entity: 'PreviousEmployerIncome',
      entityId: prevIncome.id,
      newDetails: prevIncome,
      ipAddress: req.ip
    });

    res.json(prevIncome);
  } catch (error) {
    console.error('PREVIOUS EMPLOYER INCOME ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Submit or update Employee Tax Declaration (80C, 80D, etc.) and Regime selection.
 * POST /api/tax/declaration
 */
const saveTaxDeclaration = async (req, res) => {
  try {
    const { employeeId, financialYear, regime, section80C, section80D, section24b, otherDeductions, isFinalized } = req.body;

    if (!employeeId || !financialYear) {
      return res.status(400).json({ error: 'Employee ID and financial year are required' });
    }

    if (regime && !['NEW', 'OLD'].includes(regime)) {
      return res.status(400).json({ error: 'Regime must be NEW or OLD' });
    }

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const declaration = await prisma.employeeTaxDeclaration.upsert({
      where: {
        employeeId_financialYear: { employeeId, financialYear }
      },
      create: {
        employeeId,
        financialYear,
        regime: regime || 'NEW',
        section80C: Number(section80C) || 0.0,
        section80D: Number(section80D) || 0.0,
        section24b: Number(section24b) || 0.0,
        otherDeductions: Number(otherDeductions) || 0.0,
        isFinalized: Boolean(isFinalized)
      },
      update: {
        regime: regime || 'NEW',
        section80C: Number(section80C) || 0.0,
        section80D: Number(section80D) || 0.0,
        section24b: Number(section24b) || 0.0,
        otherDeductions: Number(otherDeductions) || 0.0,
        isFinalized: Boolean(isFinalized)
      }
    });

    await logPayrollEvent({
      userEmail: req.user?.email || 'admin@pid-hcms.com',
      action: 'TAX_DECLARATION_UPDATE',
      entity: 'EmployeeTaxDeclaration',
      entityId: declaration.id,
      newDetails: declaration,
      ipAddress: req.ip
    });

    res.json(declaration);
  } catch (error) {
    console.error('TAX DECLARATION ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Get YTD tax summary for an employee.
 * GET /api/tax/ytd-summary/:employeeId
 */
const getYtdSummary = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { year, month } = req.query;

    const targetMonth = parseInt(month) || new Date().getMonth() + 1;
    const targetYear = parseInt(year) || new Date().getFullYear();
    const financialYear = getFinancialYear(targetMonth, targetYear);

    // Fetch previous employer income
    const prevEmployer = await prisma.previousEmployerIncome.findUnique({
      where: { employeeId_financialYear: { employeeId, financialYear } }
    });

    // Fetch tax declarations
    const declaration = await prisma.employeeTaxDeclaration.findUnique({
      where: { employeeId_financialYear: { employeeId, financialYear } }
    });

    // Fetch payroll records for current FY
    const ytdRecords = await prisma.payrollRecord.findMany({
      where: {
        employeeId,
        payrollRun: { status: { in: ['PROCESSED', 'LOCKED'] } }
      },
      include: { payrollRun: true }
    });

    const currentFYRecords = ytdRecords.filter(r => 
      getFinancialYear(r.payrollRun.month, r.payrollRun.year) === financialYear
    );

    const summary = {
      financialYear,
      regime: declaration?.regime || 'NEW',
      ytdGross: currentFYRecords.reduce((sum, r) => sum + r.grossEarnings, 0.0),
      ytdTDS: currentFYRecords.reduce((sum, r) => sum + r.tax, 0.0),
      ytdPF: currentFYRecords.reduce((sum, r) => sum + r.pf, 0.0),
      previousEmployer: prevEmployer || {
        previousEmployerGross: 0,
        previousEmployerTDS: 0,
        previousEmployerPF: 0,
        previousEmployerPT: 0
      },
      declaration: declaration || {
        section80C: 0,
        section80D: 0,
        section24b: 0,
        otherDeductions: 0
      }
    };

    res.json(summary);
  } catch (error) {
    console.error('YTD SUMMARY ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Get annual tax projection.
 * GET /api/tax/projection/:employeeId
 */
const getTaxProjection = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { month, year } = req.query;

    const targetMonth = parseInt(month) || new Date().getMonth() + 1;
    const targetYear = parseInt(year) || new Date().getFullYear();

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { salaryStructure: true }
    });

    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    if (!employee.salaryStructure) return res.status(400).json({ error: 'Employee salary structure not configured' });

    const structure = employee.salaryStructure;
    const basic = structure.basicSalary;
    const da = structure.da || 0;
    const monthlyGross = basic + structure.hra + da + structure.conveyance + structure.medical + structure.specialAllowance + structure.otherAllowance;

    const projection = await projectTDS(
      employeeId,
      targetMonth,
      targetYear,
      monthlyGross,
      basic,
      da
    );

    res.json(projection);
  } catch (error) {
    console.error('TAX PROJECTION ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  savePreviousEmployerIncome,
  saveTaxDeclaration,
  getYtdSummary,
  getTaxProjection
};
