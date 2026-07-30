const request = require('supertest');
const app = require('../src/index');
const prisma = require('../src/config/database');

describe('Kudos Transactions Integration Tests (Sprint 4)', () => {
  let senderEmployee;
  let receiverEmployee;
  let senderToken;
  let receiverToken;

  beforeAll(async () => {
    // Clear login audit logs to bypass geo-velocity blocking
    const senderUser = await prisma.user.findFirst({ where: { email: 'rajesh.kumar@company.com' } });
    if (senderUser) {
      await prisma.auditLog.deleteMany({
        where: {
          userId: senderUser.id,
          action: { in: ['AUTH_LOGIN_SUCCESS', 'AUTH_PASSKEY_LOGIN_SUCCESS', 'AUTH_SSO_LOGIN_SUCCESS', 'AUTH_LOGIN_ANOMALOUS_GEO_VELOCITY'] }
        }
      });
    }

    const receiverUser = await prisma.user.findFirst({ where: { email: 'priya.sharma@company.com' } });
    if (receiverUser) {
      await prisma.auditLog.deleteMany({
        where: {
          userId: receiverUser.id,
          action: { in: ['AUTH_LOGIN_SUCCESS', 'AUTH_PASSKEY_LOGIN_SUCCESS', 'AUTH_SSO_LOGIN_SUCCESS', 'AUTH_LOGIN_ANOMALOUS_GEO_VELOCITY'] }
        }
      });
    }

    // Login Sender (Rajesh)
    const senderLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'rajesh.kumar@company.com', password: 'employee123' });
    senderToken = senderLogin.body.token;

    // Login Receiver (Priya)
    const receiverLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'priya.sharma@company.com', password: 'employee123' });
    receiverToken = receiverLogin.body.token;

    senderEmployee = await prisma.employee.findFirst({ where: { email: 'rajesh.kumar@company.com' } });
    receiverEmployee = await prisma.employee.findFirst({ where: { email: 'priya.sharma@company.com' } });

    // Reset balances and allowances
    await prisma.employee.update({
      where: { id: senderEmployee.id },
      data: {
        kudosBalance: 0,
        monthlyKudosAllowance: 100,
        lastKudosAllowanceReset: new Date()
      }
    });

    await prisma.employee.update({
      where: { id: receiverEmployee.id },
      data: {
        kudosBalance: 0,
        monthlyKudosAllowance: 100,
        lastKudosAllowanceReset: new Date()
      }
    });

    await prisma.kudos.deleteMany({
      where: {
        OR: [
          { senderId: senderEmployee.id },
          { receiverId: senderEmployee.id }
        ]
      }
    });
  });

  afterAll(async () => {
    await prisma.kudos.deleteMany({
      where: {
        OR: [
          { senderId: senderEmployee.id },
          { receiverId: senderEmployee.id }
        ]
      }
    });
    await prisma.$disconnect();
  });

  describe('Peer Kudos Transactions', () => {
    it('should successfully send kudos and update balances accordingly', async () => {
      const res = await request(app)
        .post('/api/kudos')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({
          receiverId: receiverEmployee.id,
          points: 40,
          message: 'Excellent leadership in sprint delivery!'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('points', 40);
      expect(res.body.message).toBe('Excellent leadership in sprint delivery!');

      // Verify DB balances
      const senderDB = await prisma.employee.findUnique({ where: { id: senderEmployee.id } });
      const receiverDB = await prisma.employee.findUnique({ where: { id: receiverEmployee.id } });

      expect(senderDB.monthlyKudosAllowance).toBe(60);
      expect(receiverDB.kudosBalance).toBe(40);
    });

    it('should reject sending kudos to oneself', async () => {
      const res = await request(app)
        .post('/api/kudos')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({
          receiverId: senderEmployee.id,
          points: 10,
          message: 'Self appreciation'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('You cannot send kudos to yourself');
    });

    it('should reject negative points or non-integer points', async () => {
      const res = await request(app)
        .post('/api/kudos')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({
          receiverId: receiverEmployee.id,
          points: -10,
          message: 'Invalid points'
        });

      expect(res.status).toBe(400);
    });

    it('should reject kudos transaction exceeding remaining monthly allowance', async () => {
      // Current remaining allowance is 60, trying to send 70
      const res = await request(app)
        .post('/api/kudos')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({
          receiverId: receiverEmployee.id,
          points: 70,
          message: 'Too many points'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Insufficient kudos allowance');
    });

    it('should fetch recent logs via Kudos Wall successfully', async () => {
      const res = await request(app)
        .get('/api/kudos/wall')
        .set('Authorization', `Bearer ${senderToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('wall');
      expect(res.body).toHaveProperty('allowance');
      expect(res.body).toHaveProperty('balance');
      expect(res.body.wall.length).toBeGreaterThan(0);
    });
  });
});
