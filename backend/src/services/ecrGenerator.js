/**
 * @fileoverview EPFO ECR (Electronic Challan-cum-Return) text generator.
 * Format is fixed-field row separated by #~# delimiter per EPFO requirements.
 */

const { validateUAN } = require('./validators');

/**
 * Generates EPFO ECR file content from payroll record data.
 * @param {Array<Object>} records - List of payroll records with employee and PF details
 * @returns {Object} { ecrContent, validationReport }
 */
const generateEPFO_ECR = (records) => {
  const lines = [];
  const validationReport = {
    totalEmployees: records.length,
    validRecords: 0,
    invalidRecords: 0,
    errors: [],
    totals: {
      grossWages: 0,
      epfWages: 0,
      epsWages: 0,
      edliWages: 0,
      employeeEpf: 0,
      employerEps: 0,
      employerEpfDiff: 0,
    }
  };

  for (const record of records) {
    const emp = record.employee;
    const pfDetails = emp.pfDetails;
    const name = `${emp.firstName} ${emp.lastName}`.trim().slice(0, 150);
    const uan = pfDetails?.uanNumber || '';

    // Validate UAN
    if (!uan) {
      validationReport.invalidRecords++;
      validationReport.errors.push({
        employeeId: emp.employeeId,
        name,
        reason: 'UAN is missing'
      });
      continue;
    }

    if (!validateUAN(uan)) {
      validationReport.invalidRecords++;
      validationReport.errors.push({
        employeeId: emp.employeeId,
        name,
        uan,
        reason: 'Invalid UAN format (must be 12 digits, cannot start with 0)'
      });
      continue;
    }

    // Calculations
    const grossWages = Math.round(record.grossEarnings);
    
    // EPF wages = basic + da, capped at 15000 unless employee structure is uncapped
    // Let's use the actual basic + da in record, capped at 15000 if restricted
    const basicAndDa = record.basicSalary + (record.da || 0);
    const isRestricted = pfDetails?.restrictPfToCeiling !== false; // default true
    const epfWages = Math.round(isRestricted ? Math.min(basicAndDa, 15000) : basicAndDa);
    const epsWages = Math.round(Math.min(basicAndDa, 15000));
    const edliWages = Math.round(Math.min(basicAndDa, 15000));

    // EPF Contribution (Employee PF + VPF amount if any)
    const employeeEpfContribution = Math.round(record.pf + (record.vpfAmount || 0));
    
    // EPS Contribution (Employer EPS)
    const employerEps = Math.round(Math.min(epsWages * 0.0833, 1250));
    
    // EPF Difference (Employer EPF - Employer EPS)
    const totalEmployerPF = Math.round(epfWages * 0.12);
    const employerEpfDiff = Math.max(0, totalEmployerPF - employerEps);

    const ncpDays = Math.round(record.lopDays || 0);
    const refundOfAdvances = 0; // default 0

    // Construct the ECR line: UAN#~#Member Name#~#Gross#~#EPF#~#EPS#~#EDLI#~#EE_EPF#~#ER_EPS#~#ER_EPF_DIFF#~#NCP#~#REFUND
    const line = [
      uan,
      name,
      grossWages,
      epfWages,
      epsWages,
      edliWages,
      employeeEpfContribution,
      employerEps,
      employerEpfDiff,
      ncpDays,
      refundOfAdvances
    ].join('#~#');

    lines.push(line);

    // Sum totals for reconciliation
    validationReport.validRecords++;
    validationReport.totals.grossWages += grossWages;
    validationReport.totals.epfWages += epfWages;
    validationReport.totals.epsWages += epsWages;
    validationReport.totals.edliWages += edliWages;
    validationReport.totals.employeeEpf += employeeEpfContribution;
    validationReport.totals.employerEps += employerEps;
    validationReport.totals.employerEpfDiff += employerEpfDiff;
  }

  const ecrContent = lines.join('\n');
  return { ecrContent, validationReport };
};

module.exports = {
  generateEPFO_ECR
};
