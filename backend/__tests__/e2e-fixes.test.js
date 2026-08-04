const request = require('supertest');
const app = require('../src/index');
const prisma = require('../src/config/database');

const MARKER = 'QA-E2E-FIXES';

describe('E2E regression fixes (timesheet month generation, expense state machines, biometric webhook fail-closed)', () => {
  let adminToken;
  let employeeToken;
  let employeeId;
  let otherEmployeeId;

  beforeAll(async () => {
    const a = await request(app).post('/api/auth/login').send({ email: 'admin@hrms.com', password: 'admin123' });
    adminToken = a.body.token;
    const e = await request(app).post('/api/auth/login').send({ email: 'rajesh.kumar@company.com', password: 'employee123' });
    employeeToken = e.body.token;

    const emp = await prisma.employee.findUnique({ where: { email: 'rajesh.kumar@company.com' } });
    const other = await prisma.employee.findUnique({ where: { email: 'priya.sharma@company.com' } });
    employeeId = emp.id;
    otherEmployeeId = other.id;

    await prisma.expenseClaim.deleteMany({ where: { title: { startsWith: MARKER } } }).catch(() => {});
    await prisma.travelAdvance.deleteMany({ where: { purpose: { startsWith: MARKER } } }).catch(() => {});
    await prisma.timesheet.deleteMany({ where: { description: MARKER } }).catch(() => {});
  });

  afterAll(async () => {
    await prisma.expenseClaim.deleteMany({ where: { title: { startsWith: MARKER } } }).catch(() => {});
    await prisma.travelAdvance.deleteMany({ where: { purpose: { startsWith: MARKER } } }).catch(() => {});
    await prisma.timesheet.deleteMany({ where: { description: MARKER } }).catch(() => {});
    await prisma.$disconnect();
  });

  describe('Biometric webhook fails closed', () => {
    it('returns 503 (not 401-with-default-key) when BIOMETRIC_API_KEY is unset', async () => {
      const previous = process.env.BIOMETRIC_API_KEY;
      delete process.env.BIOMETRIC_API_KEY;
      try {
        const res = await request(app)
          .post('/api/attendance/sync/biometric-webhook?apiKey=TEST_SECRET')
          .send({ companyId: 'x', logs: [] });
        expect(res.status).toBe(503);
        expect(res.body.error).toContain('not configured');
      } finally {
        if (previous) process.env.BIOMETRIC_API_KEY = previous;
      }
    });

    it('still accepts a correctly configured key', async () => {
      process.env.BIOMETRIC_API_KEY = 'QA-CONFIGURED-KEY';
      try {
        const res = await request(app)
          .post('/api/attendance/sync/biometric-webhook?apiKey=QA-CONFIGURED-KEY')
          .send({ companyId: '00000000-0000-0000-0000-000000000000', logs: [] });
        // Auth passes; fails later on the (bogus) companyId lookup — proves key gate cleared.
        expect(res.status).not.toBe(401);
        expect(res.status).not.toBe(503);
      } finally {
        delete process.env.BIOMETRIC_API_KEY;
      }
    });
  });

  describe('Timesheet → attendance monthly generation', () => {
    it('generates attendance for every day of the month, not just the 1st', async () => {
      // Use the immediately previous calendar month: fully in the past, so the
      // controller's "never fabricate future dates" cap cannot interfere.
      const now = new Date();
      const month = now.getMonth() === 0 ? 12 : now.getMonth(); // previous month (1-12)
      const year = month === 12 ? now.getFullYear() - 1 : now.getFullYear();

      const day1 = new Date(year, month - 1, 1);
      const day15 = new Date(year, month - 1, 15);
      day1.setHours(0, 0, 0, 0);
      day15.setHours(0, 0, 0, 0);
      const rangeStart = day1;
      const rangeEnd = new Date(year, month, 0, 23, 59, 59, 999);

      // Snapshot pre-existing attendance rows in the target month so cleanup can
      // restore them exactly (generation may overwrite rows other suites rely on).
      const beforeRows = await prisma.attendance.findMany({
        where: { date: { gte: rangeStart, lte: rangeEnd } },
        select: { id: true, status: true, workHours: true },
      });
      const beforeMap = new Map(beforeRows.map((r) => [r.id, r]));

      await prisma.timesheet.create({
        data: { employeeId, date: day1, hoursWorked: 8, description: MARKER },
      });
      await prisma.timesheet.create({
        data: { employeeId, date: day15, hoursWorked: 8, description: MARKER },
      });

      try {
        const res = await request(app)
          .post('/api/timesheet/generate-attendance')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ month, year });

        expect(res.status).toBe(200);
        expect(res.body.records.length).toBeGreaterThanOrEqual(2);

        const day1Att = await prisma.attendance.findFirst({ where: { employeeId, date: day1 } });
        const day15Att = await prisma.attendance.findFirst({ where: { employeeId, date: day15 } });
        expect(day1Att).not.toBeNull();
        expect(day15Att).not.toBeNull();
        expect(day1Att.status).toBe('PRESENT');
        expect(day15Att.status).toBe('PRESENT');
      } finally {
        // Precise cleanup: delete rows this test created, restore rows it overwrote.
        // Runs even if an assertion above fails, so cross-suite DB pollution is
        // impossible (the sprint8 flake this replaced was caused by leaked rows).
        const afterRows = await prisma.attendance.findMany({
          where: { date: { gte: rangeStart, lte: rangeEnd } },
          select: { id: true, status: true, workHours: true },
        });
        for (const row of afterRows) {
          const before = beforeMap.get(row.id);
          if (before) {
            await prisma.attendance.update({
              where: { id: row.id },
              data: { status: before.status, workHours: before.workHours },
            });
          } else {
            await prisma.attendance.delete({ where: { id: row.id } });
          }
        }
      }
    });
  });

  describe('Expense claim creation for admin/HR accounts', () => {
    it('returns a clear 400 instead of a 500 when the requester has no linked employee', async () => {
      const res = await request(app)
        .post('/api/expenses/claims')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: `${MARKER}-admin-no-link`, category: 'TRAVEL', amount: 500 });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('No employee profile is linked');
    });

    it('lets an HR/admin create a claim for a specific authorized employee', async () => {
      const res = await request(app)
        .post('/api/expenses/claims')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ employeeId, title: `${MARKER}-admin-on-behalf`, category: 'TRAVEL', amount: 500, description: MARKER });
      expect(res.status).toBe(201);
      expect(res.body.employeeId).toBe(employeeId);
      expect(res.body.status).toBe('PENDING');
    });
  });

  describe('Expense claim finance-approval workflow', () => {
    it('blocks finance approval until the manager has approved', async () => {
      const claim = await prisma.expenseClaim.create({
        data: { employeeId, title: `${MARKER}-wf`, category: 'TRAVEL', amount: 300, description: MARKER },
      });

      const res = await request(app)
        .put(`/api/expenses/claims/${claim.id}/finance-approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ remarks: 'Should be blocked', markAsPaid: true });
      expect(res.status).toBe(409);

      const manager = await request(app)
        .put(`/api/expenses/claims/${claim.id}/manager-approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ remarks: 'Manager OK' });
      expect(manager.status).toBe(200);
      expect(manager.body.status).toBe('APPROVED_BY_MANAGER');

      const finance = await request(app)
        .put(`/api/expenses/claims/${claim.id}/finance-approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ remarks: 'Finance OK', markAsPaid: true });
      expect(finance.status).toBe(200);
      expect(finance.body.status).toBe('PAID');
    });
  });

  describe('Travel advance state machine', () => {
    it('rejects a client-supplied arbitrary status on approval', async () => {
      const adv = await prisma.travelAdvance.create({
        data: { employeeId, purpose: `${MARKER}-status-inject`, amountRequested: 1000 },
      });

      const res = await request(app)
        .put(`/api/expenses/advances/${adv.id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amountApproved: 1000, status: 'REJECTED' });
      expect(res.status).toBe(200);
      // Server computes the status; a REJECTED value must not be honoured.
      expect(res.body.status).toBe('APPROVED');
    });

    it('blocks approving an already-approved advance (only PENDING → APPROVED)', async () => {
      const adv = await prisma.travelAdvance.create({
        data: { employeeId, purpose: `${MARKER}-reapprove`, amountRequested: 500 },
      });

      const first = await request(app)
        .put(`/api/expenses/advances/${adv.id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amountApproved: 500 });
      expect(first.status).toBe(200);

      const second = await request(app)
        .put(`/api/expenses/advances/${adv.id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amountApproved: 500 });
      expect(second.status).toBe(409);
    });

    it('blocks settling an advance that was never approved', async () => {
      const adv = await prisma.travelAdvance.create({
        data: { employeeId, purpose: `${MARKER}-settle`, amountRequested: 500 },
      });

      const res = await request(app)
        .put(`/api/expenses/advances/${adv.id}/settle`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ settledAmount: 500 });
      expect(res.status).toBe(409);
    });
  });

  describe('Timesheet daily summary is keyed by employee id (not name)', () => {
    it('returns a breakdown keyed by employeeId with embedded names', async () => {
      // Self-sufficient: seed a timesheet for today so the breakdown is never
      // empty regardless of pre-existing seed data (the endpoint only lists
      // employees who logged hours today).
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await prisma.timesheet.create({
        data: { employeeId, date: today, hoursWorked: 5, description: MARKER },
      });

      try {
        const res = await request(app)
          .get('/api/timesheet/daily')
          .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('breakdown');
        const keys = Object.keys(res.body.breakdown);
        expect(keys.length).toBeGreaterThanOrEqual(1);
        // Keys are employee UUIDs; entries carry the human-readable name.
        const first = res.body.breakdown[keys[0]];
        expect(first).toHaveProperty('employeeId');
        expect(first).toHaveProperty('name');
        expect(first).toHaveProperty('hours');
        expect(res.body).toHaveProperty('present');
        expect(res.body).toHaveProperty('absent');
      } finally {
        // Remove only the marker timesheet created above (today's row).
        await prisma.timesheet.deleteMany({ where: { description: MARKER, date: today } }).catch(() => {});
      }
    });
  });
});
