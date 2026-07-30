const request = require('supertest');
const app = require('../src/index');
const prisma = require('../src/config/database');

describe('Helpdesk Ticketing with Email Alerts (Sprint 6)', () => {
  let employeeToken;
  let adminToken;
  let employee;

  beforeAll(async () => {
    const users = ['rajesh.kumar@company.com', 'admin@hrms.com'];
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

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@hrms.com', password: 'admin123' });
    adminToken = adminLogin.body.token;

    employee = await prisma.employee.findFirst({ where: { email: 'rajesh.kumar@company.com' } });

    // Clean up past tickets for this employee
    await prisma.helpdeskTicket.deleteMany({ where: { employeeId: employee.id } });
  });

  afterAll(async () => {
    await prisma.helpdeskTicket.deleteMany({ where: { employeeId: employee.id } });
    await prisma.$disconnect();
  });

  let ticketId;

  describe('Ticket Lifecycle', () => {
    it('should create a helpdesk ticket and attempt email alert (gracefully failing SMTP)', async () => {
      const res = await request(app)
        .post('/api/helpdesk')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          category: 'IT',
          subject: 'VPN Connection Keeps Dropping',
          description: 'My VPN connection drops every 15 minutes when connected to the Mumbai office gateway.',
          priority: 'HIGH'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('subject', 'VPN Connection Keeps Dropping');
      expect(res.body).toHaveProperty('category', 'IT');
      expect(res.body).toHaveProperty('priority', 'HIGH');
      expect(res.body).toHaveProperty('status', 'OPEN');
      ticketId = res.body.id;
    });

    it('should list employee tickets', async () => {
      const res = await request(app)
        .get('/api/helpdesk/employee')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0]).toHaveProperty('subject', 'VPN Connection Keeps Dropping');
    });

    it('should list tickets in admin queue with employee details', async () => {
      const res = await request(app)
        .get('/api/helpdesk/admin')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0]).toHaveProperty('employee');
      expect(res.body[0].employee).toHaveProperty('firstName');
    });

    it('should resolve a ticket with resolution comments', async () => {
      const res = await request(app)
        .put(`/api/helpdesk/${ticketId}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          resolution: 'Reconfigured VPN gateway settings and upgraded client certificate. Issue resolved.'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'RESOLVED');
      expect(res.body.resolution).toBe('Reconfigured VPN gateway settings and upgraded client certificate. Issue resolved.');
    });
  });
});
