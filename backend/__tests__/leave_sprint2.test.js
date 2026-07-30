const request = require('supertest');
const app = require('../src/index');
const prisma = require('../src/config/database');

describe('Leave Date Controls & Collision Warnings Tests', () => {
  let employeeToken;
  let employee;
  let otherEmployee;
  let company;
  let hrToken;
  let tempDept;
  let originalDeptId;

  beforeAll(async () => {
    // Get employee details
    employee = await prisma.employee.findFirst({
      where: { email: 'rajesh.kumar@company.com' }
    });

    company = await prisma.company.findUnique({
      where: { id: employee.companyId }
    });

    // Clear login audit logs to avoid anomalous geo-velocity blocks from prior tests
    await prisma.auditLog.deleteMany({
      where: {
        userId: employee.userId,
        action: { in: ['AUTH_LOGIN_SUCCESS', 'AUTH_PASSKEY_LOGIN_SUCCESS', 'AUTH_SSO_LOGIN_SUCCESS', 'AUTH_LOGIN_ANOMALOUS_GEO_VELOCITY'] }
      }
    });

    // Clear login audit logs for the admin user as well
    const hrUser = await prisma.user.findUnique({ where: { email: 'owner@company.com' } });
    if (hrUser) {
      await prisma.auditLog.deleteMany({
        where: {
          userId: hrUser.id,
          action: { in: ['AUTH_LOGIN_SUCCESS', 'AUTH_PASSKEY_LOGIN_SUCCESS', 'AUTH_SSO_LOGIN_SUCCESS', 'AUTH_LOGIN_ANOMALOUS_GEO_VELOCITY'] }
        }
      });
    }

    // Log in as employee
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'rajesh.kumar@company.com', password: 'employee123' });
    employeeToken = loginRes.body.token;

    // Log in as admin/HR
    const hrLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'owner@company.com', password: 'password123' });
    hrToken = hrLoginRes.body.token;

    // Create a temporary department to control the exact active employee count (2 employees)
    tempDept = await prisma.department.create({
      data: {
        name: 'Collision-Testing-Dept',
        companyId: company.id
      }
    });

    originalDeptId = employee.departmentId;

    // Move our test employee to this temporary department
    await prisma.employee.update({
      where: { id: employee.id },
      data: { departmentId: tempDept.id }
    });

    // Create a second active employee in this temporary department
    await prisma.employee.deleteMany({
      where: { email: 'test.colleague@company.com' }
    });

    const userColleague = await prisma.user.create({
      data: {
        email: 'test.colleague@company.com',
        name: 'Test Colleague',
        password: 'Password123!',
        role: 'EMPLOYEE',
        companyId: company.id
      }
    });

    otherEmployee = await prisma.employee.create({
      data: {
        employeeId: 'EMPCOL-888',
        firstName: 'Test',
        lastName: 'Colleague',
        email: 'test.colleague@company.com',
        jobTitle: 'Developer',
        departmentId: tempDept.id,
        companyId: company.id,
        salary: 20000,
        userId: userColleague.id,
        isActive: true
      }
    });
  });

  beforeEach(async () => {
    // Clean up leaves for test employees to prevent test interference
    await prisma.leave.deleteMany({
      where: { employeeId: { in: [employee.id, otherEmployee.id] } }
    });
  });

  afterAll(async () => {
    await prisma.leave.deleteMany({
      where: { employeeId: { in: [employee.id, otherEmployee.id] } }
    });

    // Move test employee back to original department
    if (employee && originalDeptId) {
      await prisma.employee.update({
        where: { id: employee.id },
        data: { departmentId: originalDeptId }
      });
    }

    await prisma.employee.deleteMany({
      where: { id: otherEmployee.id }
    });
    await prisma.user.deleteMany({
      where: { email: 'test.colleague@company.com' }
    });

    // Delete temporary department
    if (tempDept) {
      await prisma.department.delete({
        where: { id: tempDept.id }
      });
    }

    await prisma.$disconnect();
  });

  describe('Leave Request Chronology Validation', () => {
    it('should reject leave request if endDate is before startDate', async () => {
      const res = await request(app)
        .post('/api/leave')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          employeeId: employee.id,
          leaveType: 'CASUAL',
          startDate: '2026-10-15',
          endDate: '2026-10-10',
          reason: 'Holiday'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('End date cannot be before start date');
    });
  });

  describe('Leave Balance safeguards', () => {
    it('should reject leave request if requested days exceed available balance', async () => {
      // SICK has a default quota of 10. Requesting 15 days should fail.
      const res = await request(app)
        .post('/api/leave')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          employeeId: employee.id,
          leaveType: 'SICK',
          startDate: '2026-11-01',
          endDate: '2026-11-15', // 15 days
          reason: 'Medical recovery'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Insufficient leave balance');
    });
  });

  describe('Leave Calendar Collision Detection', () => {
    it('should return a collision warning if >30% of the department is absent during the period', async () => {
      // 1. Create and approve a leave for the Colleague in the same department
      const colleagueLeave = await prisma.leave.create({
        data: {
          employeeId: otherEmployee.id,
          leaveType: 'ANNUAL',
          startDate: new Date('2026-12-05'),
          endDate: new Date('2026-12-10'),
          days: 6,
          reason: 'Colleague Vacation',
          status: 'APPROVED'
        }
      });

      // 2. Submit a leave request for our test employee during the overlapping dates.
      // There are 2 active employees in the department (employee + otherEmployee).
      // Colleague is already absent, meaning 1 of 2 is absent = 50% absence.
      // 50% > 30% threshold, so it must return a collision warning.
      const res = await request(app)
        .post('/api/leave')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          employeeId: employee.id,
          leaveType: 'CASUAL',
          startDate: '2026-12-06',
          endDate: '2026-12-08',
          reason: 'My short trip'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('collisionWarning');
      expect(res.body.collisionWarning).not.toBeNull();
      expect(res.body.collisionWarning.warning).toBe(true);
      expect(res.body.collisionWarning.percentage).toBe(100); // Both absent on these dates
      expect(res.body.collisionWarning.message).toContain('Warning: Absenteeism in the');
    });
  });
});
