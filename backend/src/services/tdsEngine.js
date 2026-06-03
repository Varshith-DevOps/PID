/**
 * @fileoverview Indian TDS Projection and Calculation Engine.
 * Implements Income Tax Act calculations for FY 2025-26.
 */

const prisma = require('../config/database');
const STATUTORY_CONSTANTS = require('./statutoryConstants');

/**
 * Get current financial year name for a given month/year.
 * Format: "YYYY-YY" (e.g. "2025-26")
 * @param {number} month - 1-indexed (1-12)
 * @param {number} year 
 * @returns {string}
 */
const getFinancialYear = (month, year) => {
  if (month >= 4) {
    const nextYearShort = String(year + 1).slice(-2);
    return `${year}-${nextYearShort}`;
  } else {
    const prevYear = year - 1;
    const currentYearShort = String(year).slice(-2);
    return `${prevYear}-${currentYearShort}`;
  }
};

/**
 * Determine remaining months in financial year after the given month.
 * April is month 4. March is month 3.
 * @param {number} month - 1-indexed (1-12)
 * @returns {number}
 */
const getRemainingMonthsInFY = (month) => {
  let fyIndex;
  if (month >= 4) {
    fyIndex = month - 4;
  } else {
    fyIndex = month + 8;
  }
  return 11 - fyIndex; // Max index is 11 (March)
};

/**
 * Helper to compute tax based on slab array.
 * @param {number} taxableIncome 
 * @param {Array<Object>} slabs 
 * @returns {number}
 */
const calculateSlabTax = (taxableIncome, slabs) => {
  let tax = 0;
  for (const slab of slabs) {
    if (taxableIncome > slab.min) {
      const taxableAmountInSlab = Math.min(taxableIncome - slab.min, slab.max - slab.min);
      tax += taxableAmountInSlab * slab.rate;
    }
  }
  return tax;
};

/**
 * Compute Surcharge and apply Marginal Relief.
 * @param {number} taxableIncome 
 * @param {number} baseTax 
 * @param {string} regime - "NEW" or "OLD"
 * @returns {number} Total tax with surcharge (before cess)
 */
const calculateSurchargeWithMarginalRelief = (taxableIncome, baseTax, regime) => {
  const rates = STATUTORY_CONSTANTS.TDS.SURCHARGE;
  let applicableRate = 0;
  let threshold = 0;

  // Find the highest applicable surcharge threshold
  for (let i = rates.length - 1; i >= 0; i--) {
    // New regime caps surcharge at 25%, so if regime is NEW and threshold is 5Cr, skip or cap rate at 25%
    if (taxableIncome > rates[i].threshold) {
      threshold = rates[i].threshold;
      applicableRate = rates[i].rate;
      if (regime === 'NEW' && applicableRate > 0.25) {
        applicableRate = 0.25;
      }
      break;
    }
  }

  if (applicableRate === 0) {
    return baseTax;
  }

  const taxWithSurcharge = baseTax * (1 + applicableRate);

  // Compute Marginal Relief:
  // Tax with Surcharge cannot exceed: (Base Tax at Threshold * (1 + Surcharge Rate at Threshold)) + (Income - Threshold)
  // Let's compute Base Tax at the exact threshold.
  const slabs = regime === 'NEW' ? STATUTORY_CONSTANTS.TDS.SLABS_NEW : STATUTORY_CONSTANTS.TDS.SLABS_OLD;
  const baseTaxAtThreshold = calculateSlabTax(threshold, slabs);
  
  // Find surcharge rate at the threshold itself (if any, e.g. at 50L it is 0%, at 1Cr it is 10%, etc.)
  let thresholdSurchargeRate = 0;
  for (let i = rates.length - 1; i >= 0; i--) {
    if (threshold > rates[i].threshold) {
      thresholdSurchargeRate = rates[i].rate;
      if (regime === 'NEW' && thresholdSurchargeRate > 0.25) {
        thresholdSurchargeRate = 0.25;
      }
      break;
    }
  }

  const taxAtThresholdWithSurcharge = baseTaxAtThreshold * (1 + thresholdSurchargeRate);
  const marginalLimit = taxAtThresholdWithSurcharge + (taxableIncome - threshold);

  if (taxWithSurcharge > marginalLimit) {
    return marginalLimit;
  }

  return taxWithSurcharge;
};

/**
 * Core Indian Income Tax calculator.
 * Implements FY 2025-26 rules.
 * @param {number} taxableIncome 
 * @param {string} regime - "NEW" or "OLD"
 * @returns {Object} Tax breakup
 */
const calculateAnnualTax = (taxableIncome, regime = 'NEW') => {
  const slabs = regime === 'NEW' ? STATUTORY_CONSTANTS.TDS.SLABS_NEW : STATUTORY_CONSTANTS.TDS.SLABS_OLD;
  let baseTax = calculateSlabTax(taxableIncome, slabs);

  // Apply Section 87A Rebate
  let rebate = 0;
  if (regime === 'NEW') {
    const limit = STATUTORY_CONSTANTS.TDS.REBATE_87A_LIMIT_NEW;
    if (taxableIncome <= limit) {
      rebate = baseTax; // 100% rebate up to ₹25,000
    } else {
      // Marginal rebate for New Regime u/s 87A (Budget 2023/2024 update):
      // If income is slightly above 7L, tax cannot exceed (Income - 7L).
      const excessIncome = taxableIncome - limit;
      if (baseTax > excessIncome) {
        rebate = baseTax - excessIncome;
      }
    }
  } else {
    const limit = STATUTORY_CONSTANTS.TDS.REBATE_87A_LIMIT_OLD;
    if (taxableIncome <= limit) {
      rebate = Math.min(baseTax, STATUTORY_CONSTANTS.TDS.REBATE_87A_MAX_OLD);
    }
  }

  baseTax = Math.max(0, baseTax - rebate);

  // Apply Surcharge + Surcharge Marginal Relief
  let taxAfterSurcharge = baseTax;
  if (taxableIncome > 5000000.0) {
    taxAfterSurcharge = calculateSurchargeWithMarginalRelief(taxableIncome, baseTax, regime);
  }

  // Health & Education Cess (4%)
  const cess = taxAfterSurcharge * STATUTORY_CONSTANTS.TDS.CESS_RATE;
  const totalTax = taxAfterSurcharge + cess;

  return {
    taxableIncome,
    baseTax,
    rebate,
    surcharge: taxAfterSurcharge - baseTax,
    cess,
    totalTax
  };
};

/**
 * Calculates and projects TDS for an employee's payroll run.
 * @param {string} employeeId 
 * @param {number} month - 1-indexed
 * @param {number} year 
 * @param {number} currentMonthGross 
 * @param {number} currentMonthBasic 
 * @param {number} currentMonthDA 
 * @returns {Promise<Object>} Calculated TDS details
 */
const projectTDS = async (employeeId, month, year, currentMonthGross, currentMonthBasic, currentMonthDA) => {
  const financialYear = getFinancialYear(month, year);
  
  // 1. Get Employee, Salary Structure, and declarations
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      salaryStructure: true,
      pfDetails: true
    }
  });

  if (!employee) throw new Error('Employee not found');

  const structure = employee.salaryStructure;
  if (!structure || !structure.tdsEnabled) {
    return { tdsAmount: 0.0, message: 'TDS disabled for employee' };
  }

  // 2. Fetch Declarations
  const declaration = await prisma.employeeTaxDeclaration.findUnique({
    where: {
      employeeId_financialYear: { employeeId, financialYear }
    }
  });

  const regime = declaration?.regime || 'NEW';

  // 3. Fetch YTD Earnings & TDS from finalized runs
  const ytdRecords = await prisma.payrollRecord.findMany({
    where: {
      employeeId,
      payrollRun: {
        financialYear: undefined, // Filter by months in current FY
        status: { in: ['PROCESSED', 'LOCKED'] }
      }
    },
    include: { payrollRun: true }
  });

  // Filter YTD records manually based on financial year rules (in case database financialYear isn't marked yet)
  const currentFYRecords = ytdRecords.filter(r => 
    getFinancialYear(r.payrollRun.month, r.payrollRun.year) === financialYear
  );

  const ytdGross = currentFYRecords.reduce((sum, r) => sum + r.grossEarnings, 0);
  const ytdTDS = currentFYRecords.reduce((sum, r) => sum + r.tax, 0);
  const ytdPF = currentFYRecords.reduce((sum, r) => sum + r.pf, 0);

  // 4. Fetch Previous Employer Details (if any)
  const prevEmployer = await prisma.previousEmployerIncome.findUnique({
    where: {
      employeeId_financialYear: { employeeId, financialYear }
    }
  });

  const prevGross = prevEmployer?.previousEmployerGross || 0.0;
  const prevTDS = prevEmployer?.previousEmployerTDS || 0.0;
  const prevPF = prevEmployer?.previousEmployerPF || 0.0;
  const prevPT = prevEmployer?.previousEmployerPT || 0.0;

  // 5. Project remaining months
  const remainingMonths = getRemainingMonthsInFY(month);

  // Standard projected monthly gross from structure
  const monthlyGrossStandard = (structure.basicSalary || 0) +
    (structure.hra || 0) +
    (structure.da || 0) +
    (structure.conveyance || 0) +
    (structure.medical || 0) +
    (structure.specialAllowance || 0) +
    (structure.otherAllowance || 0);

  const projectedFutureGross = remainingMonths * monthlyGrossStandard;
  
  // Total Projected Annual Gross
  const projectedAnnualGross = ytdGross + currentMonthGross + prevGross + projectedFutureGross;

  // 6. Deductions & Exemptions
  let totalDeductions = 0.0;
  const standardDeduction = regime === 'NEW' 
    ? STATUTORY_CONSTANTS.TDS.STANDARD_DEDUCTION_NEW 
    : STATUTORY_CONSTANTS.TDS.STANDARD_DEDUCTION_OLD;
  
  totalDeductions += standardDeduction;

  if (regime === 'OLD') {
    // Add Chapter VI-A declared investments
    if (declaration) {
      // 80C capped at 1.5L
      const dec80C = Math.min(declaration.section80C || 0, 150000.0);
      // PF contribution also counts towards 80C (statutory employee PF + projected PF + previous employer PF)
      const currentMonthPF = currentMonthBasic * (structure.pfEnabled ? (structure.pfRate || 0.12) : 0);
      const projectedFuturePF = remainingMonths * (structure.basicSalary * (structure.pfEnabled ? (structure.pfRate || 0.12) : 0));
      const totalPFDeduction = ytdPF + currentMonthPF + projectedFuturePF + prevPF;
      
      const aggregate80C = Math.min(dec80C + totalPFDeduction, 150000.0);
      totalDeductions += aggregate80C;

      // 80D capped at 75K
      const dec80D = Math.min(declaration.section80D || 0, 75000.0);
      totalDeductions += dec80D;

      // Section 24b capped at 2L
      const dec24b = Math.min(declaration.section24b || 0, 200000.0);
      totalDeductions += dec24b;

      // Other deductions u/s Chapter VI-A (80G, etc.)
      totalDeductions += (declaration.otherDeductions || 0);
    }
  }

  // Calculate Taxable Income
  const taxableIncome = Math.max(0, projectedAnnualGross - totalDeductions);

  // 7. Calculate Annual Tax
  const taxBreakup = calculateAnnualTax(taxableIncome, regime);

  // 8. Distribute remaining tax across remaining months
  const totalTaxLiability = taxBreakup.totalTax;
  const remainingTaxToDeduct = Math.max(0, totalTaxLiability - ytdTDS - prevTDS);

  // Remaining pay periods = remaining months + 1 (the current month itself)
  const payPeriods = remainingMonths + 1;
  const monthlyTDS = remainingTaxToDeduct / payPeriods;

  // Round to nearest rupee per standard compliance
  const roundedTDS = Math.round(monthlyTDS * 100) / 100;

  // 9. Save TDS projection snapshot in DB (optional audit logging/reporting ledger)
  // We can write to TDSLedger on finalization. In preflight, we just return the calculated value.
  return {
    tdsAmount: Math.max(0, roundedTDS),
    regime,
    annualGross: projectedAnnualGross,
    taxableIncome,
    totalAnnualTax: totalTaxLiability,
    tdsDeductedYtd: ytdTDS,
    previousTds: prevTDS,
    remainingTax: remainingTaxToDeduct,
    payPeriods,
    breakup: taxBreakup
  };
};

module.exports = {
  getFinancialYear,
  getRemainingMonthsInFY,
  calculateAnnualTax,
  projectTDS,
  calculateSurchargeWithMarginalRelief
};
