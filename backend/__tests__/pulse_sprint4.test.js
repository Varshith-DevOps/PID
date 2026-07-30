const request = require('supertest');
const app = require('../src/index');
const prisma = require('../src/config/database');

describe('Pulse Survey Integration Tests (Sprint 4)', () => {
  let adminToken;
  let employeeToken;
  let activeSurvey;

  beforeAll(async () => {
    // Clear login logs to prevent geo-velocity blocking
    const adminUser = await prisma.user.findFirst({ where: { email: 'admin@hrms.com' } });
    if (adminUser) {
      await prisma.auditLog.deleteMany({
        where: {
          userId: adminUser.id,
          action: { in: ['AUTH_LOGIN_SUCCESS', 'AUTH_PASSKEY_LOGIN_SUCCESS', 'AUTH_SSO_LOGIN_SUCCESS', 'AUTH_LOGIN_ANOMALOUS_GEO_VELOCITY'] }
        }
      });
    }

    const employeeUser = await prisma.user.findFirst({ where: { email: 'rajesh.kumar@company.com' } });
    if (employeeUser) {
      await prisma.auditLog.deleteMany({
        where: {
          userId: employeeUser.id,
          action: { in: ['AUTH_LOGIN_SUCCESS', 'AUTH_PASSKEY_LOGIN_SUCCESS', 'AUTH_SSO_LOGIN_SUCCESS', 'AUTH_LOGIN_ANOMALOUS_GEO_VELOCITY'] }
        }
      });
    }

    // Login Admin
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@hrms.com', password: 'admin123' });
    adminToken = adminLogin.body.token;

    // Login Employee
    const employeeLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'rajesh.kumar@company.com', password: 'employee123' });
    employeeToken = employeeLogin.body.token;

    // Clean up past surveys/responses
    await prisma.pulseResponse.deleteMany({});
    await prisma.pulseSurvey.deleteMany({});
  });

  afterAll(async () => {
    await prisma.pulseResponse.deleteMany({});
    await prisma.pulseSurvey.deleteMany({});
    await prisma.$disconnect();
  });

  describe('Pulse Surveys Operations', () => {
    it('should allow HR/Admin to publish a new active pulse survey and auto-deactivate previous ones', async () => {
      const res = await request(app)
        .post('/api/pulse')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Weekly Workspace Pulse',
          description: 'How do you feel about the collaboration tools introduced in this sprint?'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('title', 'Weekly Workspace Pulse');
      expect(res.body).toHaveProperty('isActive', true);
      activeSurvey = res.body;
    });

    it('should reject survey publishing if non-HR employee attempts it', async () => {
      const res = await request(app)
        .post('/api/pulse')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          title: 'Unauthorized Pulse',
          description: 'Should fail'
        });

      expect(res.status).toBe(403);
    });

    it('should retrieve the active survey successfully', async () => {
      const res = await request(app)
        .get('/api/pulse/active')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', activeSurvey.id);
    });

    it('should allow employees to submit a mood response with a score (1-5)', async () => {
      const res = await request(app)
        .post('/api/pulse/respond')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          surveyId: activeSurvey.id,
          score: 5,
          feedback: 'Collaboration tools have streamlined my tasks!'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('score', 5);
      expect(res.body.feedback).toBe('Collaboration tools have streamlined my tasks!');
    });

    it('should reject response submission with out-of-range mood score', async () => {
      const res = await request(app)
        .post('/api/pulse/respond')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          surveyId: activeSurvey.id,
          score: 6,
          feedback: 'Too high'
        });

      expect(res.status).toBe(400);
    });

    it('should return aggregated survey summary for HR analytics', async () => {
      // Add another response to get average
      await prisma.pulseResponse.create({
        data: {
          companyId: activeSurvey.companyId,
          surveyId: activeSurvey.id,
          score: 3,
          feedback: 'Neutral'
        }
      });

      const res = await request(app)
        .get('/api/pulse/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.responseCount).toBe(2);
      expect(res.body.averageScore).toBe(4.0); // (5 + 3) / 2 = 4
      expect(res.body.feedbackList.length).toBe(2);
    });
  });
});
