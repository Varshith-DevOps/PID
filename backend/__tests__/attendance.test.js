/**
 * Behavioural coverage for the attendance module: self-service check-in/out
 * (with punch validation), manager/admin manual marking, settings, history with
 * IDOR protection, and the monthly report. Uses `amit.patel` (no shift assignment
 * -> clean General-Shift fallback, so no geofence/IP coupling). `rajesh` and
 * `priya` carry restricted shifts in the seed and are intentionally avoided here.
 */

const request = require('supertest');
const app = require('../src/index');
const prisma = require('../src/config/database');

const nowIso = () => new Date().toISOString();

describe('Attendance module', () => {
  let adminToken, empToken, empId, otherId;

  const cleanupPunchEmployee = async () => {
    if (!empId) return;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    // Remove today's punches + the future manual-mark date so reruns are clean.
    await prisma.attendance.deleteMany({ where: { employeeId: empId, date: { gte: todayStart } } }).catch(() => {});
    await prisma.attendance.deleteMany({ where: { employeeId: empId, date: new Date('2050-03-15') } }).catch(() => {});
    await prisma.overtime.deleteMany({ where: { employeeId: empId } }).catch(() => {});
  };

  beforeAll(async () => {
    const a = await request(app).post('/api/auth/login').send({ email: 'admin@hrms.com', password: 'admin123' });
    adminToken = a.body.token;
    const e = await request(app).post('/api/auth/login').send({ email: 'amit.patel@company.com', password: 'employee123' });
    empToken = e.body.token;

    empId = (await prisma.employee.findUnique({ where: { email: 'amit.patel@company.com' } })).id;
    otherId = (await prisma.employee.findUnique({ where: { email: 'priya.sharma@company.com' } })).id;
    await cleanupPunchEmployee();
  });

  afterAll(async () => { await cleanupPunchEmployee(); await prisma.$disconnect(); });

  // ── Self-service check-in / check-out lifecycle ──────────────────────────────
  it('records a self check-in with a PRESENT or LATE status', async () => {
    const res = await request(app)
      .post('/api/attendance/check-in')
      .set('Authorization', `Bearer ${empToken}`)
      .send({ employeeId: empId, timestamp: nowIso() });

    expect(res.status).toBe(200);
    expect(res.body.checkIn).toBeTruthy();
    expect(['PRESENT', 'LATE']).toContain(res.body.status);
    expect(res.body.lateMinutes).toBeGreaterThanOrEqual(0);
  });

  it('rejects a second check-in while a session is still open', async () => {
    const res = await request(app)
      .post('/api/attendance/check-in')
      .set('Authorization', `Bearer ${empToken}`)
      .send({ employeeId: empId, timestamp: nowIso() });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already checked in/i);
  });

  it('completes the session on check-out with computed work hours', async () => {
    const res = await request(app)
      .post('/api/attendance/check-out')
      .set('Authorization', `Bearer ${empToken}`)
      .send({ employeeId: empId, timestamp: nowIso() });

    expect(res.status).toBe(200);
    expect(res.body.checkOut).toBeTruthy();
    expect(typeof res.body.workHours).toBe('number');
    expect(res.body.workHours).toBeGreaterThanOrEqual(0);
  });

  it('returns 404 when checking out with no open session', async () => {
    const res = await request(app)
      .post('/api/attendance/check-out')
      .set('Authorization', `Bearer ${empToken}`)
      .send({ employeeId: empId, timestamp: nowIso() });

    expect(res.status).toBe(404);
  });

  it('blocks buddy-punching for another employee', async () => {
    const res = await request(app)
      .post('/api/attendance/check-in')
      .set('Authorization', `Bearer ${empToken}`)
      .send({ employeeId: otherId, timestamp: nowIso() });

    expect(res.status).toBe(403);
  });

  it('rejects a punch with a stale timestamp (replay protection)', async () => {
    const res = await request(app)
      .post('/api/attendance/check-in')
      .set('Authorization', `Bearer ${empToken}`)
      .send({ employeeId: empId, timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString() });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/timestamp/i);
  });

  // ── Settings (admin only) ────────────────────────────────────────────────────
  it('lets an admin read attendance settings and blocks employees', async () => {
    const adminRes = await request(app).get('/api/attendance/settings').set('Authorization', `Bearer ${adminToken}`);
    expect(adminRes.status).toBe(200);
    expect(adminRes.body).toHaveProperty('checkInStartTime');

    const empRes = await request(app).get('/api/attendance/settings').set('Authorization', `Bearer ${empToken}`);
    expect(empRes.status).toBe(403);
  });

  it('updates the late threshold via settings', async () => {
    const res = await request(app)
      .put('/api/attendance/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ lateThreshold: 25 });
    expect(res.status).toBe(200);
    expect(res.body.lateThreshold).toBe(25);
  });

  // ── Manual marking (manager/admin) ───────────────────────────────────────────
  it('lets an admin mark attendance and blocks a plain employee', async () => {
    const ok = await request(app)
      .post('/api/attendance/mark')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ employeeId: empId, date: '2050-03-15', status: 'ABSENT', notes: 'QA manual mark' });
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('ABSENT');

    const denied = await request(app)
      .post('/api/attendance/mark')
      .set('Authorization', `Bearer ${empToken}`)
      .send({ employeeId: empId, date: '2050-03-16', status: 'PRESENT' });
    expect(denied.status).toBe(403);
  });

  // ── History + IDOR ───────────────────────────────────────────────────────────
  it('serves an employee their own history but blocks another employee\'s', async () => {
    const own = await request(app)
      .get(`/api/attendance/employee/${empId}`)
      .set('Authorization', `Bearer ${empToken}`);
    expect(own.status).toBe(200);
    expect(Array.isArray(own.body.attendances)).toBe(true);

    const other = await request(app)
      .get(`/api/attendance/employee/${otherId}`)
      .set('Authorization', `Bearer ${empToken}`);
    expect(other.status).toBe(403);
  });

  // ── Reports ──────────────────────────────────────────────────────────────────
  it('produces a monthly report summary for an admin', async () => {
    const res = await request(app)
      .get('/api/attendance/report/monthly?month=6&year=2026')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.month).toBe(6);
    expect(Array.isArray(res.body.summary)).toBe(true);
  });

  it('returns today\'s attendance board for an admin', async () => {
    const res = await request(app).get('/api/attendance/today').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
