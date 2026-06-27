const request = require('supertest');
const app = require('../src/index');
const prisma = require('../src/config/database');
const { parsePagination } = require('../src/middleware/validate');

describe('Request validation (Zod)', () => {
  afterAll(async () => { await prisma.$disconnect(); });

  it('rejects a login with a missing password (clean 400 with details)', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@hrms.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(Array.isArray(res.body.details)).toBe(true);
  });

  it('still accepts a well-formed login', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@hrms.com', password: 'admin123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it('strips unknown fields from the validated body', async () => {
    // extra junk should not block a valid login
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@hrms.com', password: 'admin123', isAdmin: true, role: 'SUPER_ADMIN' });
    expect(res.status).toBe(200);
  });
});

describe('Operational route validation (leave / timesheet / expense)', () => {
  let employeeToken, employeeId;

  beforeAll(async () => {
    const e = await request(app).post('/api/auth/login').send({ email: 'rajesh.kumar@company.com', password: 'employee123' });
    employeeToken = e.body.token;
    const emp = await prisma.employee.findUnique({ where: { email: 'rajesh.kumar@company.com' } });
    employeeId = emp.id;
  });

  it('rejects a leave request missing endDate before the handler runs', async () => {
    const res = await request(app)
      .post('/api/leave')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ employeeId, leaveType: 'ANNUAL', startDate: '2099-03-02' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.details.some((d) => d.field === 'endDate')).toBe(true);
  });

  it('rejects a timesheet with non-numeric hours', async () => {
    const res = await request(app)
      .post('/api/timesheet')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ employeeId, date: '2099-03-02', hoursWorked: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('rejects an expense claim with a non-numeric amount', async () => {
    const res = await request(app)
      .post('/api/expenses/claims')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ title: 'Bad amount', category: 'TRAVEL', amount: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });
});

describe('parsePagination', () => {
  it('applies safe defaults', () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: 50, skip: 0 });
  });
  it('coerces strings and computes skip', () => {
    expect(parsePagination({ page: '3', limit: '20' })).toEqual({ page: 3, limit: 20, skip: 40 });
  });
  it('clamps absurd values to defaults rather than trusting them', () => {
    const out = parsePagination({ page: '-5', limit: '100000' });
    expect(out.page).toBe(1);   // invalid -> default
    expect(out.limit).toBe(50); // invalid -> default
  });
});
