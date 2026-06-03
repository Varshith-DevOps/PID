/**
 * @fileoverview Full & Final (F&F) Settlement Engine.
 * Handles termination payouts, leave encashment, notice pay recovery, gratuity, and final TDS balancing.
 */

const prisma = require('../config/database');
const salaryCalculator = require('./salaryService');
const { projectTDS } = require('./tdsEngine');

/**
 * Calculates F&F Settlement details for an employee.
 * Does NOT save to database.
 * 
 * @param {string} employeeId 
 * @returns {Promise<Object>} Calculated F&F details
 */
const calculateFNFSettlement = async (employeeId) => {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      salaryStructure: true,
      exitDetails: true,
      leaveQuotas: true,
      addresses: true
    }
  });

  if (!employee) throw new Error('Employee not found');
  if (!employee.salaryStructure) throw new Error('Salary structure not configured');
  
  const exit = employee.exitDetails;
  if (!exit) throw new Error('Exit details/resignation not registered for this employee');

  const structure = employee.salaryStructure;
  const basic = structure.basicSalary;
  const da = structure.da || 0;
  const monthlyWages = basic + da;

  // 1. Pro-rata Salary for the final month
  const lwd = exit.lastWorkingDate ? new Date(exit.lastWorkingDate) : new Date();
  const exitMonth = lwd.getMonth() + 1;
  const exitYear = lwd.getFullYear();
  const workDaysInMonth = new Date(exitYear, exitMonth, 0).getDate();
  
  // Days worked in the exit month is up to the last working date
  const finalMonthDaysWorked = lwd.getDate();

  const currentAddress = employee.addresses?.find(a => a.type === 'CURRENT') || employee.addresses?.[0];
  const stateName = currentAddress ? currentAddress.state : 'DEFAULT';
  const permanentGross = salaryCalculator.calculateGrossEarnings(structure);

  const calcOptions = {
    tdsEnabled: false, // Calculate TDS separately during final projection
    employeePf: structure.pfEnabled,
    state: stateName,
    gender: employee.gender || 'Male',
    month: exitMonth,
    esiCycleEligible: permanentGross <= 21000,
  };

  const finalMonthSalary = await salaryCalculator.calculateProportionalSalary(
    structure,
    finalMonthDaysWorked,
    workDaysInMonth,
    calcOptions
  );

  // 2. Leave Encashment
  // Query total active unused leave balance
  const activeQuotas = employee.leaveQuotas || [];
  const unusedLeaves = activeQuotas.reduce((sum, quota) => sum + Math.max(0, quota.quota - quota.used), 0);
  const dailyWagesRate = monthlyWages / 30; // standard 30 day divisor for encashment
  const leaveEncashmentPay = Math.round(unusedLeaves * dailyWagesRate * 100) / 100;

  // 3. Gratuity Calculation
  const joinDate = employee.joinDate ? new Date(employee.joinDate) : new Date();
  const serviceYears = (lwd - joinDate) / (365.25 * 24 * 60 * 60 * 1000);
  
  // Get total working days (approximate for verification or mock from attendances if needed)
  // Let's query attendance records count to find total working days
  const totalWorkingDays = await prisma.attendance.count({
    where: { employeeId, status: { in: ['PRESENT', 'LATE'] } }
  });

  const gratuityAmount = salaryCalculator.calculateGratuity(
    basic,
    da,
    serviceYears,
    totalWorkingDays,
    exit.exitType
  );

  // 4. Notice Period Recovery / Shortfall
  const noticeDaysShortfall = exit.noticePeriodDays ? Math.max(0, exit.noticePeriodDays - finalMonthDaysWorked) : 0;
  const noticeRecoveryAmount = Math.round(noticeDaysShortfall * dailyWagesRate * 100) / 100;

  // 5. Total Gross F&F Earnings (before final tax)
  const finalMonthGross = finalMonthSalary.grossEarnings;
  const fnfGrossEarnings = finalMonthGross + leaveEncashmentPay + gratuityAmount;

  // 6. Final TDS balancing
  // Calculate final TDS on total FY income including F&F gross (less gratuity, which is exempt up to ₹25L)
  // Gratuity is exempt u/s 10(10), so it is excluded from taxable gross
  const fnfTaxableGrossComponent = finalMonthGross + leaveEncashmentPay;
  
  const finalTdsResult = await projectTDS(
    employeeId,
    exitMonth,
    exitYear,
    fnfTaxableGrossComponent,
    basic,
    da
  );

  const finalTDSDeduction = finalTdsResult.tdsAmount;

  // 7. Net Payout Calculation
  const totalDeductions = finalMonthSalary.totalDeductions + finalTDSDeduction;
  const netSettlementAmount = Math.max(0, fnfGrossEarnings - noticeRecoveryAmount - totalDeductions);

  return {
    employee: {
      id: employee.id,
      employeeId: employee.employeeId,
      name: `${employee.firstName} ${employee.lastName}`,
      joinDate: formatDate(employee.joinDate),
      lastWorkingDate: formatDate(exit.lastWorkingDate)
    },
    earnings: {
      finalMonthSalary: finalMonthSalary.grossEarnings,
      leaveEncashment: leaveEncashmentPay,
      gratuity: gratuityAmount,
      totalEarnings: fnfGrossEarnings
    },
    deductions: {
      noticeRecovery: noticeRecoveryAmount,
      employeePf: finalMonthSalary.breakdowns.deductions.employeePf,
      employeeEsi: finalMonthSalary.breakdowns.deductions.employeeEsi,
      professionalTax: finalMonthSalary.breakdowns.deductions.professionalTax,
      finalTDS: finalTDSDeduction,
      totalDeductions: totalDeductions + noticeRecoveryAmount
    },
    balances: {
      unusedLeaveBalance: unusedLeaves,
      serviceYears: serviceYears.toFixed(2),
      noticeShortfallDays: noticeDaysShortfall
    },
    netSettlement: Math.round(netSettlementAmount * 100) / 100
  };
};

const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toISOString().split('T')[0];
};

module.exports = {
  calculateFNFSettlement
};
