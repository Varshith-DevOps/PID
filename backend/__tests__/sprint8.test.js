const request = require('supertest');
const app = require('../src/index');
const prisma = require('../src/config/database');

describe('Sprint 8: Compliance, Payroll, & Exit Assurance', () => {
  let adminToken;
  let employee;
  let employeeToken;

  beforeAll(async () => {
    // Authenticate Admin
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@hrms.com', password: 'admin123' });
    adminToken = adminLogin.body.token;

    // Authenticate Employee
    const empLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'rajesh.kumar@company.com', password: 'employee123' });
    employeeToken = empLogin.body.token;

    employee = await prisma.employee.findFirst({ where: { email: 'rajesh.kumar@company.com' } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('EPFO Electronic Challan-cum-Return (ECR) Exporter', () => {
    let payrollRun;

    beforeAll(async () => {
      // Find or create a payroll run to test ECR generation
      payrollRun = await prisma.payrollRun.findFirst();
      if (!payrollRun) {
        payrollRun = await prisma.payrollRun.create({
          data: {
            month: 3,
            year: 2026,
            status: 'PROCESSED',
            companyId: employee.companyId,
          }
        });
      }
    });

    it('should generate and export the EPFO ECR text format with #~# separators', async () => {
      const res = await request(app)
        .get(`/api/reports/epf-ecr/${payrollRun.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.text).toContain('#~#');
    });

    it('should return 404 for invalid payroll run ID', async () => {
      const res = await request(app)
        .get('/api/reports/epf-ecr/invalid-payroll-run-id')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('Full & Final (F&F) Exit Settlement Blocker with Outstanding Assets', () => {
    let targetEmployee;
    let asset;

    beforeAll(async () => {
      // Find or create employee
      targetEmployee = await prisma.employee.findFirst({
        where: { email: 'suresh.patel@company.com' },
        include: { exitDetails: true }
      });
      if (!targetEmployee) {
        // Need a department to satisfy the FK constraint
        let dept = await prisma.department.findFirst({ where: { companyId: employee.companyId } });
        if (!dept) {
          dept = await prisma.department.create({ data: { name: 'General', companyId: employee.companyId } });
        }
        targetEmployee = await prisma.employee.create({
          data: {
            employeeId: `EMP-SURESH-${Date.now()}`,
            firstName: 'Suresh',
            lastName: 'Patel',
            email: `suresh.patel.${Date.now()}@company.com`,
            phone: '9876543219',
            gender: 'MALE',
            dateOfBirth: new Date('1990-01-01'),
            jobTitle: 'Developer',
            employmentType: 'FULL_TIME',
            joinDate: new Date('2025-01-01'),
            salary: 50000,
            departmentId: dept.id,
            companyId: employee.companyId,
          }
        });
      }

      // Ensure exit details exist
      if (!targetEmployee.exitDetails) {
        await prisma.exitDetails.create({
          data: {
            employeeId: targetEmployee.id,
            exitType: 'RESIGNATION',
            resignationDate: new Date(),
            lastWorkingDate: new Date(),
            noticePeriodDays: 30,
            exitReason: 'Career opportunities',
            fnfStatus: 'PENDING',
            fnfAmount: 50000,
          }
        });
      }

      // Create an unreturned asset assigned to targetEmployee
      asset = await prisma.asset.create({
        data: {
          name: 'Developer Laptop',
          assetTag: `ASSET-TEST-999-${Date.now()}`,
          category: 'LAPTOP',
          serialNumber: `SN-999-${Date.now()}`,
          status: 'ALLOCATED',
          assignedToId: targetEmployee.id,
          companyId: employee.companyId,
        }
      });
    });

    afterAll(async () => {
      // Clean up asset
      if (asset) {
        await prisma.asset.delete({ where: { id: asset.id } }).catch(() => {});
      }
    });

    it('should reject F&F settlement finalization when targetEmployee has outstanding physical assets', async () => {
      const res = await request(app)
        .post(`/api/fnf/finalize/${targetEmployee.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fnfStatus: 'PROCESSED',
          fnfAmount: 50000,
          notes: 'Attempt finalize with unreturned laptop'
        });

      // The backend should intercept the transaction with 400 bad request due to assets outstanding
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('outstanding assets');
    });
  });

  describe('Failsafe Attendance & GPS Regularization Bypass', () => {
    it('should submit a failsafe regularization request with physical GPS coordinates successfully', async () => {
      const res = await request(app)
        .post('/api/regularizations')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          date: new Date().toISOString(),
          requestType: 'MISSING_PUNCH_IN',
          reason: '[FAILSAFE GPS BYPASS]: Router offline',
          isFailsafeRegularization: true,
          gpsCoordinates: '12.9716, 77.5946',
          checkInCorrection: new Date().toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.isFailsafeRegularization).toBe(true);
      expect(res.body.gpsCoordinates).toBe('12.9716, 77.5946');
    });
  });

  describe('Blocked SSO Request Access Queue Portal', () => {
    it('should submit access justification requests to the admin queue successfully', async () => {
      const uniqueEmail = `sso-access-${Date.now()}@corporate.com`;
      const res = await request(app)
        .post('/api/auth/sso/request-access')
        .send({
          email: uniqueEmail,
          fullName: 'SSO Candidate User',
          department: 'Engineering',
          justification: 'Successfully logged in with Google Workspace but no dashboard profile setup.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.request.email).toBe(uniqueEmail);
      expect(res.body.request.status).toBe('PENDING');
    });
  });
});
