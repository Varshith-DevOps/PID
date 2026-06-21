const request = require('supertest');
const app = require('../src/index');
const prisma = require('../src/config/database');

describe('Security Patches & Access Control Tests', () => {
  let employeeToken;
  let adminToken;
  let employeeCookie;
  let adminCookie;
  let targetUserId;

  beforeAll(async () => {
    // Login as standard employee
    const empRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'rajesh.kumar@company.com', password: 'employee123' });
    
    employeeToken = empRes.body.token;
    employeeCookie = empRes.headers['set-cookie']?.find(c => c.startsWith('token='));

    // Login as admin
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@hrms.com', password: 'admin123' });

    adminToken = adminRes.body.token;
    adminCookie = adminRes.headers['set-cookie']?.find(c => c.startsWith('token='));

    // Find another employee/user id for IDOR checks
    const targetUser = await prisma.user.findUnique({
      where: { email: 'priya.sharma@company.com' }
    });
    targetUserId = targetUser.id;
  });

  afterAll(async () => {
    // Disconnect prisma database client to prevent test hanging
    await prisma.$disconnect();
  });

  describe('Phase 1: Registration Endpoint Security', () => {
    it('should reject unauthenticated self-registration', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@company.com',
          password: 'Password123!',
          name: 'New User'
        });
      expect(res.status).toBe(401);
    });

    it('should reject registration request from non-admin role', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          email: 'newuser@company.com',
          password: 'Password123!',
          name: 'New User'
        });
      expect(res.status).toBe(403);
    });

    it('should allow registration from admin, and validate role input', async () => {
      const randomEmail = `user_${Math.floor(Math.random() * 1000000)}@company.com`;
      const res = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: randomEmail,
          password: 'Password123!',
          name: 'New Dev User',
          role: 'INVALID_ROLE'
        });
      expect(res.status).toBe(400); // Invalid role
      expect(res.body.error).toContain('Invalid role');
    });
  });

  describe('Phase 1: Password Reset IDOR', () => {
    it('should reject password reset if caller is not admin', async () => {
      const res = await request(app)
        .put(`/api/auth/reset-password/${targetUserId}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ newPassword: 'NewPassword123!' });
      expect(res.status).toBe(403);
    });

    it('should allow password reset if caller is admin', async () => {
      const res = await request(app)
        .put(`/api/auth/reset-password/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ newPassword: 'NewPassword123!' });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Password reset successfully');
    });
  });

  describe('Phase 1: Buddy Punching Prevention', () => {
    it('should reject attendance punch for another employee', async () => {
      // Find Priya's employee record
      const priyaEmp = await prisma.employee.findUnique({
        where: { email: 'priya.sharma@company.com' }
      });

      const res = await request(app)
        .post('/api/attendance/check-in')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          employeeId: priyaEmp.id,
          timestamp: new Date().toISOString(),
          location: 'Office'
        });
      expect(res.status).toBe(403);
      expect(res.body.error).toContain('You cannot punch attendance for another employee');
    });
  });

  describe('Forced password reset for provisioned accounts', () => {
    let provisionedEmail;

    afterAll(async () => {
      // Clean up records this block created so re-runs stay deterministic.
      // Delete child rows first (Postgres enforces these FKs strictly).
      if (provisionedEmail) {
        const emp = await prisma.employee.findUnique({ where: { email: provisionedEmail } }).catch(() => null);
        if (emp) await prisma.employee.delete({ where: { id: emp.id } }).catch(() => {});
        const u = await prisma.user.findUnique({ where: { email: provisionedEmail } }).catch(() => null);
        if (u) {
          await prisma.permission.deleteMany({ where: { userId: u.id } }).catch(() => {});
          await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
        }
      }
    });

    it('admin reset without a final password issues a strong temp password and forces change', async () => {
      const res = await request(app)
        .put(`/api/auth/reset-password/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(200);
      const temp = res.body.temporaryPassword;
      expect(typeof temp).toBe('string');
      expect(temp).not.toBe('employee123');
      expect(temp.length).toBeGreaterThanOrEqual(12);

      const user = await prisma.user.findUnique({ where: { id: targetUserId } });
      expect(user.mustChangePassword).toBe(true);

      // The temp password works and the login payload signals the forced change.
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: 'priya.sharma@company.com', password: temp });
      expect(login.status).toBe(200);
      expect(login.body.user.mustChangePassword).toBe(true);
    });

    it('newly provisioned employee account requires a password change and has no static default', async () => {
      const dept = await prisma.department.findFirst();
      const email = `provisioned_${Math.floor(Math.random() * 1000000)}@company.com`;
      provisionedEmail = email;
      const res = await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'Prov',
          lastName: 'Isioned',
          email,
          jobTitle: 'Analyst',
          departmentId: dept?.id,
          salary: 500000,
        });
      expect(res.status).toBe(201);
      expect(res.body.temporaryPassword).toBeDefined();
      expect(res.body.temporaryPassword).not.toBe('employee123');

      const user = await prisma.user.findUnique({ where: { email } });
      expect(user.mustChangePassword).toBe(true);

      // Old shared default must no longer work.
      const badLogin = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'employee123' });
      expect(badLogin.status).toBe(401);
    });
  });

  describe('Phase 3: HttpOnly Cookies', () => {
    it('should set HttpOnly token cookie on successful login', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'rajesh.kumar@company.com', password: 'employee123' });
      
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const tokenCookie = cookies.find(c => c.startsWith('token='));
      expect(tokenCookie).toBeDefined();
      expect(tokenCookie).toContain('HttpOnly');
    });
  });

  describe('Token revocation on logout', () => {
    it('rejects a previously valid token after logout (server-side revocation)', async () => {
      // Fresh, self-contained session so we do not disturb other suites' tokens.
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@hrms.com', password: 'admin123' });
      const token = login.body.token;

      const before = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`);
      expect(before.status).toBe(200);

      const out = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);
      expect(out.status).toBe(200);

      const after = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`);
      expect(after.status).toBe(401);
    });
  });
});
