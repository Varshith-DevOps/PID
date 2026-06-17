const request = require('supertest');
const app = require('../src/index');
const prisma = require('../src/config/database');

describe('KYC Compliance & Free Trial Gating Tests', () => {
  let superAdminToken;
  let testCompanyId;
  let testUserToken;
  const testCompanyCode = `testkyc_${Math.floor(Math.random() * 100000)}`;
  const testEmail = `admin_${Math.floor(Math.random() * 100000)}@testcompany.com`;

  beforeAll(async () => {
    // 1. Login as Super Admin to get administrative authorization token
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'superadmin@hrms.com', password: 'admin123' });
    superAdminToken = adminRes.body.token;

    // 2. Perform onboarding signup for a new company
    const signupRes = await request(app)
      .post('/api/auth/signup')
      .send({
        companyName: 'Test Compliance Company',
        companyCode: testCompanyCode,
        email: testEmail,
        password: 'Password123!',
        name: 'Test Tenant Owner',
        cin: 'U72200MH2021PTC354000',
        demoCallDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
      });

    const dbUser = await prisma.user.findUnique({
      where: { email: testEmail }
    });
    testCompanyId = dbUser.companyId;
    testUserToken = signupRes.body.token;
  });

  afterAll(async () => {
    // Cleanup the database
    if (testCompanyId) {
      await prisma.permission.deleteMany({ where: { user: { companyId: testCompanyId } } });
      await prisma.user.deleteMany({ where: { companyId: testCompanyId } });
      await prisma.subscription.deleteMany({ where: { companyId: testCompanyId } });
      await prisma.company.delete({ where: { id: testCompanyId } });
    }
    await prisma.$disconnect();
  });

  describe('Gating Restrictions for PENDING KYC Status', () => {
    it('should allow access to Attendance/Leave modules', async () => {
      // Mocking check-in route access. It might fail on other business validations (like employee profile details),
      // but it should NOT fail with a KYC gating error.
      const res = await request(app)
        .post('/api/attendance/check-in')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          employeeId: 'dummy-id',
          timestamp: new Date().toISOString(),
          location: 'Office'
        });
      
      // Since dummy-id doesn't exist, it should return 400 or 403 based on employee lookup,
      // but the KYC gating should let it pass the check (i.e. not returning KYC pending error).
      expect(res.body.error).not.toContain('KYC details are pending verification');
    });

    it('should block access to payroll/finance modules', async () => {
      // Accessing a payroll endpoint
      const res = await request(app)
        .get('/api/payroll/runs')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('KYC not approved. Access restricted to Attendance and Leave modules.');
    });
  });

  describe('Super Admin KYC Approvals & Trial Allocation', () => {
    it('should allow super admin to approve KYC and activate a 30-day Free Trial', async () => {
      const res = await request(app)
        .put(`/api/platform-admin/companies/${testCompanyId}/kyc`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          status: 'APPROVED',
          remarks: 'All director details and CIN verified against registry.'
        });

      expect(res.status).toBe(200);
      expect(res.body.company.kycStatus).toBe('APPROVED');
      expect(res.body.company.hasUsedFreeTrial).toBe(true);

      // Verify that an active subscription has been linked
      const company = await prisma.company.findUnique({
        where: { id: testCompanyId },
        include: { subscriptions: true }
      });
      expect(company.subscriptionId).not.toBeNull();
      
      const activeSub = company.subscriptions.find(s => s.status === 'ACTIVE');
      expect(activeSub).toBeDefined();
      expect(new Date(activeSub.endDate).getTime()).toBeGreaterThan(Date.now());
    });

    it('should not allow another free trial subscription if the company resubmits and is approved again', async () => {
      // 1. Reset status back to PENDING manually to simulate resubmission
      await prisma.company.update({
        where: { id: testCompanyId },
        data: { kycStatus: 'PENDING' }
      });

      // 2. Approve again
      const res = await request(app)
        .put(`/api/platform-admin/companies/${testCompanyId}/kyc`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          status: 'APPROVED',
          remarks: 'Re-approved'
        });

      expect(res.status).toBe(200);
      
      // Should not have created any new subscription since hasUsedFreeTrial is true
      const company = await prisma.company.findUnique({
        where: { id: testCompanyId },
        include: { subscriptions: true }
      });
      
      // It should still have only 1 trial subscription
      const trialSubscriptionsCount = company.subscriptions.filter(s => s.providerSubscriptionId && s.providerSubscriptionId.startsWith('trial_')).length;
      expect(trialSubscriptionsCount).toBe(1);
    });
  });
});
