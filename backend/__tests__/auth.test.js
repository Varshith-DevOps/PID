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
});
