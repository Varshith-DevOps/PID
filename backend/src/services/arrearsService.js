/**
 * @fileoverview Retroactive Arrears Calculation Engine.
 * Dynamically reconciles past payroll history with salary revision effective dates.
 */

const prisma = require('../config/database');

/**
 * Calculates net pending arrears for an employee.
 * Stateless reconciliation: compares active revisions against actual base paid in past payroll runs.
 * 
 * @param {string} employeeId - Employee ID
 * @param {number} targetMonth - Current payroll month
 * @param {number} targetYear - Current payroll year
 * @returns {Promise<Object>} { netArrears, breakdown }
 */
const calculateArrears = async (employeeId, targetMonth, targetYear) => {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      salaryRevisions: true,
      salaryStructure: true
    }
  });

  if (!employee) return { netArrears: 0, breakdown: [] };

  // Fetch all historical finalized payroll records
  const records = await prisma.payrollRecord.findMany({
    where: {
      employeeId,
      payrollRun: {
        status: { in: ['PROCESSED', 'LOCKED'] }
      }
    },
    include: { payrollRun: true }
  });

  let totalArrearsDue = 0;
  let totalArrearsPaid = 0;
  const breakdown = [];

  for (const record of records) {
    const run = record.payrollRun;

    // Only process months prior to the target run month/year
    if (run.year > targetYear || (run.year === targetYear && run.month >= targetMonth)) {
      continue;
    }

    const endOfMonth = new Date(run.year, run.month, 0, 23, 59, 59, 999);

    // Find the salary revision that was active at the end of this historical month
    const activeRevision = employee.salaryRevisions
      .filter(rev => new Date(rev.effectiveDate) <= endOfMonth)
      .sort((a, b) => {
        const dateDiff = new Date(b.effectiveDate) - new Date(a.effectiveDate);
        if (dateDiff !== 0) return dateDiff;
        return new Date(b.createdAt) - new Date(a.createdAt);
      })[0];

    // Target monthly salary (revised)
    const targetSalary = activeRevision ? activeRevision.revisedSalary : employee.salary;

    // Actual base salary paid (gross earnings excluding overtime, arrears, and incentives)
    const basePaid = record.grossEarnings - (record.arrears || 0) - (record.incentives || 0) - (record.overtimePay || 0);

    const difference = Math.max(0, targetSalary - basePaid);
    totalArrearsDue += difference;
    totalArrearsPaid += (record.arrears || 0);

    breakdown.push({
      period: `${run.year}-${String(run.month).padStart(2, '0')}`,
      targetSalary: Math.round(targetSalary * 100) / 100,
      actualBasePaid: Math.round(basePaid * 100) / 100,
      arrearsDue: Math.round(difference * 100) / 100,
      arrearsPaidInMonth: Math.round((record.arrears || 0) * 100) / 100
    });
  }

  const netArrears = Math.max(0, totalArrearsDue - totalArrearsPaid);

  return {
    netArrears: Math.round(netArrears * 100) / 100,
    breakdown
  };
};

module.exports = {
  calculateArrears
};
