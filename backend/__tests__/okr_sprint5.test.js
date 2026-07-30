const request = require('supertest');
const app = require('../src/index');
const prisma = require('../src/config/database');

describe('OKR Tree & Dynamic Recalculation (Sprint 5)', () => {
  let employeeToken;
  let employee;
  let objective;

  beforeAll(async () => {
    // Clear login logs to bypass geo-velocity check
    const user = await prisma.user.findFirst({ where: { email: 'rajesh.kumar@company.com' } });
    if (user) {
      await prisma.auditLog.deleteMany({
        where: {
          userId: user.id,
          action: { in: ['AUTH_LOGIN_SUCCESS', 'AUTH_PASSKEY_LOGIN_SUCCESS', 'AUTH_SSO_LOGIN_SUCCESS', 'AUTH_LOGIN_ANOMALOUS_GEO_VELOCITY'] }
        }
      });
    }

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'rajesh.kumar@company.com', password: 'employee123' });
    employeeToken = loginRes.body.token;

    employee = await prisma.employee.findFirst({ where: { email: 'rajesh.kumar@company.com' } });

    // Clean up past OKR structures for this employee
    await prisma.keyResult.deleteMany({
      where: { objective: { employeeId: employee.id } }
    });
    await prisma.objective.deleteMany({
      where: { employeeId: employee.id }
    });
  });

  afterAll(async () => {
    await prisma.keyResult.deleteMany({
      where: { objective: { employeeId: employee.id } }
    });
    await prisma.objective.deleteMany({
      where: { employeeId: employee.id }
    });
    await prisma.$disconnect();
  });

  describe('OKR Operations', () => {
    it('should create an objective successfully', async () => {
      const res = await request(app)
        .post('/api/okrs/objectives')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          title: 'Upgrade System Throughput',
          description: 'Improve backend load speeds and connection stability',
          startDate: '2026-08-01',
          endDate: '2026-10-31'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('title', 'Upgrade System Throughput');
      expect(res.body.progress).toBe(0.0);
      objective = res.body;
    });

    it('should add Key Results and recalculate objective progress', async () => {
      // KR 1: Reduce response latency from 500ms (start) to 200ms (target). Weight = 2
      const res1 = await request(app)
        .post('/api/okrs/key-results')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          objectiveId: objective.id,
          title: 'Reduce response latency',
          startValue: 500,
          targetValue: 200,
          currentValue: 500,
          unit: 'ms',
          weight: 2
        });
      expect(res1.status).toBe(201);

      // KR 2: Increase connection pool count from 2 (start) to 10 (target). Weight = 1
      const res2 = await request(app)
        .post('/api/okrs/key-results')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          objectiveId: objective.id,
          title: 'Increase connection pool count',
          startValue: 2,
          targetValue: 10,
          currentValue: 2,
          unit: 'pools',
          weight: 1
        });
      expect(res2.status).toBe(201);

      // Parent objective progress should still be 0 since currentValue = startValue
      const obj = await prisma.objective.findUnique({ where: { id: objective.id } });
      expect(obj.progress).toBe(0.0);
    });

    it('should dynamically update objective progress when a Key Result currentValue is modified', async () => {
      // Find the first Key Result (Reduce latency)
      const latencyKr = await prisma.keyResult.findFirst({
        where: { objectiveId: objective.id, title: 'Reduce response latency' }
      });

      // Update currentValue to 350ms (Halfway to 200ms target). Progress = 50%
      // Since weight is 2 and the other KR is at 0% (weight 1), total progress = (0.5 * 2 + 0.0 * 1) / 3 = 33.33%
      const res = await request(app)
        .put(`/api/okrs/key-results/${latencyKr.id}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          currentValue: 350
        });

      expect(res.status).toBe(200);
      expect(res.body.currentValue).toBe(350);

      const obj = await prisma.objective.findUnique({ where: { id: objective.id } });
      expect(obj.progress).toBeCloseTo(33.33, 1);
    });

    it('should successfully retrieve hierarchical objective tree', async () => {
      const res = await request(app)
        .get('/api/okrs/employee')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].keyResults.length).toBe(2);
    });
  });
});
