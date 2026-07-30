const request = require('supertest');
const app = require('../src/index');
const prisma = require('../src/config/database');

describe('9-Box Performance Appraisal Operations (Sprint 5)', () => {
  let employeeToken;
  let managerToken;
  let adminToken;
  let employee;
  let manager;
  const cycleName = 'H1 2026 Appraisal Cycle';

  beforeAll(async () => {
    // Clear login logs to bypass geo-velocity check
    const users = ['rajesh.kumar@company.com', 'amit.patel@company.com', 'admin@hrms.com'];
    for (const email of users) {
      const user = await prisma.user.findFirst({ where: { email } });
      if (user) {
        await prisma.auditLog.deleteMany({
          where: {
            userId: user.id,
            action: { in: ['AUTH_LOGIN_SUCCESS', 'AUTH_PASSKEY_LOGIN_SUCCESS', 'AUTH_SSO_LOGIN_SUCCESS', 'AUTH_LOGIN_ANOMALOUS_GEO_VELOCITY'] }
          }
        });
      }
    }

    const empLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'rajesh.kumar@company.com', password: 'employee123' });
    employeeToken = empLogin.body.token;

    const mgrLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'amit.patel@company.com', password: 'employee123' });
    managerToken = mgrLogin.body.token;

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@hrms.com', password: 'admin123' });
    adminToken = adminLogin.body.token;

    employee = await prisma.employee.findFirst({ where: { email: 'rajesh.kumar@company.com' } });
    manager = await prisma.employee.findFirst({ where: { email: 'amit.patel@company.com' } });

    // Clean up past appraisals
    await prisma.performanceReview9Box.deleteMany({
      where: { employeeId: employee.id }
    });
  });

  afterAll(async () => {
    await prisma.performanceReview9Box.deleteMany({
      where: { employeeId: employee.id }
    });
    await prisma.$disconnect();
  });

  describe('Appraisal Cycles and 9-Box Grid Placement', () => {
    it('should allow employee to submit self-evaluation successfully', async () => {
      const res = await request(app)
        .post('/api/appraisals/self-evaluation')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          cycleName,
          selfRatingScore: 4.5,
          selfComments: 'Completed latency scaling OKRs successfully.'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('selfRatingScore', 4.5);
      expect(res.body.selfComments).toBe('Completed latency scaling OKRs successfully.');
      expect(res.body.status).toBe('SELF_SUBMITTED');
    });

    it('should allow manager to submit performance and potential review, calculating 9-Box placement', async () => {
      // Performance = 3 (High), Potential = 2 (Medium)
      // Formula: (Performance - 1) * 3 + Potential = (3 - 1) * 3 + 2 = 8
      const res = await request(app)
        .post('/api/appraisals/manager-evaluation')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          employeeId: employee.id,
          cycleName,
          managerRatingScore: 4.2,
          managerComments: 'Excellent work scaling APIs. High performance, good growth outlook.',
          performanceRating: 3,
          potentialRating: 2
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('performanceRating', 3);
      expect(res.body).toHaveProperty('potentialRating', 2);
      expect(res.body.boxPlacement).toBe(8); // Grid Placement
      expect(res.body.status).toBe('COMPLETED');
    });

    it('should retrieve HR 9-Box grid analytics correctly grouping evaluated employees', async () => {
      const res = await request(app)
        .get('/api/appraisals/9box-analytics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('grid');
      
      // Box 8 should contain the employee
      const box8 = res.body.grid.find(b => b.boxNumber === 8);
      expect(box8.employees.length).toBeGreaterThan(0);
      expect(box8.employees[0].name).toBe(`${employee.firstName} ${employee.lastName}`);
    });
  });
});
