/**
 * End-to-end behavioural coverage for the recruitment / ATS module:
 * job-opening CRUD + RBAC, public application (with duplicate/closed/validation
 * guards), stage transitions, interview scheduling + feedback, job offers (+ PDF),
 * and the HIRED -> auto-provision employee/onboarding automation.
 */

const request = require('supertest');
const app = require('../src/index');
const prisma = require('../src/config/database');

const stamp = `${Date.now()}`.slice(-9);
const JOB_TITLE = `QA ATS Role ${stamp}`;
const CLOSED_TITLE = `QA ATS Closed ${stamp}`;
const CAND_EMAIL = `cand-${stamp}@example.com`;
const CAND_PHONE = '9876500000';

describe('Recruitment / ATS pipeline', () => {
  let adminToken, empToken, departmentId;
  let jobId, closedJobId, applicantId, interviewId, offerId;

  const cleanup = async () => {
    // Auto-provisioned employee/user from the HIRED step (not cascaded by job delete).
    const emp = await prisma.employee.findUnique({ where: { email: CAND_EMAIL } }).catch(() => null);
    if (emp) {
      await prisma.employeeChecklistTask.deleteMany({ where: { employeeId: emp.id } }).catch(() => {});
      await prisma.employee.delete({ where: { id: emp.id } }).catch(() => {});
    }
    const user = await prisma.user.findUnique({ where: { email: CAND_EMAIL } }).catch(() => null);
    if (user) {
      // Permission rows hold an FK to the user; remove them before the user.
      await prisma.permission.deleteMany({ where: { userId: user.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    }
    // Deleting the job cascades applicants -> interviews/offers.
    await prisma.jobOpening.deleteMany({ where: { title: { in: [JOB_TITLE, CLOSED_TITLE] } } }).catch(() => {});
  };

  beforeAll(async () => {
    await cleanup();
    adminToken = (await request(app).post('/api/auth/login').send({ email: 'admin@hrms.com', password: 'admin123' })).body.token;
    empToken = (await request(app).post('/api/auth/login').send({ email: 'amit.patel@company.com', password: 'employee123' })).body.token;
    departmentId = (await prisma.department.findFirst()).id;
  });

  afterAll(async () => { await cleanup(); await prisma.$disconnect(); });

  const jobBody = (over = {}) => ({
    title: JOB_TITLE, departmentId, description: 'Build things', requirements: 'Node, React',
    location: 'Bengaluru', employmentType: 'FULL_TIME', status: 'OPEN', ...over,
  });

  // ── Job openings + RBAC ──────────────────────────────────────────────────────
  it('creates a job opening (admin) and rejects missing fields', async () => {
    const res = await request(app).post('/api/recruitment/jobs').set('Authorization', `Bearer ${adminToken}`).send(jobBody());
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('OPEN');
    jobId = res.body.id;

    const bad = await request(app).post('/api/recruitment/jobs').set('Authorization', `Bearer ${adminToken}`).send({ title: 'x' });
    expect(bad.status).toBe(400);
  });

  it('blocks a plain employee from creating a job opening (RBAC)', async () => {
    const res = await request(app).post('/api/recruitment/jobs').set('Authorization', `Bearer ${empToken}`).send(jobBody());
    expect(res.status).toBe(403);
  });

  it('lists openings with applicant counts and fetches one by id', async () => {
    const list = await request(app).get('/api/recruitment/jobs').set('Authorization', `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    expect(list.body.some((j) => j.id === jobId)).toBe(true);

    const one = await request(app).get(`/api/recruitment/jobs/${jobId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(one.status).toBe(200);
    expect(Array.isArray(one.body.applicants)).toBe(true);
  });

  // ── Public application + guards ───────────────────────────────────────────────
  it('accepts a public application and assigns APPLIED stage', async () => {
    const res = await request(app).post('/api/recruitment/applicants')
      .field('jobOpeningId', jobId).field('fullName', 'Test Candidate').field('email', CAND_EMAIL).field('phone', CAND_PHONE);
    expect(res.status).toBe(201);
    expect(res.body.stage).toBe('APPLIED');
    applicantId = res.body.id;
  });

  it('rejects a duplicate application to the same opening', async () => {
    const res = await request(app).post('/api/recruitment/applicants')
      .field('jobOpeningId', jobId).field('fullName', 'Dup').field('email', CAND_EMAIL).field('phone', CAND_PHONE);
    expect(res.status).toBe(400);
  });

  it('rejects applications to a CLOSED opening and to a missing opening', async () => {
    const closed = await request(app).post('/api/recruitment/jobs').set('Authorization', `Bearer ${adminToken}`).send(jobBody({ title: CLOSED_TITLE, status: 'CLOSED' }));
    closedJobId = closed.body.id;

    const toClosed = await request(app).post('/api/recruitment/applicants')
      .field('jobOpeningId', closedJobId).field('fullName', 'Late').field('email', `late-${stamp}@x.com`).field('phone', '9000000001');
    expect(toClosed.status).toBe(400);

    const toMissing = await request(app).post('/api/recruitment/applicants')
      .field('jobOpeningId', 'does-not-exist').field('fullName', 'Ghost').field('email', `ghost-${stamp}@x.com`).field('phone', '9000000002');
    expect(toMissing.status).toBe(404);
  });

  // ── Stage transitions, interviews, offers ─────────────────────────────────────
  it('moves the applicant to SCREENING (admin)', async () => {
    const res = await request(app).put(`/api/recruitment/applicants/${applicantId}/stage`).set('Authorization', `Bearer ${adminToken}`).send({ stage: 'SCREENING', rating: 4 });
    expect(res.status).toBe(200);
    expect(res.body.stage).toBe('SCREENING');
  });

  it('schedules an interview and auto-transitions the applicant to INTERVIEW', async () => {
    const res = await request(app).post('/api/recruitment/interviews').set('Authorization', `Bearer ${adminToken}`)
      .send({ applicantId, interviewerName: 'Meera Joshi', interviewDate: '2099-07-01T10:00:00.000Z', roundName: 'Technical Round 1' });
    expect(res.status).toBe(201);
    interviewId = res.body.id;

    const applicant = await prisma.jobApplicant.findUnique({ where: { id: applicantId } });
    expect(applicant.stage).toBe('INTERVIEW');

    const bad = await request(app).post('/api/recruitment/interviews').set('Authorization', `Bearer ${adminToken}`).send({ applicantId });
    expect(bad.status).toBe(400);
  });

  it('records interview feedback and rating', async () => {
    const res = await request(app).put(`/api/recruitment/interviews/${interviewId}`).set('Authorization', `Bearer ${adminToken}`)
      .send({ feedback: 'Strong systems design', rating: 5, status: 'COMPLETED' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('COMPLETED');
    expect(res.body.rating).toBe(5);
  });

  it('creates a job offer, rejects a past joining date, and downloads the PDF', async () => {
    const past = await request(app).post('/api/recruitment/offers').set('Authorization', `Bearer ${adminToken}`)
      .send({ applicantId, offeredSalary: 900000, joiningDate: '2000-01-01' });
    expect(past.status).toBe(400);

    const res = await request(app).post('/api/recruitment/offers').set('Authorization', `Bearer ${adminToken}`)
      .send({ applicantId, offeredSalary: 900000, joiningDate: '2099-08-01' });
    expect(res.status).toBe(201);
    offerId = res.body.id;

    const applicant = await prisma.jobApplicant.findUnique({ where: { id: applicantId } });
    expect(applicant.stage).toBe('OFFER');

    const pdf = await request(app).get(`/api/recruitment/offers/${offerId}/pdf`).set('Authorization', `Bearer ${adminToken}`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toMatch(/application\/pdf/);
  });

  // ── HIRED -> auto-provision employee + onboarding ─────────────────────────────
  it('auto-provisions an ONBOARDING employee when the applicant is HIRED', async () => {
    const res = await request(app).put(`/api/recruitment/applicants/${applicantId}/stage`).set('Authorization', `Bearer ${adminToken}`).send({ stage: 'HIRED' });
    expect(res.status).toBe(200);

    const emp = await prisma.employee.findUnique({ where: { email: CAND_EMAIL } });
    expect(emp).toBeTruthy();
    expect(emp.accountStage).toBe('ONBOARDING');

    const user = await prisma.user.findUnique({ where: { email: CAND_EMAIL } });
    expect(user.mustChangePassword).toBe(true);
  });
});
