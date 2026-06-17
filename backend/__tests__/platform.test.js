const request = require('supertest');
const app = require('../src/index');
const prisma = require('../src/config/database');

describe('Platform Architecture Layer', () => {
  let adminToken;
  const suffix = `${Date.now()}`.slice(-6);

  beforeAll(async () => {
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@hrms.com', password: 'admin123' });
    adminToken = adminRes.body.token;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('bootstraps platform policy, workflow and compliance foundations', async () => {
    const bootstrap = await request(app)
      .post('/api/platform/bootstrap')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(bootstrap.status).toBe(201);
    expect(bootstrap.body.company).toBeDefined();

    const overview = await request(app)
      .get('/api/platform/overview')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(overview.status).toBe(200);
    expect(overview.body.readinessScore).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(overview.body.policies)).toBe(true);
  });

  it('creates organization, compliance, integration and workflow records', async () => {
    const entity = await request(app)
      .post('/api/platform/organization/legal-entities')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Test Entity ${suffix}`,
        code: `TE${suffix}`,
        state: 'Karnataka',
        pan: 'ABCDE1234F',
        tan: 'BLRT12345A',
      });

    expect(entity.status).toBe(201);

    const calendar = await request(app)
      .post('/api/platform/compliance/calendar')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ month: 6, year: 2026, legalEntityId: entity.body.id });

    expect(calendar.status).toBe(201);
    expect(calendar.body.createdCount).toBeGreaterThan(0);

    const integration = await request(app)
      .post('/api/platform/integrations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        displayName: `Biometric Test ${suffix}`,
        provider: 'BIOMETRIC',
        category: 'ATTENDANCE',
        status: 'ACTIVE',
        config: { endpoint: 'https://example.invalid', mode: 'API' },
      });

    expect(integration.status).toBe(201);

    const tested = await request(app)
      .post(`/api/platform/integrations/${integration.body.id}/test`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(tested.status).toBe(200);
    expect(tested.body.lastSyncStatus).toBe('TESTED');

    const workflow = await request(app)
      .post('/api/platform/workflows/start')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        module: 'PAYROLL',
        entityType: 'PayrollRun',
        entityId: `test-run-${suffix}`,
        title: `Payroll close test ${suffix}`,
        triggerEvent: 'PAYROLL_RUN_CREATED',
        context: { employeeCount: 250 },
      });

    expect(workflow.status).toBe(201);
    expect(workflow.body.tasks.length).toBeGreaterThan(0);

    const inbox = await request(app)
      .get('/api/platform/approvals/inbox')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(inbox.status).toBe(200);
    expect(inbox.body.some((task) => task.instance?.entityId === `test-run-${suffix}`)).toBe(true);
  });
});
