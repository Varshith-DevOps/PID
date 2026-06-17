/**
 * @fileoverview ESIC Monthly Contribution Statement Generator.
 * Generates ESIC monthly reports for filing.
 */

/**
 * Generates ESIC Monthly Contribution Statement.
 * @param {Array<Object>} records - Payroll records with employee and ESI calculations
 * @returns {Object} { csvContent, summary }
 */
const generateESICReport = (records) => {
  const lines = [
    'IP Number,IP Name,No of Days,Total Wages,Reason Code,Last Working Date'
  ];

  const summary = {
    totalEmployees: records.length,
    eligibleEmployees: 0,
    totalWages: 0,
    employeeContribution: 0,
    employerContribution: 0,
    totalContribution: 0
  };

  for (const record of records) {
    const emp = record.employee;
    const name = `${emp.firstName} ${emp.lastName}`.trim().replace(/,/g, '');
    const ipNumber = emp.esicNumber || emp.pfDetails?.esiNumber || '';
    const workDays = record.daysWorked || 0;
    
    // ESI wages is grossEarnings minus excluded components like gratuity/bonus.
    // In our system, grossEarnings is already computed after adjustments but before deductions.
    const esiWages = record.esi > 0 ? record.grossEarnings : 0;

    let reasonCode = '0'; // 0 = Active
    let lastWorkingDate = '';

    if (emp.exitDetails?.lastWorkingDate && record.payrollRun?.month === new Date(emp.exitDetails.lastWorkingDate).getMonth() + 1) {
      reasonCode = '1'; // 1 = Left Service
      const lwd = new Date(emp.exitDetails.lastWorkingDate);
      lastWorkingDate = `${String(lwd.getDate()).padStart(2, '0')}/${String(lwd.getMonth() + 1).padStart(2, '0')}/${lwd.getFullYear()}`;
    }

    if (record.esi > 0) {
      summary.eligibleEmployees++;
      summary.totalWages += esiWages;
      summary.employeeContribution += record.esi;
      
      // Employer ESI is 3.25% of ESI wages
      const employerEsi = Math.round(esiWages * 0.0325 * 100) / 100;
      summary.employerContribution += employerEsi;
    }

    const line = [
      ipNumber || 'N/A',
      name,
      workDays,
      esiWages.toFixed(2),
      reasonCode,
      lastWorkingDate
    ].join(',');

    lines.push(line);
  }

  summary.totalContribution = summary.employeeContribution + summary.employerContribution;

  // Round summary totals
  summary.totalWages = Math.round(summary.totalWages * 100) / 100;
  summary.employeeContribution = Math.round(summary.employeeContribution * 100) / 100;
  summary.employerContribution = Math.round(summary.employerContribution * 100) / 100;
  summary.totalContribution = Math.round(summary.totalContribution * 100) / 100;

  const csvContent = lines.join('\n');
  return { csvContent, summary };
};

module.exports = {
  generateESICReport
};
