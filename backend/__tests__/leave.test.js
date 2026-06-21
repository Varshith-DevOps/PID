const request = require('supertest');
const app = require('../src/index');
const prisma = require('../src/config/database');

const MARKER = 'QA-LEAVE-LIFECYCLE';

async function cleanup() {
  await prisma.leave.deleteMany({ where: { reason: MARKER } }).catch(() => {});
}

describe('Leave lifecycle (request → approve / reject) + RBAC', () => {
  let adminToken, employeeToken, employeeId;

  beforeAll(async () => {
    await cleanup();
    const a = await request(app).post('/api/auth/login').send({ email: 'admin@hrms.com', password: 'admin123' });
    adminToken = a.body.token;
    const e = await request(app).post('/api/auth/login').send({ email: 'rajesh.kumar@company.com', password: 'employee123' });
    employeeToken = e.body.token;
    const emp = await prisma.employee.findUnique({ where: { email: 'rajesh.kumar@company.com' } });
    employeeId = emp.id;
  });

  afterAll(async () => { await cleanup(); await prisma.$disconnect(); });

  const makeRequest = (token) => request(app).post('/api/leave').set('Authorization', `Bearer ${token}`).send({
    employeeId, leaveType: 'ANNUAL', startDate: '2099-03-02', endDate: '2099-03-04', reason: MARKER,
  });

  it('creates a leave request in PENDING state', async () => {
    const res = await makeRequest(adminToken);
    expect([200, 201]).toContain(res.status);
    const leave = await prisma.leave.findFirst({ where: { reason: MARKER }, orderBy: { createdAt: 'desc' } });
    expect(leave.status).toBe('PENDING');
    expect(leave.days).toBeGreaterThan(0); // computed span
  });

  it('approves a pending leave (manager/admin) -> APPROVED', async () => {
    const leave = await prisma.leave.findFirst({ where: { reason: MARKER, status: 'PENDING' } });
    const res = await request(app).put(`/api/leave/${leave.id}/approve`).set('Authorization', `Bearer ${adminToken}`).send({});
    expect(res.status).toBe(200);
    const updated = await prisma.leave.findUnique({ where: { id: leave.id } });
    expect(updated.status).toBe('APPROVED');
    expect(updated.approvedAt).not.toBeNull();
  });

  it('rejects another request with a reason -> REJECTED', async () => {
    await makeRequest(adminToken);
    const leave = await prisma.leave.findFirst({ where: { reason: MARKER, status: 'PENDING' }, orderBy: { createdAt: 'desc' } });
    const res = await request(app).put(`/api/leave/${leave.id}/reject`).set('Authorization', `Bearer ${adminToken}`).send({ rejectReason: 'QA reject' });
    expect(res.status).toBe(200);
    const updated = await prisma.leave.findUnique({ where: { id: leave.id } });
    expect(updated.status).toBe('REJECTED');
  });

  it('RBAC: a standard employee cannot approve leave', async () => {
    await makeRequest(adminToken);
    const leave = await prisma.leave.findFirst({ where: { reason: MARKER, status: 'PENDING' }, orderBy: { createdAt: 'desc' } });
    const res = await request(app).put(`/api/leave/${leave.id}/approve`).set('Authorization', `Bearer ${employeeToken}`).send({});
    expect(res.status).toBe(403);
  });

  it('returns a structured leave balance (quota / used / remaining)', async () => {
    const res = await request(app).get(`/api/leave/balance?employeeId=${employeeId}`).set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(200);
    const balances = Array.isArray(res.body) ? res.body : res.body.balances;
    expect(Array.isArray(balances)).toBe(true);
    const annual = balances.find((b) => b.leaveType === 'ANNUAL');
    expect(annual).toBeTruthy();
    expect(annual).toHaveProperty('quota');
    expect(annual).toHaveProperty('remaining');
  });
});
