const request = require('supertest');
const app = require('../src/index');
const prisma = require('../src/config/database');

describe('Enterprise Access Control Hardening', () => {
  let employeeToken;
  let adminToken;

  beforeAll(async () => {
    const empRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'rajesh.kumar@company.com', password: 'employee123' });
    employeeToken = empRes.body.token;

    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@hrms.com', password: 'admin123' });
    adminToken = adminRes.body.token;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('enriches authenticated profile responses with linked employee id', async () => {
    const res = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.employeeId).toBeTruthy();
  });

  it('allows employees to create their own expense claims through default EXPENSES grants', async () => {
    const res = await request(app)
      .post('/api/expenses/claims')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        title: 'Local travel reimbursement',
        category: 'TRAVEL',
        amount: 250,
        description: 'Regression test claim for employee self-service access',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('employeeId');
    expect(res.body.status).toBe('PENDING');
  });

  it('blocks employees from finance-approving expense claims', async () => {
    const claim = await prisma.expenseClaim.findFirst();

    const res = await request(app)
      .put(`/api/expenses/claims/${claim.id}/finance-approve`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ remarks: 'Should not be allowed', markAsPaid: true });

    expect(res.status).toBe(403);
  });

  it('requires REPORTS.EXPORT permission for report exports', async () => {
    const employeeRes = await request(app)
      .post('/api/reports/export')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ reportType: 'general' });

    expect(employeeRes.status).toBe(403);

    const adminRes = await request(app)
      .post('/api/reports/export')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reportType: 'general' });

    expect(adminRes.status).toBe(200);
  });
});
