const request = require('supertest');
const app = require('../src/index');
const prisma = require('../src/config/database');

describe('Asset Request Workflow (Sprint 6)', () => {
  let employeeToken;
  let adminToken;
  let employee;

  beforeAll(async () => {
    // Clear login logs to bypass geo-velocity check
    const users = ['rajesh.kumar@company.com', 'admin@hrms.com'];
    for (const email of users) {
      const user = await prisma.user.findFirst({ where: { email } });
      if (user) {
        await prisma.auditLog.deleteMany({
          where: {
            userId: user.id,
            action: { in: ['AUTH_LOGIN_SUCCESS', 'AUTH_PASSKEY_LOGIN_SUCCESS', 'AUTH_SSO_LOGIN_SUCCESS', 'AUTH_LOGIN_ANOMALOUS_GEO_VELOCITY'] }
          }
        });
      }
    }

    const empLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'rajesh.kumar@company.com', password: 'employee123' });
    employeeToken = empLogin.body.token;

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@hrms.com', password: 'admin123' });
    adminToken = adminLogin.body.token;

    employee = await prisma.employee.findFirst({ where: { email: 'rajesh.kumar@company.com' } });

    // Clean up past asset requests for this employee
    await prisma.assetRequest.deleteMany({ where: { employeeId: employee.id } });
  });

  afterAll(async () => {
    await prisma.assetRequest.deleteMany({ where: { employeeId: employee.id } });
    // Delete any assets assigned to this employee during the auto-allocation test
    await prisma.asset.deleteMany({ where: { assignedToId: employee.id } });
    await prisma.$disconnect();
  });

  let createdRequestId;

  describe('Employee Asset Requests', () => {
    it('should allow an employee to submit an asset request', async () => {
      const res = await request(app)
        .post('/api/assets/requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          assetType: 'LAPTOP',
          reason: 'Current laptop is 5 years old and severely degraded in performance.'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('assetType', 'LAPTOP');
      expect(res.body).toHaveProperty('status', 'PENDING');
      createdRequestId = res.body.id;
    });

    it('should list employee asset requests', async () => {
      const res = await request(app)
        .get('/api/assets/requests/employee')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0]).toHaveProperty('assetType', 'LAPTOP');
    });
  });

  describe('Admin Asset Approval', () => {
    it('should list pending requests in admin view along with available assets', async () => {
      const res = await request(app)
        .get('/api/assets/requests/admin')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('requests');
      expect(res.body).toHaveProperty('availableAssets');
      expect(res.body.requests.length).toBeGreaterThanOrEqual(1);
    });

    it('should approve an asset request and auto-allocate', async () => {
      const res = await request(app)
        .put(`/api/assets/requests/${createdRequestId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reviewerComments: 'Approved. New Dell Latitude allocated.'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'APPROVED');
      expect(res.body).toHaveProperty('assetId');
      expect(res.body.reviewerComments).toBe('Approved. New Dell Latitude allocated.');
    });

    it('should reject an asset request with reviewer comments', async () => {
      // Create another request to reject
      const createRes = await request(app)
        .post('/api/assets/requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          assetType: 'MONITOR',
          reason: 'Want a second monitor for dual display setup.'
        });

      const res = await request(app)
        .put(`/api/assets/requests/${createRes.body.id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reviewerComments: 'Budget not available for monitor requests this quarter.'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'REJECTED');
      expect(res.body.reviewerComments).toBe('Budget not available for monitor requests this quarter.');
    });
  });
});
