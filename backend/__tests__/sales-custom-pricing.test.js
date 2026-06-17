const request = require('supertest');
const app = require('../src/index');
const prisma = require('../src/config/database');

describe('Sales Representative & Custom Plan Integration', () => {
  let adminToken;
  let employeeToken;
  let salesToken;
  let targetCompanyId;
  const suffix = `${Date.now()}`.slice(-6);
  const salesEmail = `sales_${suffix}@company.com`;

  beforeAll(async () => {
    // 1. Login as standard admin
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@hrms.com', password: 'admin123' });
    adminToken = adminRes.body.token;

    // 2. Register a new SALES user (role validation check)
    const registerRes = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: salesEmail,
        password: 'Password123!',
        name: 'Sales Rep',
        role: 'SALES'
      });
    expect(registerRes.status).toBe(201);
    expect(registerRes.body.user.role).toBe('SALES');

    // 3. Login as the new SALES user
    const salesLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: salesEmail, password: 'Password123!' });
    salesToken = salesLoginRes.body.token;

    // 4. Login as standard employee
    const empRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'rajesh.kumar@company.com', password: 'employee123' });
    employeeToken = empRes.body.token;

    // 5. Get a target company id (tenant)
    const firstCompany = await prisma.company.findFirst();
    targetCompanyId = firstCompany.id;
  });

  afterAll(async () => {
    // Clean up created user
    await prisma.user.delete({ where: { email: salesEmail } }).catch(() => {});
    await prisma.$disconnect();
  });

  it('allows SALES role to fetch platform companies', async () => {
    const res = await request(app)
      .get('/api/platform-admin/companies')
      .set('Authorization', `Bearer ${salesToken}`);
    
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('blocks standard EMPLOYEE from fetching platform companies', async () => {
    const res = await request(app)
      .get('/api/platform-admin/companies')
      .set('Authorization', `Bearer ${employeeToken}`);
    
    expect(res.status).toBe(403);
  });

  it('allows SALES to assign a custom pricing subscription to a tenant company', async () => {
    const customFeatures = {
      coreHR: true,
      attendance: false,
      leave: false,
      payroll: false,
      performance: true,
      learning: false,
      helpdesk: false,
      aiAgents: false,
      customWorkflows: false,
      apiAccess: false
    };

    const res = await request(app)
      .post(`/api/platform-admin/companies/${targetCompanyId}/custom-plan`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        name: `Custom Enterprise Tier ${suffix}`,
        description: 'Specially negotiated sales contract',
        price: 25000,
        employeeLimit: 250,
        durationDays: 60,
        featureLimits: customFeatures
      });

    expect(res.status).toBe(200);
    expect(res.body.subscription).toBeDefined();
    expect(res.body.subscription.status).toBe('ACTIVE');
    expect(res.body.subscription.plan.price).toBe(25000);
    expect(res.body.subscription.plan.employeeLimit).toBe(250);
  });

  it('prohibits standard EMPLOYEE from assigning custom pricing plan', async () => {
    const res = await request(app)
      .post(`/api/platform-admin/companies/${targetCompanyId}/custom-plan`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        name: 'Sneaky Hack Plan',
        price: 0,
        employeeLimit: 9999,
        featureLimits: {}
      });

    expect(res.status).toBe(403);
  });

  it('returns custom subscription features on user profile/login payloads', async () => {
    // Log in as the admin user (who belongs to the target company)
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@hrms.com', password: 'admin123' });

    expect(res.status).toBe(200);
    expect(res.body.user.subscriptionFeatures).toBeDefined();
    expect(res.body.user.subscriptionFeatures.coreHR).toBe(true);
    expect(res.body.user.subscriptionFeatures.attendance).toBe(false); // custom disabled
  });
});
