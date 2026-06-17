const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../src/index');
const prisma = require('../src/config/database');

const payrollConfirmations = {
  attendanceLocked: true,
  lopsAdded: true,
  salaryRevisionUpdated: true,
  incomeTaxDeclaration: true,
  investmentProofs: true,
  arrearsReviewed: true,
  incentivesReviewed: true,
  overtimeApproved: true,
  statutoryComplianceReviewed: true,
  bankAndPayoutVerified: true,
};

const cleanupQaPayrollData = async () => {
  const qaDocuments = await prisma.document.findMany({
    where: { name: { startsWith: 'Sensitive QA' } },
    select: { id: true, filePath: true },
  });
  for (const document of qaDocuments) {
    const resolvedPath = path.resolve(document.filePath);
    const uploadRoot = path.resolve(__dirname, '../uploads');
    if (resolvedPath.startsWith(uploadRoot) && fs.existsSync(resolvedPath)) {
      fs.unlinkSync(resolvedPath);
    }
  }
  if (qaDocuments.length) {
    await prisma.document.deleteMany({ where: { id: { in: qaDocuments.map((document) => document.id) } } });
  }

  await prisma.jobApplicant.deleteMany({ where: { email: { contains: 'closed-' } } });
  await prisma.jobOpening.deleteMany({ where: { title: { startsWith: 'Closed QA Role' } } });

  const qaEmployees = await prisma.employee.findMany({
    where: {
      OR: [
        { employeeId: { startsWith: 'QA' } },
        { email: { contains: 'midmonth-' } },
      ],
    },
    select: { id: true },
  });
  const qaEmployeeIds = qaEmployees.map((employee) => employee.id);

  const qaRuns = await prisma.payrollRun.findMany({
    where: {
      OR: [
        { year: { gte: 2099 } },
        { processedBy: 'qa' },
      ],
    },
    select: { id: true },
  });
  const qaRunIds = qaRuns.map((run) => run.id);

  if (qaRunIds.length) {
    await prisma.workflowInstance.deleteMany({ where: { module: 'PAYROLL', entityId: { in: qaRunIds } } });
    await prisma.payrollApproval.deleteMany({ where: { payrollRunId: { in: qaRunIds } } });
    await prisma.payrollRecord.deleteMany({ where: { payrollRunId: { in: qaRunIds } } });
    await prisma.payrollRun.deleteMany({ where: { id: { in: qaRunIds } } });
  }

  if (qaEmployeeIds.length) {
    await prisma.salaryStructure.deleteMany({ where: { employeeId: { in: qaEmployeeIds } } });
    await prisma.employee.deleteMany({ where: { id: { in: qaEmployeeIds } } });
  }
};

describe('Production Risk Hardening', () => {
  let adminToken;
  let employeeToken;
  let employeeId;
  let otherEmployeeId;
  let departmentId;

  beforeAll(async () => {
    await cleanupQaPayrollData();

    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@hrms.com', password: 'admin123' });
    adminToken = adminRes.body.token;

    const employeeRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'rajesh.kumar@company.com', password: 'employee123' });
    employeeToken = employeeRes.body.token;

    const employee = await prisma.employee.findUnique({ where: { email: 'rajesh.kumar@company.com' } });
    const otherEmployee = await prisma.employee.findUnique({ where: { email: 'priya.sharma@company.com' } });
    const department = await prisma.department.findFirst();
    employeeId = employee.id;
    otherEmployeeId = otherEmployee.id;
    departmentId = department.id;
  });

  afterAll(async () => {
    await cleanupQaPayrollData();
    await prisma.$disconnect();
  });

  it('blocks direct document access for another employee', async () => {
    const uploadRes = await request(app)
      .post(`/api/documents/${otherEmployeeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('name', 'Sensitive QA PAN')
      .field('type', 'PAN')
      .attach('file', Buffer.from('confidential-test-file'), 'qa-pan.txt');

    expect(uploadRes.status).toBe(201);

    const downloadRes = await request(app)
      .get(`/api/documents/download/${uploadRes.body.id}`)
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(downloadRes.status).toBe(403);
  });

  it('rejects unsupported dynamic report filter fields', async () => {
    const res = await request(app)
      .post('/api/reports/query')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        filters: [{ field: 'password', operator: 'CONTAINS', value: 'x' }],
      });

    expect(res.status).toBe(400);
  });

  it('prevents public applications to closed job openings', async () => {
    const job = await prisma.jobOpening.create({
      data: {
        title: `Closed QA Role ${Date.now()}`,
        departmentId,
        description: 'Closed role',
        requirements: 'None',
        location: 'Bengaluru',
        status: 'CLOSED',
      },
    });

    const res = await request(app)
      .post('/api/recruitment/applicants')
      .field('jobOpeningId', job.id)
      .field('fullName', 'Closed Candidate')
      .field('email', `closed-${Date.now()}@example.com`)
      .field('phone', '9999999999');

    expect(res.status).toBe(400);
  });

  it('blocks attendance edits for a payroll-locked month', async () => {
    const lockedDate = new Date(2099, 0, 15);
    await prisma.payrollRun.deleteMany({ where: { month: 1, year: 2099 } });
    await prisma.payrollRun.create({
      data: { month: 1, year: 2099, status: 'DRAFT', processedBy: 'qa' },
    });

    const res = await request(app)
      .post('/api/attendance/mark')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        employeeId,
        date: lockedDate.toISOString(),
        status: 'PRESENT',
      });

    expect(res.status).toBe(423);
  });

  it('returns payroll preflight issues instead of crashing when salary structure is missing', async () => {
    const stamp = Date.now();
    const year = 2100 + Math.floor((stamp / 1000) % 200);
    const adminUser = await prisma.user.findFirst({ where: { email: 'admin@hrms.com' } });
    await prisma.employee.create({
      data: {
        employeeId: `QA-NOSAL-${stamp}`,
        firstName: 'Missing',
        lastName: 'Salary',
        email: `midmonth-nosalary-${stamp}@example.com`,
        jobTitle: 'QA Payroll Gap',
        departmentId,
        employmentType: 'FULL_TIME',
        joinDate: new Date(year, 0, 1),
        salary: 50000,
        companyId: adminUser.companyId,
      },
    });

    const res = await request(app)
      .get(`/api/payroll/preflight?month=1&year=${year}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.automaticChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'salaryStructures',
          passed: false,
        }),
      ])
    );
  });

  it('prorates payroll for an employee joining mid-month', async () => {
    const stamp = Date.now();
    const year = 2100 + Math.floor((stamp / 1000) % 200);
    const adminUser = await prisma.user.findFirst({ where: { email: 'admin@hrms.com' } });
    const employee = await prisma.employee.create({
      data: {
        employeeId: `QA${stamp}`,
        firstName: 'Midmonth',
        lastName: 'Joiner',
        email: `midmonth-${stamp}@example.com`,
        jobTitle: 'QA Analyst',
        departmentId,
        employmentType: 'FULL_TIME',
        joinDate: new Date(year, 0, 10),
        salary: 100000,
        companyId: adminUser.companyId,
      },
    });

    await prisma.salaryStructure.create({
      data: {
        employeeId: employee.id,
        basicSalary: 50000,
        hra: 20000,
        da: 0,
        conveyance: 0,
        medical: 0,
        specialAllowance: 30000,
        otherAllowance: 0,
        pfEnabled: false,
        tdsEnabled: false,
        esiEnabled: false,
        professionalTaxEnabled: false,
        lwfEnabled: false,
      },
    });

    const res = await request(app)
      .post('/api/payroll/run')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ month: 1, year, confirmations: payrollConfirmations });

    expect(res.status).toBe(200);
    const record = res.body.records.find((item) => item.employeeId === employee.id);
    expect(record).toBeTruthy();
    expect(record.workDays).toBe(31);
    expect(record.daysWorked).toBe(22);
    expect(record.grossEarnings).toBeGreaterThan(70000);
    expect(record.grossEarnings).toBeLessThan(72000);
  });
});
