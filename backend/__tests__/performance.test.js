/**
 * Behavioural coverage for the performance module: KRAs/goals (with the 100%
 * weightage cap and HR-only delete), appraisal cycles (create + self/manager
 * evaluations + RBAC), and 360 feedback (self-review block + anonymity masking).
 * Uses year 2099 / a unique cycle name so it never collides with seeded data.
 */

const request = require('supertest');
const app = require('../src/index');
const prisma = require('../src/config/database');

const stamp = `${Date.now()}`.slice(-6);
const CYCLE = `QA FY99 ${stamp}`;
const FB_MARKER = `QA360 ${stamp}`;

describe('Performance management', () => {
  let adminToken, superToken, empToken, empId, otherId, kraId, appraisalId;

  const cleanup = async () => {
    if (empId) {
      await prisma.kRA.deleteMany({ where: { employeeId: empId, year: 2099 } }).catch(() => {});
      await prisma.performanceAppraisal.deleteMany({ where: { employeeId: empId, appraisalCycle: { startsWith: 'QA FY99' } } }).catch(() => {});
    }
    await prisma.feedback360.deleteMany({ where: { feedback: { startsWith: 'QA360' } } }).catch(() => {});
  };

  beforeAll(async () => {
    adminToken = (await request(app).post('/api/auth/login').send({ email: 'admin@hrms.com', password: 'admin123' })).body.token;
    superToken = (await request(app).post('/api/auth/login').send({ email: 'superadmin@hrms.com', password: 'admin123' })).body.token;
    empToken = (await request(app).post('/api/auth/login').send({ email: 'amit.patel@company.com', password: 'employee123' })).body.token;
    empId = (await prisma.employee.findUnique({ where: { email: 'amit.patel@company.com' } })).id;
    otherId = (await prisma.employee.findUnique({ where: { email: 'priya.sharma@company.com' } })).id;
    await cleanup();
  });

  afterAll(async () => { await cleanup(); await prisma.$disconnect(); });

  // ── KRAs / goals ──────────────────────────────────────────────────────────────
  it('creates a KRA (admin) and rejects missing fields', async () => {
    const res = await request(app).post('/api/performance/kras').set('Authorization', `Bearer ${adminToken}`)
      .send({ employeeId: empId, title: 'Ship payroll module', weightage: 30, year: 2099 });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING');
    kraId = res.body.id;

    const bad = await request(app).post('/api/performance/kras').set('Authorization', `Bearer ${adminToken}`).send({ title: 'no emp' });
    expect(bad.status).toBe(400);
  });

  it('enforces the 100% total weightage cap', async () => {
    const res = await request(app).post('/api/performance/kras').set('Authorization', `Bearer ${adminToken}`)
      .send({ employeeId: empId, title: 'Too heavy', weightage: 80, year: 2099 }); // 30 + 80 > 100
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/weightage/i);
  });

  it('lists an employee\'s KRAs and updates status', async () => {
    const list = await request(app).get(`/api/performance/kras?employeeId=${empId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    expect(list.body.some((k) => k.id === kraId)).toBe(true);

    const upd = await request(app).put(`/api/performance/kras/${kraId}`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'ACHIEVED' });
    expect(upd.status).toBe(200);
    expect(upd.body.status).toBe('ACHIEVED');
  });

  it('restricts KRA deletion to holders of the PERFORMANCE.DELETE grant (super-admin)', async () => {
    // Plain employees are blocked outright.
    const denied = await request(app).delete(`/api/performance/kras/${kraId}`).set('Authorization', `Bearer ${empToken}`);
    expect(denied.status).toBe(403);

    // ADMIN passes the role gate but lacks the DELETE permission in the default grant matrix.
    const adminBlocked = await request(app).delete(`/api/performance/kras/${kraId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(adminBlocked.status).toBe(403);

    // SUPER_ADMIN holds every grant and can delete.
    const ok = await request(app).delete(`/api/performance/kras/${kraId}`).set('Authorization', `Bearer ${superToken}`);
    expect(ok.status).toBe(200);
  });

  // ── Appraisal cycle ─────────────────────────────────────────────────────────
  it('initiates an appraisal cycle (admin), blocks employees, rejects duplicates', async () => {
    const res = await request(app).post('/api/performance/appraisals').set('Authorization', `Bearer ${adminToken}`)
      .send({ employeeId: empId, appraisalCycle: CYCLE, startDate: '2099-01-01', endDate: '2099-06-30' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('DRAFT');
    appraisalId = res.body.id;

    const empCreate = await request(app).post('/api/performance/appraisals').set('Authorization', `Bearer ${empToken}`)
      .send({ employeeId: empId, appraisalCycle: `${CYCLE} x`, startDate: '2099-01-01', endDate: '2099-06-30' });
    expect(empCreate.status).toBe(403);

    const dup = await request(app).post('/api/performance/appraisals').set('Authorization', `Bearer ${adminToken}`)
      .send({ employeeId: empId, appraisalCycle: CYCLE, startDate: '2099-01-01', endDate: '2099-06-30' });
    expect(dup.status).toBe(400);
  });

  it('accepts a self-evaluation from the appraisee', async () => {
    const res = await request(app).put(`/api/performance/appraisals/${appraisalId}/self`).set('Authorization', `Bearer ${empToken}`)
      .send({ selfRating: 4, selfFeedback: 'Met all goals this cycle.' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('SUBMITTED_SELF');
    expect(res.body.selfRating).toBe(4);
  });

  it('completes the cycle with a manager evaluation and blocks employees from it', async () => {
    const denied = await request(app).put(`/api/performance/appraisals/${appraisalId}/manager`).set('Authorization', `Bearer ${empToken}`)
      .send({ managerRating: 5, managerFeedback: 'Should not be allowed' });
    expect(denied.status).toBe(403);

    const res = await request(app).put(`/api/performance/appraisals/${appraisalId}/manager`).set('Authorization', `Bearer ${adminToken}`)
      .send({ managerRating: 4.5, managerFeedback: 'Excellent delivery', finalRating: 4.5 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('COMPLETED');
    expect(res.body.finalRating).toBe(4.5);
  });

  // ── 360 feedback ──────────────────────────────────────────────────────────────
  it('submits 360 feedback for a peer and rejects self-review', async () => {
    const res = await request(app).post('/api/performance/feedback360').set('Authorization', `Bearer ${empToken}`)
      .send({ employeeId: otherId, feedback: `${FB_MARKER} great collaborator`, rating: 5, relationship: 'PEER' });
    expect(res.status).toBe(201);

    const self = await request(app).post('/api/performance/feedback360').set('Authorization', `Bearer ${empToken}`)
      .send({ employeeId: empId, feedback: `${FB_MARKER} self`, rating: 5 });
    expect(self.status).toBe(400);
  });

  it('masks the reviewer when feedback is anonymous', async () => {
    await request(app).post('/api/performance/feedback360').set('Authorization', `Bearer ${empToken}`)
      .send({ employeeId: otherId, feedback: `${FB_MARKER} anon`, rating: 4, anonymous: true });

    const res = await request(app).get(`/api/performance/feedback360?employeeId=${otherId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const anon = res.body.find((f) => f.feedback === `${FB_MARKER} anon`);
    expect(anon).toBeTruthy();
    expect(anon.reviewerId).toBe('anonymous');
    expect(anon.reviewer.firstName).toBe('Anonymous');
  });
});
