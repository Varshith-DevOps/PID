const request = require('supertest');
const app = require('../src/index');
const prisma = require('../src/config/database');
const jwt = require('jsonwebtoken');

describe('SSO SAML / OIDC JIT Gateway Tests', () => {
  const existingEmail = 'rajesh.kumar@company.com';
  const jitEmail = 'sso.newuser@company.com';
  const jitName = 'SSO JIT User';

  afterAll(async () => {
    // Clean up JIT user and employee
    const user = await prisma.user.findUnique({ where: { email: jitEmail } });
    if (user) {
      await prisma.employee.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
    await prisma.$disconnect();
  });

  describe('SSO Init Endpoint', () => {
    it('should generate redirect URL to IdP with email login hint', async () => {
      const res = await request(app)
        .post('/api/auth/sso/login')
        .send({ email: existingEmail });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('redirectUrl');
      expect(res.body.redirectUrl).toContain('login_hint=' + encodeURIComponent(existingEmail));
    });
  });

  describe('SSO Callback & JIT Provisioning', () => {
    it('should log in existing user successfully via SSO callback', async () => {
      // Mock OIDC token claims
      const token = jwt.sign(
        { email: existingEmail, name: 'Rajesh Kumar' },
        process.env.JWT_SECRET || 'secret'
      );

      const res = await request(app)
        .post('/api/auth/sso/callback')
        .send({ idToken: token });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toHaveProperty('email', existingEmail);
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('should perform JIT provisioning for a new corporate email', async () => {
      // Mock OIDC token for JIT user
      const token = jwt.sign(
        { email: jitEmail, name: jitName },
        process.env.JWT_SECRET || 'secret'
      );

      // Verify user does not exist yet
      let initialUser = await prisma.user.findUnique({ where: { email: jitEmail } });
      expect(initialUser).toBeNull();

      const res = await request(app)
        .post('/api/auth/sso/callback')
        .send({ idToken: token });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toHaveProperty('email', jitEmail);
      expect(res.body.user).toHaveProperty('name', jitName);

      // Verify user and employee were created in the DB
      const createdUser = await prisma.user.findUnique({
        where: { email: jitEmail },
        include: { employee: true }
      });

      expect(createdUser).not.toBeNull();
      expect(createdUser.employee).not.toBeNull();
      expect(createdUser.employee.firstName).toBe('SSO');
      expect(createdUser.employee.lastName).toBe('JIT User');
    });
  });
});
