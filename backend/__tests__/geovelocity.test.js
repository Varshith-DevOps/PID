const request = require('supertest');
const app = require('../src/index');
const prisma = require('../src/config/database');

describe('Anomalous Login Geo-Velocity Checks', () => {
  const email = 'rajesh.kumar@company.com';
  const password = 'employee123';
  let user;

  beforeAll(async () => {
    user = await prisma.user.findUnique({
      where: { email }
    });
  });

  beforeEach(async () => {
    // Clear audit logs of logins for this user to start with a fresh state
    await prisma.auditLog.deleteMany({
      where: {
        userId: user.id,
        action: { in: ['AUTH_LOGIN_SUCCESS', 'AUTH_PASSKEY_LOGIN_SUCCESS', 'AUTH_SSO_LOGIN_SUCCESS', 'AUTH_LOGIN_ANOMALOUS_GEO_VELOCITY'] }
      }
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should allow normal login from a local IP', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '127.0.0.1')
      .send({ email, password });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  it('should block subsequent login from a distant IP (Delhi) within 1 second', async () => {
    // 1. First login from Bangalore (local IP)
    const firstRes = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '127.0.0.1')
      .send({ email, password });
    
    expect(firstRes.status).toBe(200);

    // 2. Immediate second login from Delhi (12.34.56.78)
    const secondRes = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '12.34.56.78')
      .send({ email, password });

    // Bangalore to Delhi is ~1700 km, speed is > 100000 km/h, which is impossible
    expect(secondRes.status).toBe(403);
    expect(secondRes.body).toHaveProperty('error');
    expect(secondRes.body.error).toContain('Anomalous login detected');

    // Verify a security log was recorded in the database
    const alertLog = await prisma.auditLog.findFirst({
      where: {
        userId: user.id,
        action: 'AUTH_LOGIN_ANOMALOUS_GEO_VELOCITY'
      }
    });
    expect(alertLog).not.toBeNull();
    expect(alertLog.ipAddress).toBe('12.34.56.78');
    
    const details = JSON.parse(alertLog.newDetails);
    expect(details.prevIp).toBe('127.0.0.1');
    expect(details.currentIp).toBe('12.34.56.78');
  });

  it('should allow login from a distant IP if sufficient time has elapsed (e.g. 5 hours)', async () => {
    // 1. First login from Bangalore (local IP)
    const firstRes = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '127.0.0.1')
      .send({ email, password });
    
    expect(firstRes.status).toBe(200);

    // Get the created log and fake the timestamp to be 5 hours ago
    const successLog = await prisma.auditLog.findFirst({
      where: {
        userId: user.id,
        action: 'AUTH_LOGIN_SUCCESS'
      },
      orderBy: { createdAt: 'desc' }
    });

    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
    await prisma.auditLog.update({
      where: { id: successLog.id },
      data: { createdAt: fiveHoursAgo }
    });

    // 2. Second login from Delhi (12.34.56.78)
    const secondRes = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '12.34.56.78')
      .send({ email, password });

    // Bangalore to Delhi is ~1700 km, over 5 hours the speed is ~340 km/h, which is possible on a flight
    expect(secondRes.status).toBe(200);
    expect(secondRes.body).toHaveProperty('token');
  });
});
