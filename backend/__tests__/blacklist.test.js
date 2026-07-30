const request = require('supertest');
const app = require('../src/index');
const prisma = require('../src/config/database');
const jwt = require('jsonwebtoken');
const { isTokenBlacklisted } = require('../src/utils/tokenBlacklist');

describe('JWT Blacklist & Sliding Expiration Tests', () => {
  let employeeToken;
  let employeeCookie;
  let user;

  beforeAll(async () => {
    // Clear login audit logs to prevent geo-velocity blocks from prior test suites
    const targetUser = await prisma.user.findUnique({ where: { email: 'rajesh.kumar@company.com' } });
    if (targetUser) {
      await prisma.auditLog.deleteMany({
        where: {
          userId: targetUser.id,
          action: { in: ['AUTH_LOGIN_SUCCESS', 'AUTH_PASSKEY_LOGIN_SUCCESS', 'AUTH_SSO_LOGIN_SUCCESS', 'AUTH_LOGIN_ANOMALOUS_GEO_VELOCITY'] }
        }
      });
    }

    // Login to get standard token
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'rajesh.kumar@company.com', password: 'employee123' });
    
    employeeToken = res.body.token;
    employeeCookie = res.headers['set-cookie']?.find(c => c.startsWith('token='));

    user = targetUser;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Token Blacklist & Logout Revocation', () => {
    it('should allow access to profile with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${employeeToken}`);
      expect(res.status).toBe(200);
      expect(res.body.email).toBe('rajesh.kumar@company.com');
    });

    it('should blacklist the token and return success on logout', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${employeeToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Logged out successfully');

      // Verify the token is blacklisted in our utility
      const blacklisted = await isTokenBlacklisted(employeeToken);
      expect(blacklisted).toBe(true);
    });

    it('should reject access to profile using the blacklisted token', async () => {
      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${employeeToken}`);
      expect(res.status).toBe(401);
    });
  });

  describe('Sliding Expiration Logic', () => {
    it('should issue a new refreshed token if the current token has < 15 minutes remaining', async () => {
      // Refresh user info to get the updated tokenVersion incremented during logout test
      const freshUser = await prisma.user.findUnique({ where: { id: user.id } });
      const nowSeconds = Math.floor(Date.now() / 1000);
      const expiringToken = jwt.sign(
        {
          id: freshUser.id,
          email: freshUser.email,
          role: freshUser.role,
          purpose: 'ACCESS',
          tv: freshUser.tokenVersion ?? 0,
          iat: nowSeconds - 1500, // issued 25 mins ago
          exp: nowSeconds + 300   // expires in 5 mins
        },
        process.env.JWT_SECRET
      );

      // 2. Call profile route with this expiring token
      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${expiringToken}`);

      expect(res.status).toBe(200);
      
      // 3. Confirm that the sliding expiration triggered
      expect(res.headers).toHaveProperty('x-new-token');
      const newToken = res.headers['x-new-token'];
      expect(newToken).not.toBe(expiringToken);

      const decodedNew = jwt.decode(newToken);
      // New token should have default TTL expiration (typically 30m or 1h)
      expect(decodedNew.exp - nowSeconds).toBeGreaterThan(900);
    });

    it('should NOT refresh the token if it has plenty of time remaining (e.g. > 15 minutes)', async () => {
      const freshUser = await prisma.user.findUnique({ where: { id: user.id } });
      const nowSeconds = Math.floor(Date.now() / 1000);
      const longLivedToken = jwt.sign(
        {
          id: freshUser.id,
          email: freshUser.email,
          role: freshUser.role,
          purpose: 'ACCESS',
          tv: freshUser.tokenVersion ?? 0,
          iat: nowSeconds,
          exp: nowSeconds + 3600 // 1 hour remaining
        },
        process.env.JWT_SECRET
      );

      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${longLivedToken}`);

      expect(res.status).toBe(200);
      expect(res.headers).not.toHaveProperty('x-new-token');
    });
  });
});
