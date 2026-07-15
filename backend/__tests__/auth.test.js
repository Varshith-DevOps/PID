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

  describe('Employee deactivation safety', () => {
    let lifecycleEmail;
    let lifecycleEmployeeId;
    let lifecycleTempPassword;

    afterAll(async () => {
      if (!lifecycleEmail) return;
      const emp = await prisma.employee.findUnique({ where: { email: lifecycleEmail }, include: { user: true } }).catch(() => null);
      if (emp) {
        await prisma.auditLog.deleteMany({ where: { entity: 'EMPLOYEE', entityId: emp.id } }).catch(() => {});
        await prisma.changeHistory.deleteMany({ where: { employeeId: emp.id } }).catch(() => {});
        await prisma.leave.deleteMany({ where: { employeeId: emp.id } }).catch(() => {});
        await prisma.employee.delete({ where: { id: emp.id } }).catch(() => {});
      }
      if (emp?.userId) {
        await prisma.permission.deleteMany({ where: { userId: emp.userId } }).catch(() => {});
        await prisma.auditLog.deleteMany({ where: { userId: emp.userId } }).catch(() => {});
        await prisma.user.delete({ where: { id: emp.userId } }).catch(() => {});
      }
    });

    it('deactivates without deleting history, blocks login, and supports reactivation', async () => {
      const dept = await prisma.department.findFirst();
      lifecycleEmail = `deactivate_${Date.now()}@company.com`;
      const created = await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'Deactivate',
          lastName: 'Safety',
          email: lifecycleEmail,
          jobTitle: 'QA Analyst',
          departmentId: dept?.id,
          salary: 50000,
        });
      expect(created.status).toBe(201);
      lifecycleEmployeeId = created.body.id;
      lifecycleTempPassword = created.body.temporaryPassword;

      const leave = await prisma.leave.create({
        data: {
          employeeId: lifecycleEmployeeId,
          leaveType: 'ANNUAL',
          startDate: new Date('2099-04-01'),
          endDate: new Date('2099-04-01'),
          days: 1,
          reason: 'Historical record',
          status: 'APPROVED',
        },
      });

      const missingReason = await request(app)
        .patch(`/api/employees/${lifecycleEmployeeId}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ effectiveDate: '2099-04-30', confirmation: 'DEACTIVATE' });
      expect(missingReason.status).toBe(400);

      const deactivated = await request(app)
        .patch(`/api/employees/${lifecycleEmployeeId}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'RESIGNED',
          effectiveDate: '2099-04-30',
          remarks: 'Completed handover.',
          confirmation: 'DEACTIVATE',
        });
      expect(deactivated.status).toBe(200);
      expect(deactivated.body.message).toBe('Employee deactivated successfully.');
      expect(deactivated.body.employee.isActive).toBe(false);
      expect(deactivated.body.employee.deactivationReason).toBe('RESIGNED');

      const stored = await prisma.employee.findUnique({ where: { id: lifecycleEmployeeId }, include: { user: true, leaves: true } });
      expect(stored.isActive).toBe(false);
      expect(stored.user.isActive).toBe(false);
      expect(stored.leaves.some((item) => item.id === leave.id)).toBe(true);

      const activeList = await request(app)
        .get('/api/employees')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(activeList.body.employees.some((emp) => emp.id === lifecycleEmployeeId)).toBe(false);

      const inactiveList = await request(app)
        .get('/api/employees?status=inactive')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(inactiveList.body.employees.some((emp) => emp.id === lifecycleEmployeeId)).toBe(true);

      const blockedLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: lifecycleEmail, password: lifecycleTempPassword });
      expect(blockedLogin.status).toBe(403);
      expect(blockedLogin.body.error).toBe('Your account has been deactivated. Contact HR.');

      const blockedLeave = await request(app)
        .post('/api/leave')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          employeeId: lifecycleEmployeeId,
          leaveType: 'ANNUAL',
          startDate: '2099-05-01',
          endDate: '2099-05-01',
          reason: 'Should fail',
        });
      expect(blockedLeave.status).toBe(403);

      const audit = await prisma.auditLog.findFirst({
        where: { action: 'EMPLOYEE_DEACTIVATED', entity: 'EMPLOYEE', entityId: lifecycleEmployeeId },
      });
      expect(audit).toBeTruthy();

      const reactivated = await request(app)
        .patch(`/api/employees/${lifecycleEmployeeId}/reactivate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ remarks: 'Employee rejoined.' });
      expect(reactivated.status).toBe(200);
      expect(reactivated.body.message).toBe('Employee reactivated successfully.');
      expect(reactivated.body.employee.isActive).toBe(true);

      const restored = await prisma.employee.findUnique({ where: { id: lifecycleEmployeeId }, include: { user: true } });
      expect(restored.isActive).toBe(true);
      expect(restored.user.isActive).toBe(true);
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
