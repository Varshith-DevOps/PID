const request = require('supertest');
const app = require('../src/index');
const prisma = require('../src/config/database');

const TEST_EMAIL = 'dpdp.subject@validation.local';

async function purgeEmployee(emp) {
  if (!emp) return;
  for (const del of [
    () => prisma.bankDetails.deleteMany({ where: { employeeId: emp.id } }),
    () => prisma.employeeAddress.deleteMany({ where: { employeeId: emp.id } }),
    () => prisma.education.deleteMany({ where: { employeeId: emp.id } }),
    () => prisma.professionalExperience.deleteMany({ where: { employeeId: emp.id } }),
    () => prisma.dependent.deleteMany({ where: { employeeId: emp.id } }),
    () => prisma.pFDetails.deleteMany({ where: { employeeId: emp.id } }),
    () => prisma.changeHistory.deleteMany({ where: { employeeId: emp.id } }),
  ]) { await del().catch(() => {}); }
  await prisma.employee.delete({ where: { id: emp.id } }).catch(() => {});
  if (emp.userId) {
    await prisma.permission.deleteMany({ where: { userId: emp.userId } }).catch(() => {});
    await prisma.user.delete({ where: { id: emp.userId } }).catch(() => {});
  }
}

async function cleanup() {
  const emps = await prisma.employee.findMany({
    where: { OR: [{ email: TEST_EMAIL }, { email: { startsWith: 'anonymized+' } }] },
  }).catch(() => []);
  for (const emp of emps) await purgeEmployee(emp);
  const u = await prisma.user.findUnique({ where: { email: TEST_EMAIL } }).catch(() => null);
  if (u) { await prisma.permission.deleteMany({ where: { userId: u.id } }).catch(() => {}); await prisma.user.delete({ where: { id: u.id } }).catch(() => {}); }
}

describe('DPDP / privacy rights', () => {
  let adminToken, employeeToken, empId;

  beforeAll(async () => {
    await cleanup();
    const a = await request(app).post('/api/auth/login').send({ email: 'admin@hrms.com', password: 'admin123' });
    adminToken = a.body.token;
    const e = await request(app).post('/api/auth/login').send({ email: 'rajesh.kumar@company.com', password: 'employee123' });
    employeeToken = e.body.token;

    const dept = await prisma.department.findFirst();
    const created = await request(app).post('/api/employees').set('Authorization', `Bearer ${adminToken}`)
      .send({ firstName: 'Dee', lastName: 'Pedee', email: TEST_EMAIL, jobTitle: 'QA', departmentId: dept?.id, salary: 500000, panNumber: 'ABCDE1234F' });
    empId = created.body.id;
    await request(app).put(`/api/employees/${empId}/bank-details`).set('Authorization', `Bearer ${adminToken}`)
      .send({ bankName: 'Test Bank', accountNumber: '123456789012', ifscCode: 'SBIN0001234' }).catch(() => {});
  });

  afterAll(async () => { await cleanup(); await prisma.$disconnect(); });

  it('exports the data subject\'s personal data (right to access)', async () => {
    const res = await request(app).get(`/api/employees/${empId}/data-export`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const payload = typeof res.body === 'object' && res.body.profile ? res.body : JSON.parse(res.text);
    expect(payload.profile.email).toBe(TEST_EMAIL);
    expect(payload.profile.panNumber).toBe('ABCDE1234F'); // decrypted for the subject
    expect(Array.isArray(payload.attendance)).toBe(true);
    expect(Array.isArray(payload.payrollRecords)).toBe(true);
  });

  it('blocks a different employee from exporting someone else\'s data', async () => {
    const res = await request(app).get(`/api/employees/${empId}/data-export`).set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(403);
  });

  it('erases (anonymizes) PII while retaining the row for statutory records', async () => {
    const res = await request(app).post(`/api/employees/${empId}/anonymize`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    const emp = await prisma.employee.findUnique({ where: { id: empId }, include: { bankDetails: true, user: true } });
    expect(emp.firstName).toBe('Redacted');
    expect(emp.panNumber).toBeNull();
    expect(emp.aadharNumber).toBeNull();
    expect(emp.isActive).toBe(false);
    expect(emp.anonymizedAt).not.toBeNull();
    expect(emp.bankDetails).toBeNull();      // PII sub-record deleted
    expect(emp.user.isActive).toBe(false);   // login disabled
  });

  it('blocks a non-admin from erasing personal data', async () => {
    const res = await request(app).post(`/api/employees/${empId}/anonymize`).set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(403);
  });
});
