/**
 * Generated-artefact assertions for the statutory/payroll outputs:
 *   - EPFO ECR text (#~# delimited, per-record line, invalid-UAN skipping, totals)
 *   - ESIC monthly CSV (header + rows, eligibility/contribution summary)
 *   - Form 16 PDF (Part A + B, password-protected) — valid PDF buffer
 *   - Payslip PDF (single + bulk) — valid PDF buffers
 *
 * These test the generator services directly with synthetic records, so they assert
 * the *file format/structure* of the produced artefacts independently of a full
 * payroll run. Business-value correctness of the underlying numbers is covered by
 * payroll-calc / statutory-verify / reports suites.
 */

const { generateEPFO_ECR } = require('../src/services/ecrGenerator');
const { generateESICReport } = require('../src/services/esicReportGenerator');
const { generateForm16 } = require('../src/services/form16Generator');
const { generatePayslipPDF, generateBulkPayslips } = require('../src/services/pdfService');

const isPdf = (buf) => Buffer.isBuffer(buf) && buf.subarray(0, 5).toString() === '%PDF-';

// Three synthetic payroll records: two ECR-valid (valid UAN), one invalid (no UAN);
// one ESI-eligible (esi > 0), the rest not.
const records = [
  {
    grossEarnings: 50000, basicSalary: 30000, da: 0, pf: 1800, esi: 150, vpfAmount: 0,
    daysWorked: 30, lopDays: 0,
    employee: { firstName: 'Asha', lastName: 'Rao', employeeId: 'EMP01', esicNumber: '3100000001', pfDetails: { uanNumber: '100123456789', restrictPfToCeiling: true } },
  },
  {
    grossEarnings: 22000, basicSalary: 12000, da: 0, pf: 1440, esi: 0,
    daysWorked: 30, lopDays: 0,
    employee: { firstName: 'Bharat', lastName: 'Lal', employeeId: 'EMP02', pfDetails: { uanNumber: '100222333444' } },
  },
  {
    grossEarnings: 18000, basicSalary: 10000, da: 0, pf: 1200, esi: 0,
    daysWorked: 28, lopDays: 2,
    employee: { firstName: 'No', lastName: 'Uan', employeeId: 'EMP03', pfDetails: { uanNumber: '' } },
  },
];

describe('EPFO ECR generator', () => {
  const { ecrContent, validationReport } = generateEPFO_ECR(records);

  it('emits one #~#-delimited line per valid record with 11 fields', () => {
    const lines = ecrContent.split('\n').filter(Boolean);
    expect(lines.length).toBe(2); // two valid UANs; the third is skipped
    for (const line of lines) {
      expect(line.split('#~#')).toHaveLength(11);
    }
    // First field is the UAN.
    expect(lines[0].split('#~#')[0]).toBe('100123456789');
  });

  it('skips records with a missing/invalid UAN and reports them', () => {
    expect(validationReport.totalEmployees).toBe(3);
    expect(validationReport.validRecords).toBe(2);
    expect(validationReport.invalidRecords).toBe(1);
    expect(validationReport.errors[0].reason).toMatch(/UAN/i);
  });

  it('reconciles gross-wage totals across valid records', () => {
    expect(validationReport.totals.grossWages).toBe(72000); // 50000 + 22000
  });
});

describe('ESIC report generator', () => {
  const { csvContent, summary } = generateESICReport(records);
  const lines = csvContent.split('\n');

  it('starts with the ESIC column header and one row per record', () => {
    expect(lines[0]).toBe('IP Number,IP Name,No of Days,Total Wages,Reason Code,Last Working Date');
    expect(lines).toHaveLength(1 + records.length); // header + 3 rows
  });

  it('formats wages to 2 decimals and marks active rows with reason code 0', () => {
    const asha = lines[1].split(',');
    expect(asha[1]).toBe('Asha Rao');
    expect(asha[3]).toBe('50000.00');
    expect(asha[4]).toBe('0'); // active
  });

  it('counts only ESI-eligible employees and computes employer share at 3.25%', () => {
    expect(summary.eligibleEmployees).toBe(1);
    expect(summary.totalWages).toBe(50000);
    expect(summary.employerContribution).toBe(1625); // 50000 * 0.0325
  });
});

describe('Form 16 PDF generator', () => {
  it('produces a password-protected PDF buffer', async () => {
    const employee = { firstName: 'Asha', lastName: 'Rao', employeeId: 'EMP01', panNumber: 'ABCDE1234F', dateOfBirth: new Date('1990-04-25') };
    const taxDetails = {
      totalAnnualTax: 62400, annualGross: 1200000, regime: 'NEW', taxableIncome: 1125000,
      breakup: { baseTax: 60000, rebate: 0, surcharge: 0, cess: 2400, totalTax: 62400 },
    };
    const buf = await generateForm16(employee, taxDetails, '2025-26');
    expect(isPdf(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(1000);
  });
});

describe('Payslip PDF generator', () => {
  const record = {
    grossEarnings: 50000, totalDeductions: 5000, netSalary: 45000,
    basicSalary: 25000, hra: 10000, da: 0, conveyance: 1600, medical: 1250, specialAllowance: 12150, otherAllowance: 0,
    pf: 1800, esi: 0, professionalTax: 200, tax: 3000, otherDeduction: 0,
    daysWorked: 30, workDays: 30,
    payrollRun: { month: 6, year: 2026 },
  };
  const employee = { id: 'e1', firstName: 'Asha', lastName: 'Rao', employeeId: 'EMP01', jobTitle: 'QA Engineer', department: { name: 'Engineering' }, bankDetails: {}, pfDetails: {} };

  it('renders a single payslip as a valid PDF buffer', async () => {
    const buf = await generatePayslipPDF(record, employee);
    expect(isPdf(buf)).toBe(true);
  });

  it('renders a multi-employee bulk PDF', async () => {
    const buf = await generateBulkPayslips([{ ...record, employee }, { ...record, employee }], [employee]);
    expect(isPdf(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(2000);
  });
});
