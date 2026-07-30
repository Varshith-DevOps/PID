const request = require('supertest');
const app = require('../src/index');
const prisma = require('../src/config/database');

describe('Exit Settlement & Leave Encashment Tests (Sprint 3)', () => {
  let employee;
  let hrToken;

  beforeAll(async () => {
    // Clear login audit logs for the admin user to prevent geo-velocity blocking from other tests
    const hrUser = await prisma.user.findFirst({ where: { email: 'admin@hrms.com' } });
    if (hrUser) {
      await prisma.auditLog.deleteMany({
        where: {
          userId: hrUser.id,
          action: { in: ['AUTH_LOGIN_SUCCESS', 'AUTH_PASSKEY_LOGIN_SUCCESS', 'AUTH_SSO_LOGIN_SUCCESS', 'AUTH_LOGIN_ANOMALOUS_GEO_VELOCITY'] }
        }
      });
    }

    // Log in as admin/HR
    const hrLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@hrms.com', password: 'admin123' });
    hrToken = hrLoginRes.body.token;

    // Get a test employee
    employee = await prisma.employee.findFirst({
      where: { email: 'rajesh.kumar@company.com' }
    });

    // Make sure the employee is active
    await prisma.employee.update({
      where: { id: employee.id },
      data: { isActive: true }
    });

    // Clean up any existing exit details for the employee
    await prisma.exitDetails.deleteMany({ where: { employeeId: employee.id } });
  });

  afterAll(async () => {
    await prisma.exitDetails.deleteMany({ where: { employeeId: employee.id } });
    await prisma.employee.update({
      where: { id: employee.id },
      data: { isActive: true }
    });
    await prisma.$disconnect();
  });

  describe('Exit Details Remarks Handling', () => {
    it('should save and update exit details with remarks successfully', async () => {
      // Create new exit details with remarks
      const res = await request(app)
        .put(`/api/employees/${employee.id}/exit-details`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          exitType: 'RESIGNATION',
          resignationDate: '2026-08-01',
          lastWorkingDate: '2026-08-31',
          noticePeriodDays: 30,
          exitReason: 'Career opportunities',
          exitInterview: true,
          rehireEligible: true,
          remarks: 'This employee has done outstanding work.',
          changeReason: 'Setting up exit details for test'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('remarks', 'This employee has done outstanding work.');

      // Verify in DB
      const dbDetails = await prisma.exitDetails.findUnique({
        where: { employeeId: employee.id }
      });
      expect(dbDetails.remarks).toBe('This employee has done outstanding work.');
    });
  });

  describe('Leave Encashment & F&F Finalization', () => {
    it('should calculate F&F, strictly paying out ANNUAL leaves, and finalize without crash', async () => {
      // 1. Configure leave quotas: set ANNUAL to 12 days and CASUAL to 5 days
      await prisma.leaveQuota.deleteMany({ where: { employeeId: employee.id } });
      await prisma.leaveQuota.create({
        data: {
          employeeId: employee.id,
          leaveType: 'ANNUAL',
          quota: 15,
          used: 3, // Remaining: 12 days
          year: 2026
        }
      });
      await prisma.leaveQuota.create({
        data: {
          employeeId: employee.id,
          leaveType: 'CASUAL',
          quota: 10,
          used: 2, // Remaining: 8 days (should NOT be encashed)
          year: 2026
        }
      });

      // 2. Query calculation draft via API
      const calcRes = await request(app)
        .get(`/api/fnf/calculate/${employee.id}`)
        .set('Authorization', `Bearer ${hrToken}`);

      expect(calcRes.status).toBe(200);
      expect(calcRes.body).toHaveProperty('earnings');
      expect(calcRes.body.earnings).toHaveProperty('leaveEncashment');

      // The calculation divisor is 30, so: (12 days) * (basic + da) / 30
      const structure = await prisma.salaryStructure.findFirst({
        where: { employeeId: employee.id }
      });
      const monthlyWages = structure.basicSalary + (structure.da || 0);
      const expectedEncashment = Math.round((12 * monthlyWages / 30) * 100) / 100;
      expect(calcRes.body.earnings.leaveEncashment).toBe(expectedEncashment);

      // 3. Finalize F&F settlement
      const finalizeRes = await request(app)
        .post(`/api/fnf/finalize/${employee.id}`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ remarks: 'All exit assets returned. F&F approved.' });

      expect(finalizeRes.status).toBe(200);
      expect(finalizeRes.body.message).toContain('Full & Final settlement finalized successfully');

      // 4. Verify employee is now INACTIVE in DB
      const updatedEmp = await prisma.employee.findUnique({
        where: { id: employee.id }
      });
      expect(updatedEmp.isActive).toBe(false);

      // 5. Verify exit details database status & amount
      const exitDetails = await prisma.exitDetails.findUnique({
        where: { employeeId: employee.id }
      });
      expect(exitDetails.fnfStatus).toBe('COMPLETED');
      expect(exitDetails.fnfAmount).toBe(calcRes.body.netSettlement);
      expect(exitDetails.remarks).toBe('All exit assets returned. F&F approved.');
    });
  });
});
