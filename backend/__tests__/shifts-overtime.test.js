/**
 * Behavioural coverage for shift management / rostering and overtime:
 *  - shift type CRUD + RBAC (create=HR+, delete=SUPER_ADMIN grant)
 *  - roster assignment, overlap guard, 1-click GENERAL reset
 *  - women night-shift safety compliance gate
 *  - overtime approve/reject workflow, employee IDOR, OT pay summary + settings
 *
 * All fixtures use year 2099 / `QA` markers so they never collide with seed data.
 */

const request = require('supertest');
const app = require('../src/index');
const prisma = require('../src/config/database');

const stamp = `${Date.now()}`.slice(-6);
const DAY = `QA Shift Day ${stamp}`;
const NIGHT = `QA Shift Night ${stamp}`;
const TEMP = `QA Shift Temp ${stamp}`;

describe('Shifts / rostering + overtime', () => {
  let adminToken, superToken, empToken, amitId, priyaId, snehaId, snehaGenderOriginal;
  let dayShiftId, nightShiftId;

  const cleanup = async () => {
    await prisma.shiftAssignment.deleteMany({ where: { startDate: { gte: new Date('2099-01-01') } } }).catch(() => {});
    await prisma.shiftType.deleteMany({ where: { name: { startsWith: 'QA Shift' } } }).catch(() => {});
    await prisma.overtime.deleteMany({ where: { date: { gte: new Date('2099-01-01') } } }).catch(() => {});
  };

  beforeAll(async () => {
    adminToken = (await request(app).post('/api/auth/login').send({ email: 'admin@hrms.com', password: 'admin123' })).body.token;
    superToken = (await request(app).post('/api/auth/login').send({ email: 'superadmin@hrms.com', password: 'admin123' })).body.token;
    empToken = (await request(app).post('/api/auth/login').send({ email: 'amit.patel@company.com', password: 'employee123' })).body.token;

    const amit = await prisma.employee.findUnique({ where: { email: 'amit.patel@company.com' } });
    const priya = await prisma.employee.findUnique({ where: { email: 'priya.sharma@company.com' } });
    const sneha = await prisma.employee.findUnique({ where: { email: 'sneha.reddy@company.com' } });
    amitId = amit.id; priyaId = priya.id; snehaId = sneha.id;
    snehaGenderOriginal = sneha.gender;

    // Make sneha FEMALE with no emergency contact to exercise the night-shift safety gate.
    await prisma.employee.update({ where: { id: snehaId }, data: { gender: 'FEMALE', emergencyContactName: null, emergencyContactPhone: null } });
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.employee.update({ where: { id: snehaId }, data: { gender: snehaGenderOriginal } }).catch(() => {});
    await prisma.$disconnect();
  });

  // ── Shift types ───────────────────────────────────────────────────────────────
  it('creates shift types (admin) and rejects missing fields', async () => {
    const day = await request(app).post('/api/shifts/types').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: DAY, startTime: '09:00', endTime: '18:00', minimumWorkHours: 8 });
    expect(day.status).toBe(201);
    dayShiftId = day.body.id;

    const night = await request(app).post('/api/shifts/types').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: NIGHT, startTime: '22:00', endTime: '06:00' });
    expect(night.status).toBe(201);
    nightShiftId = night.body.id;

    const bad = await request(app).post('/api/shifts/types').set('Authorization', `Bearer ${adminToken}`).send({ name: 'x' });
    expect(bad.status).toBe(400);
  });

  it('blocks a plain employee from creating shift types', async () => {
    const res = await request(app).post('/api/shifts/types').set('Authorization', `Bearer ${empToken}`)
      .send({ name: 'nope', startTime: '09:00', endTime: '18:00' });
    expect(res.status).toBe(403);
  });

  it('lists and updates shift types', async () => {
    const list = await request(app).get('/api/shifts/types').set('Authorization', `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    expect(list.body.some((s) => s.id === dayShiftId)).toBe(true);

    const upd = await request(app).put(`/api/shifts/types/${dayShiftId}`).set('Authorization', `Bearer ${adminToken}`).send({ gracePeriod: 20 });
    expect(upd.status).toBe(200);
    expect(upd.body.gracePeriod).toBe(20);
  });

  it('restricts shift-type deletion to the SUPER_ADMIN grant', async () => {
    const temp = await request(app).post('/api/shifts/types').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: TEMP, startTime: '10:00', endTime: '19:00' });
    const tempId = temp.body.id;

    const adminBlocked = await request(app).delete(`/api/shifts/types/${tempId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(adminBlocked.status).toBe(403); // ADMIN lacks the DELETE grant

    const ok = await request(app).delete(`/api/shifts/types/${tempId}`).set('Authorization', `Bearer ${superToken}`);
    expect(ok.status).toBe(200);
  });

  // ── Roster assignments ──────────────────────────────────────────────────────
  it('assigns a day shift to an employee (admin)', async () => {
    const res = await request(app).post('/api/shifts/assignments').set('Authorization', `Bearer ${adminToken}`)
      .send({ employeeId: amitId, shiftTypeId: dayShiftId, startDate: '2099-03-05' });
    expect(res.status).toBe(201);
    expect(res.body.shiftTypeId).toBe(dayShiftId);
  });

  it('rejects an overlapping roster assignment', async () => {
    const res = await request(app).post('/api/shifts/assignments').set('Authorization', `Bearer ${adminToken}`)
      .send({ employeeId: amitId, shiftTypeId: dayShiftId, startDate: '2099-03-10' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/overlap/i);
  });

  it('enforces women night-shift safety compliance', async () => {
    const res = await request(app).post('/api/shifts/assignments').set('Authorization', `Bearer ${adminToken}`)
      .send({ employeeId: snehaId, shiftTypeId: nightShiftId, startDate: '2099-03-05' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/safety/i);
  });

  it('supports a 1-click reset back to the General shift', async () => {
    const res = await request(app).post('/api/shifts/assignments').set('Authorization', `Bearer ${adminToken}`)
      .send({ employeeId: amitId, shiftTypeId: 'GENERAL', startDate: '2099-03-05' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/General/i);
  });

  // ── Overtime workflow ─────────────────────────────────────────────────────────
  it('approves a pending overtime request and rejects double-processing', async () => {
    const ot = await prisma.overtime.create({ data: { employeeId: amitId, date: new Date('2099-03-10'), regularHours: 8, otHours: 3, status: 'PENDING' } });

    const ok = await request(app).put(`/api/overtime/${ot.id}/approve`).set('Authorization', `Bearer ${adminToken}`).send({});
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('APPROVED');

    const again = await request(app).put(`/api/overtime/${ot.id}/approve`).set('Authorization', `Bearer ${adminToken}`).send({});
    expect(again.status).toBe(400);
  });

  it('rejects a pending overtime request with a reason', async () => {
    const ot = await prisma.overtime.create({ data: { employeeId: priyaId, date: new Date('2099-03-11'), regularHours: 8, otHours: 2, status: 'PENDING' } });
    const res = await request(app).put(`/api/overtime/${ot.id}/reject`).set('Authorization', `Bearer ${adminToken}`).send({ rejectReason: 'Not pre-approved' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('REJECTED');
  });

  it('scopes overtime listing to the requesting employee (IDOR)', async () => {
    const res = await request(app).get('/api/overtime').set('Authorization', `Bearer ${empToken}`);
    expect(res.status).toBe(200);
    expect(res.body.every((o) => o.employeeId === amitId)).toBe(true);
  });

  it('produces an overtime pay summary and updates OT settings', async () => {
    const summary = await request(app).get('/api/overtime/summary?month=3&year=2099').set('Authorization', `Bearer ${adminToken}`);
    expect(summary.status).toBe(200);
    expect(summary.body).toHaveProperty('totalOTPay');
    expect(Array.isArray(summary.body.summary)).toBe(true);

    const settings = await request(app).put('/api/overtime/settings').set('Authorization', `Bearer ${adminToken}`).send({ otMultiplier: 2 });
    expect(settings.status).toBe(200);
    expect(settings.body.otMultiplier).toBe(2);
  });
});
