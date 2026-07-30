const request = require('supertest');
const app = require('../src/index');
const prisma = require('../src/config/database');

jest.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: jest.fn().mockResolvedValue({
    challenge: 'mock-reg-challenge',
    rp: { name: 'PID HCMS', id: 'localhost' },
    user: { id: 'mock-user-id', name: 'rajesh.kumar@company.com', displayName: 'Rajesh Kumar' }
  }),
  verifyRegistrationResponse: jest.fn().mockResolvedValue({
    verified: true,
    registrationInfo: {
      credentialID: 'mock-credential-id',
      credentialPublicKey: Buffer.from('mock-public-key'),
      counter: 0,
      credentialDeviceType: 'singleDevice',
      credentialBackedUp: true
    }
  }),
  generateAuthenticationOptions: jest.fn().mockResolvedValue({
    challenge: 'mock-auth-challenge',
    allowCredentials: []
  }),
  verifyAuthenticationResponse: jest.fn().mockResolvedValue({
    verified: true,
    authenticationInfo: {
      newCounter: 1
    }
  })
}));

describe('Passkey (WebAuthn) Authentication Flow', () => {
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

    // Login as standard employee to get auth token/cookie
    const empRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'rajesh.kumar@company.com', password: 'employee123' });
    
    employeeToken = empRes.body.token;
    employeeCookie = empRes.headers['set-cookie']?.find(c => c.startsWith('token='));

    user = targetUser;

    // Clean up any existing authenticators for this test user
    await prisma.authenticator.deleteMany({
      where: { userId: user.id }
    });
  });

  afterAll(async () => {
    // Clean up authenticators
    await prisma.authenticator.deleteMany({
      where: { userId: user.id }
    });
    await prisma.$disconnect();
  });

  describe('Passkey Registration', () => {
    it('should reject unauthenticated request for registration options', async () => {
      const res = await request(app)
        .get('/api/auth/webauthn/register/options');
      expect(res.status).toBe(401);
    });

    it('should generate registration options and set challenge cookie for authenticated user', async () => {
      const res = await request(app)
        .get('/api/auth/webauthn/register/options')
        .set('Authorization', `Bearer ${employeeToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('challenge', 'mock-reg-challenge');
      
      const setCookie = res.headers['set-cookie'];
      expect(setCookie.some(c => c.includes('registrationChallenge'))).toBe(true);
    });

    it('should verify registration response and save authenticator to DB', async () => {
      // 1. Get registration options to set the challenge cookie
      const optionsRes = await request(app)
        .get('/api/auth/webauthn/register/options')
        .set('Authorization', `Bearer ${employeeToken}`);
      
      const challengeCookie = optionsRes.headers['set-cookie']?.find(c => c.startsWith('registrationChallenge='));

      // 2. Submit verification payload
      const verifyRes = await request(app)
        .post('/api/auth/webauthn/register/verify')
        .set('Authorization', `Bearer ${employeeToken}`)
        .set('Cookie', [challengeCookie])
        .send({
          id: 'mock-credential-id',
          rawId: 'mock-raw-id',
          type: 'public-key',
          response: {
            clientDataJSON: 'mock-client-data',
            attestationObject: 'mock-attestation',
            transports: ['internal']
          }
        });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body).toHaveProperty('success', true);

      // Verify DB contains the new authenticator record
      const authRecord = await prisma.authenticator.findUnique({
        where: { credentialId: 'mock-credential-id' }
      });
      expect(authRecord).not.toBeNull();
      expect(authRecord.userId).toBe(user.id);
    });
  });

  describe('Passkey Authentication (Login)', () => {
    it('should reject authentication options request if email is missing', async () => {
      const res = await request(app)
        .post('/api/auth/webauthn/login/options')
        .send({});
      expect(res.status).toBe(400);
    });

    it('should generate authentication options and set cookies when email has passkeys', async () => {
      const res = await request(app)
        .post('/api/auth/webauthn/login/options')
        .send({ email: 'rajesh.kumar@company.com' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('challenge', 'mock-auth-challenge');

      const setCookie = res.headers['set-cookie'];
      expect(setCookie.some(c => c.includes('authenticationChallenge'))).toBe(true);
      expect(setCookie.some(c => c.includes('authUserId'))).toBe(true);
    });

    it('should verify authentication response and log user in', async () => {
      // 1. Get options to set challenge and userId cookies
      const optionsRes = await request(app)
        .post('/api/auth/webauthn/login/options')
        .send({ email: 'rajesh.kumar@company.com' });

      const cookies = optionsRes.headers['set-cookie'];
      const challengeCookie = cookies?.find(c => c.startsWith('authenticationChallenge='));
      const userIdCookie = cookies?.find(c => c.startsWith('authUserId='));

      // 2. Submit verify request
      const verifyRes = await request(app)
        .post('/api/auth/webauthn/login/verify')
        .set('Cookie', [challengeCookie, userIdCookie])
        .send({
          id: 'mock-credential-id',
          rawId: 'mock-raw-id',
          type: 'public-key',
          response: {
            clientDataJSON: 'mock-client-data',
            authenticatorData: 'mock-authenticator-data',
            signature: 'mock-signature',
            userHandle: 'mock-user-handle'
          }
        });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body).toHaveProperty('token');
      expect(verifyRes.body.user).toHaveProperty('email', 'rajesh.kumar@company.com');
      
      const authCookie = verifyRes.headers['set-cookie']?.find(c => c.startsWith('token='));
      expect(authCookie).toBeDefined();
    });
  });
});
