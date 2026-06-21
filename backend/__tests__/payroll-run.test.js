const request = require('supertest');
const app = require('../src/index');
const prisma = require('../src/config/database');

const confirmations = {
  attendanceLocked: true, lopsAdded: true, salaryRevisionUpdated: true,
  incomeTaxDeclaration: true, investmentProofs: true, arrearsReviewed: true,
  incentivesReviewed: true, overtimeApproved: true,
  statutoryComplianceReviewed: true, bankAndPayoutVerified: true,
};

const EMP_ID = 'QArun-netpay';
const YEAR = 2099;
const MONTH = 6;

async function cleanup() {
  // A run processes the whole company, so delete ALL of its records (not just
  // ours) before the run, or the FK blocks deletion and the leftover run breaks
  // the next invocation.
  const runs = await prisma.payrollRun.findMany({ where: { year: YEAR, month: MONTH } }).catch(() => []);
  for (const run of runs) {
    await prisma.payrollRecord.deleteMany({ where: { payrollRunId: run.id } }).catch(() => {});
  }
  await prisma.payrollRun.deleteMany({ where: { year: YEAR, month: MONTH } }).catch(() => {});

  const emp = await prisma.employee.findFirst({ where: { employeeId: EMP_ID } });
  if (emp) {
    await prisma.payrollRecord.deleteMany({ where: { employeeId: emp.id } }).catch(() => {});
    await prisma.salaryStructure.deleteMany({ where: { employeeId: emp.id } }).catch(() => {});
    await prisma.employee.delete({ where: { id: emp.id } }).catch(() => {});
  }
}

describe('End-to-end payroll run (net = gross − deductions)', () => {
  let adminToken, employeeId;

  beforeAll(async () => {
    await cleanup();
    const a = await request(app).post('/api/auth/login').send({ email: 'admin@hrms.com', password: 'admin123' });
    adminToken = a.body.token;
    const adminUser = await prisma.user.findFirst({ where: { email: 'admin@hrms.com' } });
    const anyEmp = await prisma.employee.findFirst({ where: { companyId: adminUser.companyId } });

    const emp = await prisma.employee.create({
      data: {
        employeeId: EMP_ID, firstName: 'Net', lastName: 'Pay', email: 'netpay-run@example.com',
        jobTitle: 'QA', departmentId: anyEmp.departmentId, employmentType: 'FULL_TIME',
        joinDate: new Date(YEAR - 1, 0, 1), salary: 100000, companyId: adminUser.companyId,
      },
    });
    employeeId = emp.id;
    await prisma.salaryStructure.create({
      data: {
        employeeId: emp.id, basicSalary: 50000, hra: 20000, da: 0, conveyance: 0, medical: 0,
        specialAllowance: 30000, otherAllowance: 0,
        pfEnabled: true, tdsEnabled: true, esiEnabled: false, professionalTaxEnabled: true, lwfEnabled: false,
      },
    });
  });

  afterAll(async () => { await cleanup(); await prisma.$disconnect(); });

  it('produces a record whose net pay equals gross minus total deductions, with PF capped', async () => {
    const res = await request(app).post('/api/payroll/run')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ month: MONTH, year: YEAR, confirmations });
    expect(res.status).toBe(200);

    const record = res.body.records.find((r) => r.employeeId === employeeId);
    expect(record).toBeTruthy();

    // Full month (joined a year earlier): no proration.
    expect(record.daysWorked).toBe(record.workDays);
    // Gross = sum of components.
    expect(record.grossEarnings).toBe(100000);
    // PF capped at 12% of ₹15,000 ceiling (verified unit calc flows into the run).
    expect(record.pf).toBe(1800);
    // ESI disabled -> 0.
    expect(record.esi).toBe(0);

    // The core integration invariant: net = gross − total deductions (to the paisa).
    const net = record.netSalary;
    const expectedNet = Math.round((record.grossEarnings - record.totalDeductions) * 100) / 100;
    expect(net).toBe(expectedNet);

    // Total deductions should at least include PF + PT + TDS.
    expect(record.totalDeductions).toBeGreaterThanOrEqual(record.pf + record.professionalTax + record.tax - 0.01);
  });
});
