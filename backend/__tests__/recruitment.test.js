/**
 * End-to-end behavioural coverage for the recruitment / ATS module:
 * job-opening CRUD + RBAC, public application (with duplicate/closed/validation
 * guards), stage transitions, interview scheduling + feedback, job offers (+ PDF),
 * and the ONBOARDING -> auto-provision employee/onboarding automation.
 */

const request = require('supertest');
const app = require('../src/index');
const prisma = require('../src/config/database');
const { writeOfferPdf } = require('../src/services/offerLetterStorageService');

const stamp = `${Date.now()}`.slice(-9);
const JOB_TITLE = `QA ATS Role ${stamp}`;
const CLOSED_TITLE = `QA ATS Closed ${stamp}`;
const CAND_EMAIL = `cand-${stamp}@example.com`;
const CAND_PHONE = '9876500000';

describe('Recruitment / ATS pipeline', () => {
  let adminToken, empToken, departmentId;
  let jobId, closedJobId, applicantId, interviewId, offerId;

  const cleanup = async () => {
    // Auto-provisioned employee/user from the ONBOARDING step (not cascaded by job delete).
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
    await prisma.notification.deleteMany({ where: { recipientEmail: CAND_EMAIL } }).catch(() => {});
    // Test cleanup can cascade. Runtime delete endpoints must not.
    await prisma.jobOpening.deleteMany({ where: { title: { contains: stamp } } }).catch(() => {});
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

  it('allows deleting only an empty job requisition with DELETE confirmation', async () => {
    const empty = await request(app)
      .post('/api/recruitment/jobs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(jobBody({ title: `QA ATS Empty Delete ${stamp}` }));
    expect(empty.status).toBe(201);

    const forbidden = await request(app)
      .post(`/api/recruitment/jobs/${empty.body.id}/delete`)
      .set('Authorization', `Bearer ${empToken}`)
      .send({ confirmation: 'DELETE' });
    expect(forbidden.status).toBe(403);

    const missingConfirmation = await request(app)
      .post(`/api/recruitment/jobs/${empty.body.id}/delete`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ confirmation: 'delete' });
    expect(missingConfirmation.status).toBe(400);
    expect(missingConfirmation.body.error).toBe('Type DELETE to confirm.');

    const deleted = await request(app)
      .post(`/api/recruitment/jobs/${empty.body.id}/delete`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ confirmation: 'DELETE' });
    expect(deleted.status).toBe(200);
    expect(deleted.body.message).toBe('Job requisition deleted successfully.');

    const job = await prisma.jobOpening.findUnique({ where: { id: empty.body.id } });
    expect(job).toBeNull();
  });

  // ── Public application + guards ───────────────────────────────────────────────
  it('rejects career portal applications missing compensation fields', async () => {
    const missingCurrent = await request(app).post('/api/recruitment/applicants')
      .field('jobOpeningId', jobId).field('fullName', 'Missing Current').field('email', `missing-current-${stamp}@example.com`).field('phone', '9000000003')
      .field('expectedCtc', '9 LPA').field('noticePeriod', '30 Days');
    expect(missingCurrent.status).toBe(400);
    expect(missingCurrent.body.error).toBe('Current CTC is required.');

    const missingExpected = await request(app).post('/api/recruitment/applicants')
      .field('jobOpeningId', jobId).field('fullName', 'Missing Expected').field('email', `missing-expected-${stamp}@example.com`).field('phone', '9000000004')
      .field('currentCtc', '6 LPA').field('noticePeriod', '30 Days');
    expect(missingExpected.status).toBe(400);
    expect(missingExpected.body.error).toBe('Expected CTC is required.');

    const missingNotice = await request(app).post('/api/recruitment/applicants')
      .field('jobOpeningId', jobId).field('fullName', 'Missing Notice').field('email', `missing-notice-${stamp}@example.com`).field('phone', '9000000005')
      .field('currentCtc', '6 LPA').field('expectedCtc', '9 LPA');
    expect(missingNotice.status).toBe(400);
    expect(missingNotice.body.error).toBe('Notice Period is required.');
  });

  it('rejects negative CTC values and invalid notice periods', async () => {
    const negative = await request(app).post('/api/recruitment/applicants')
      .field('jobOpeningId', jobId).field('fullName', 'Negative CTC').field('email', `negative-${stamp}@example.com`).field('phone', '9000000006')
      .field('currentCtc', '6 LPA').field('expectedCtc', '-9 LPA').field('noticePeriod', '30 Days');
    expect(negative.status).toBe(400);
    expect(negative.body.error).toBe('Expected CTC cannot be negative.');

    const invalidNotice = await request(app).post('/api/recruitment/applicants')
      .field('jobOpeningId', jobId).field('fullName', 'Invalid Notice').field('email', `invalid-notice-${stamp}@example.com`).field('phone', '9000000007')
      .field('currentCtc', '6 LPA').field('expectedCtc', '9 LPA').field('noticePeriod', 'Tomorrow');
    expect(invalidNotice.status).toBe(400);
    expect(invalidNotice.body.error).toBe('Select a valid Notice Period.');
  });

  it('accepts a public application and assigns APPLIED stage', async () => {
    const res = await request(app).post('/api/recruitment/applicants')
      .field('jobOpeningId', jobId).field('fullName', 'Test Candidate').field('email', CAND_EMAIL).field('phone', CAND_PHONE)
      .field('experience', '3 years').field('skills', 'Java, Spring Boot, SQL')
      .field('currentCtc', '8.5 LPA').field('expectedCtc', '900000').field('noticePeriod', '30 Days');
    expect(res.status).toBe(201);
    expect(res.body.stage).toBe('APPLIED');
    expect(res.body.currentCtc).toBe('8.5 LPA');
    expect(res.body.expectedCtc).toBe('900000');
    expect(res.body.noticePeriod).toBe('30 Days');
    applicantId = res.body.id;
  });

  it('rejects a duplicate application to the same opening', async () => {
    const res = await request(app).post('/api/recruitment/applicants')
      .field('jobOpeningId', jobId).field('fullName', 'Dup').field('email', CAND_EMAIL).field('phone', CAND_PHONE)
      .field('currentCtc', '6 LPA').field('expectedCtc', '9 LPA').field('noticePeriod', '30 Days');
    expect(res.status).toBe(400);
  });

  it('allows an active candidate to move to Archived / Rejected', async () => {
    const candidate = await request(app).post('/api/recruitment/applicants')
      .field('jobOpeningId', jobId).field('fullName', 'Archive Candidate').field('email', `archive-${stamp}@example.com`).field('phone', '9000000008')
      .field('currentCtc', '5 LPA').field('expectedCtc', '7 LPA').field('noticePeriod', '15 Days');
    expect(candidate.status).toBe(201);

    const rejected = await request(app).put(`/api/recruitment/applicants/${candidate.body.id}/stage`).set('Authorization', `Bearer ${adminToken}`).send({ stage: 'REJECTED' });
    expect(rejected.status).toBe(200);
    expect(rejected.body.stage).toBe('REJECTED');
  });

  it('rejects applications to a CLOSED opening and to a missing opening', async () => {
    const closed = await request(app).post('/api/recruitment/jobs').set('Authorization', `Bearer ${adminToken}`).send(jobBody({ title: CLOSED_TITLE, status: 'CLOSED' }));
    closedJobId = closed.body.id;

    const toClosed = await request(app).post('/api/recruitment/applicants')
      .field('jobOpeningId', closedJobId).field('fullName', 'Late').field('email', `late-${stamp}@x.com`).field('phone', '9000000001')
      .field('currentCtc', '6 LPA').field('expectedCtc', '9 LPA').field('noticePeriod', '30 Days');
    expect(toClosed.status).toBe(400);

    const toMissing = await request(app).post('/api/recruitment/applicants')
      .field('jobOpeningId', 'does-not-exist').field('fullName', 'Ghost').field('email', `ghost-${stamp}@x.com`).field('phone', '9000000002')
      .field('currentCtc', '6 LPA').field('expectedCtc', '9 LPA').field('noticePeriod', '30 Days');
    expect(toMissing.status).toBe(404);
  });

  // ── Stage transitions, interviews, offers ─────────────────────────────────────
  it('moves the applicant to SCREENING (admin)', async () => {
    const res = await request(app).put(`/api/recruitment/applicants/${applicantId}/stage`).set('Authorization', `Bearer ${adminToken}`).send({ stage: 'SCREENING', rating: 4 });
    expect(res.status).toBe(200);
    expect(res.body.stage).toBe('SCREENING');
  });

  it('updates candidate evaluation without changing stage', async () => {
    const before = await prisma.jobApplicant.findUnique({ where: { id: applicantId } });
    const res = await request(app)
      .patch(`/api/recruitment/applicants/${applicantId}/evaluation`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        rating: 5,
        reviewNotes: ' Strong Java and Spring Boot knowledge. ',
        updatedAt: before.updatedAt.toISOString(),
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.candidate.rating).toBe(5);
    expect(res.body.candidate.reviewNotes).toBe('Strong Java and Spring Boot knowledge.');
    expect(res.body.candidate.stage).toBe('SCREENING');

    const after = await prisma.jobApplicant.findUnique({ where: { id: applicantId } });
    expect(after.stage).toBe('SCREENING');
    expect(after.notes).toBe('Strong Java and Spring Boot knowledge.');
  });

  it('rejects stale candidate evaluation saves', async () => {
    const res = await request(app)
      .patch(`/api/recruitment/applicants/${applicantId}/evaluation`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        rating: 3,
        reviewNotes: 'Stale update',
        updatedAt: '2000-01-01T00:00:00.000Z',
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('This record was updated by another user. Refresh before saving.');
  });

  it('creates separate candidate review history records without changing stage', async () => {
    const before = await prisma.jobApplicant.findUnique({ where: { id: applicantId } });
    const first = await request(app)
      .post(`/api/recruitment/applicants/${applicantId}/reviews`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rating: 4, reviewText: 'Communication and technical fundamentals are good.' });
    expect(first.status).toBe(201);
    expect(first.body.success).toBe(true);
    expect(first.body.review.reviewerName).toBe('Admin User');
    expect(first.body.review.reviewerRole).toBe('ADMIN');
    expect(first.body.review.candidateStage).toBe(before.stage);

    const second = await request(app)
      .post(`/api/recruitment/applicants/${applicantId}/reviews`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rating: 5, reviewText: 'Strong Java, Spring Boot and SQL knowledge.' });
    expect(second.status).toBe(201);

    const after = await prisma.jobApplicant.findUnique({ where: { id: applicantId } });
    expect(after.stage).toBe(before.stage);

    const list = await request(app)
      .get(`/api/recruitment/applicants/${applicantId}/reviews`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    expect(list.body.reviews.length).toBeGreaterThanOrEqual(2);
    expect(list.body.reviews[0].reviewText).toBe('Strong Java, Spring Boot and SQL knowledge.');
    expect(list.body.reviews[1].reviewText).toBe('Communication and technical fundamentals are good.');
  });

  it('validates candidate review history payloads and RBAC', async () => {
    const empty = await request(app)
      .post(`/api/recruitment/applicants/${applicantId}/reviews`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rating: 4, reviewText: '   ' });
    expect(empty.status).toBe(400);

    const invalidRating = await request(app)
      .post(`/api/recruitment/applicants/${applicantId}/reviews`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rating: 6, reviewText: 'Invalid rating' });
    expect(invalidRating.status).toBe(400);

    const forbidden = await request(app)
      .post(`/api/recruitment/applicants/${applicantId}/reviews`)
      .set('Authorization', `Bearer ${empToken}`)
      .send({ rating: 4, reviewText: 'Should not be allowed' });
    expect(forbidden.status).toBe(403);
  });

  it('rejects a direct backward transition from SCREENING to APPLIED', async () => {
    const res = await request(app).put(`/api/recruitment/applicants/${applicantId}/stage`).set('Authorization', `Bearer ${adminToken}`).send({ stage: 'APPLIED' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Candidate can only move forward in the recruitment pipeline.');
  });

  it('allows skipping forward stages in the active pipeline', async () => {
    const candidate = await request(app).post('/api/recruitment/applicants')
      .field('jobOpeningId', jobId).field('fullName', 'Skip Candidate').field('email', `skip-${stamp}@example.com`).field('phone', '9000000009')
      .field('currentCtc', '7 LPA').field('expectedCtc', '10 LPA').field('noticePeriod', '30 Days');
    expect(candidate.status).toBe(201);

    const screening = await request(app).put(`/api/recruitment/applicants/${candidate.body.id}/stage`).set('Authorization', `Bearer ${adminToken}`).send({ stage: 'SCREENING' });
    expect(screening.status).toBe(200);

    const offer = await request(app).put(`/api/recruitment/applicants/${candidate.body.id}/stage`).set('Authorization', `Bearer ${adminToken}`).send({ stage: 'OFFER' });
    expect(offer.status).toBe(200);
    expect(offer.body.stage).toBe('OFFER');
  });

  it('rejects interview scheduling for an APPLIED candidate without changing stage', async () => {
    const candidate = await request(app).post('/api/recruitment/applicants')
      .field('jobOpeningId', jobId).field('fullName', 'Applied Interview').field('email', `applied-interview-${stamp}@example.com`).field('phone', '9000000010')
      .field('currentCtc', '6 LPA').field('expectedCtc', '9 LPA').field('noticePeriod', '30 Days');
    expect(candidate.status).toBe(201);

    const res = await request(app).post('/api/recruitment/interviews').set('Authorization', `Bearer ${adminToken}`)
      .send({ applicantId: candidate.body.id, interviewerName: 'Nisha Rao', interviewDate: '2099-07-02T10:00:00.000Z', roundName: 'Technical Round 1', interviewMode: 'PHONE' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      message: 'Interview rounds can only be scheduled when the candidate is in the Interviews stage.',
    });

    const applicant = await prisma.jobApplicant.findUnique({
      where: { id: candidate.body.id },
      include: { interviews: true },
    });
    expect(applicant.stage).toBe('APPLIED');
    expect(applicant.interviews).toHaveLength(0);
  });

  it('schedules an interview after the applicant is moved to INTERVIEW', async () => {
    const stage = await request(app).put(`/api/recruitment/applicants/${applicantId}/stage`).set('Authorization', `Bearer ${adminToken}`).send({ stage: 'INTERVIEW' });
    expect(stage.status).toBe(200);
    expect(stage.body.stage).toBe('INTERVIEW');

    const res = await request(app).post('/api/recruitment/interviews').set('Authorization', `Bearer ${adminToken}`)
      .send({ applicantId, interviewerName: 'Meera Joshi', interviewDate: '2099-07-01T10:00:00.000Z', roundName: 'Technical Round 1', interviewMode: 'ONLINE', meetingLink: 'https://meet.example.com/main' });
    expect(res.status).toBe(201);
    expect(res.body.interview.emailStatus).toBe('QUEUED');
    expect(res.body.interview.meetingLink).toBe('https://meet.example.com/main');
    interviewId = res.body.interview.id;

    const queuedEmail = await prisma.notification.findFirst({
      where: { type: 'INTERVIEW_SCHEDULED', recipientId: applicantId, channel: 'EMAIL' },
    });
    expect(queuedEmail).toBeTruthy();

    const applicant = await prisma.jobApplicant.findUnique({ where: { id: applicantId } });
    expect(applicant.stage).toBe('INTERVIEW');

    const bad = await request(app).post('/api/recruitment/interviews').set('Authorization', `Bearer ${adminToken}`).send({ applicantId });
    expect(bad.status).toBe(400);
  });

  it('schedules an additional interview for a candidate already in INTERVIEW without stage errors', async () => {
    const before = await prisma.interview.count({ where: { applicantId } });

    const res = await request(app).post('/api/recruitment/interviews').set('Authorization', `Bearer ${adminToken}`)
      .send({ applicantId, interviewerName: 'Ravi Shah', interviewDate: '2099-07-03T10:00:00.000Z', roundName: 'System Design & Architecture', interviewMode: 'IN_PERSON', location: 'PID HCMS Office' });
    expect(res.status).toBe(201);
    expect(res.body.interview.location).toBe('PID HCMS Office');

    const applicant = await prisma.jobApplicant.findUnique({ where: { id: applicantId } });
    const after = await prisma.interview.count({ where: { applicantId } });
    expect(applicant.stage).toBe('INTERVIEW');
    expect(after).toBe(before + 1);
  });

  it('rejects interview scheduling in the past', async () => {
    const before = await prisma.interview.count({ where: { applicantId } });
    const res = await request(app).post('/api/recruitment/interviews').set('Authorization', `Bearer ${adminToken}`)
      .send({ applicantId, interviewerName: 'Past Person', interviewDate: '2000-01-01T10:00:00.000Z', roundName: 'Technical Round 1', interviewMode: 'PHONE' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Please select a future interview date and time.');

    const after = await prisma.interview.count({ where: { applicantId } });
    expect(after).toBe(before);
  });

  it('rejects a direct backward transition from INTERVIEW to SCREENING', async () => {
    const res = await request(app).put(`/api/recruitment/applicants/${applicantId}/stage`).set('Authorization', `Bearer ${adminToken}`).send({ stage: 'SCREENING' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Candidate can only move forward in the recruitment pipeline.');
  });

  it('records interview feedback and rating', async () => {
    const res = await request(app).put(`/api/recruitment/interviews/${interviewId}`).set('Authorization', `Bearer ${adminToken}`)
      .send({ feedback: 'Strong systems design', rating: 5, status: 'COMPLETED' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('COMPLETED');
    expect(res.body.rating).toBe(5);
  });

  it('moves an INTERVIEW candidate to HIRED without provisioning onboarding yet', async () => {
    const res = await request(app).put(`/api/recruitment/applicants/${applicantId}/stage`).set('Authorization', `Bearer ${adminToken}`).send({ stage: 'HIRED' });
    expect(res.status).toBe(200);
    expect(res.body.stage).toBe('HIRED');

    const emp = await prisma.employee.findUnique({ where: { email: CAND_EMAIL } });
    expect(emp).toBeFalsy();
  });

  it('blocks interview scheduling after the candidate has been hired', async () => {
    const before = await prisma.interview.count({ where: { applicantId } });
    const res = await request(app).post('/api/recruitment/interviews').set('Authorization', `Bearer ${adminToken}`)
      .send({ applicantId, interviewerName: 'Late Interviewer', interviewDate: '2099-07-04T10:00:00.000Z', roundName: 'HR & Culture Round', interviewMode: 'PHONE' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      message: 'Interview rounds can only be scheduled when the candidate is in the Interviews stage.',
    });

    const after = await prisma.interview.count({ where: { applicantId } });
    expect(after).toBe(before);
  });

  it('moves a HIRED candidate to OFFER', async () => {
    const res = await request(app).put(`/api/recruitment/applicants/${applicantId}/stage`).set('Authorization', `Bearer ${adminToken}`).send({ stage: 'OFFER' });
    expect(res.status).toBe(200);
    expect(res.body.stage).toBe('OFFER');
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

  it('creates and shares a generated offer without an expiry date safely', async () => {
    const candidate = await request(app).post('/api/recruitment/applicants')
      .field('jobOpeningId', jobId).field('fullName', 'Optional Expiry Candidate').field('email', `optional-expiry-${stamp}@example.com`).field('phone', '9000000011')
      .field('currentCtc', '8 LPA').field('expectedCtc', '12 LPA').field('noticePeriod', '30 Days');
    expect(candidate.status).toBe(201);

    const moved = await request(app).put(`/api/recruitment/applicants/${candidate.body.id}/stage`)
      .set('Authorization', `Bearer ${adminToken}`).send({ stage: 'OFFER' });
    expect(moved.status).toBe(200);

    const offerPayload = {
      offeredCtc: 1200000,
      basicSalary: 600000,
      hra: 240000,
      specialAllowance: 360000,
      workLocation: 'Bengaluru',
      employmentType: 'FULL_TIME',
      joiningDate: '2099-08-01',
      offerExpiryDate: null,
      reportingManager: 'Admin User',
      signatoryName: 'Admin User',
      signatoryDesignation: 'HR',
    };

    const created = await request(app).post(`/api/recruitment/applicants/${candidate.body.id}/offers`)
      .set('Authorization', `Bearer ${adminToken}`).send(offerPayload);
    expect(created.status).toBe(201);
    expect(created.body.offerExpiryDate).toBeNull();

    const invalidExpiry = await request(app).patch(`/api/recruitment/offers/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`).send({ ...offerPayload, offerExpiryDate: 'not-a-date', updatedAt: created.body.updatedAt });
    expect(invalidExpiry.status).toBe(400);
    expect(invalidExpiry.body.error).toBe('Offer expiry date is invalid.');

    const lateExpiry = await request(app).patch(`/api/recruitment/offers/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`).send({ ...offerPayload, offerExpiryDate: '2099-08-02', updatedAt: created.body.updatedAt });
    expect(lateExpiry.status).toBe(400);
    expect(lateExpiry.body.error).toBe('Offer expiry date must be before the joining date.');

    const stored = await writeOfferPdf({
      offerId: created.body.id,
      fileName: 'Offer-Letter-Optional-Expiry-Candidate.pdf',
      buffer: Buffer.from('%PDF-1.4\n% Test offer PDF\n'),
    });
    const generated = await prisma.jobOffer.update({
      where: { id: created.body.id },
      data: {
        status: 'GENERATED',
        pdfFileName: stored.fileName,
        pdfStorageKey: stored.storageKey,
        offerLetter: stored.storageKey,
      },
    });
    expect(generated.pdfStorageKey).toBeTruthy();

    const forbidden = await request(app).post(`/api/recruitment/offers/${created.body.id}/send`)
      .set('Authorization', `Bearer ${empToken}`);
    expect(forbidden.status).toBe(403);

    const sent = await request(app).post(`/api/recruitment/offers/${created.body.id}/send`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(sent.status).toBe(200);
    expect(sent.body.emailStatus).toBe('FAILED');
    expect(sent.body.status).toBe('GENERATED');
    expect(sent.body.pdfStorageKey).toBe(generated.pdfStorageKey);
    expect(sent.body.publicTokenHash).toBeTruthy();

    const resend = await request(app).post(`/api/recruitment/offers/${created.body.id}/resend`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resend.status).toBe(200);
    expect(resend.body.emailStatus).toBe('FAILED');
    expect(resend.body.pdfStorageKey).toBe(generated.pdfStorageKey);

    const offers = await prisma.jobOffer.findMany({ where: { applicantId: candidate.body.id } });
    expect(offers).toHaveLength(1);

    const applicant = await prisma.jobApplicant.findUnique({ where: { id: candidate.body.id } });
    expect(applicant.stage).toBe('OFFER');
  });

  it('resends a failed interview email without creating another interview round', async () => {
    const before = await prisma.interview.count({ where: { applicantId } });
    const res = await request(app).post(`/api/recruitment/interviews/${interviewId}/resend-email`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.emailStatus).toBe('QUEUED');

    const after = await prisma.interview.count({ where: { applicantId } });
    expect(after).toBe(before);
  });

  it('rejects a direct backward transition from OFFER to HIRED', async () => {
    const res = await request(app).put(`/api/recruitment/applicants/${applicantId}/stage`).set('Authorization', `Bearer ${adminToken}`).send({ stage: 'HIRED' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Candidate can only move forward in the recruitment pipeline.');
  });

  // ── ONBOARDING -> auto-provision employee + onboarding ────────────────────────
  it('auto-provisions an ONBOARDING employee when the applicant reaches ONBOARDING', async () => {
    const res = await request(app).put(`/api/recruitment/applicants/${applicantId}/stage`).set('Authorization', `Bearer ${adminToken}`).send({ stage: 'ONBOARDING' });
    expect(res.status).toBe(200);
    expect(res.body.stage).toBe('ONBOARDING');

    const emp = await prisma.employee.findUnique({ where: { email: CAND_EMAIL } });
    expect(emp).toBeTruthy();
    expect(emp.accountStage).toBe('ONBOARDING');

    const user = await prisma.user.findUnique({ where: { email: CAND_EMAIL } });
    expect(user.mustChangePassword).toBe(true);
  });

  it('allows an ONBOARDING candidate to move to Archived / Rejected', async () => {
    const res = await request(app).put(`/api/recruitment/applicants/${applicantId}/stage`).set('Authorization', `Bearer ${adminToken}`).send({ stage: 'REJECTED' });
    expect(res.status).toBe(200);
    expect(res.body.stage).toBe('REJECTED');
  });

  it('rejects movement after Archived / Rejected', async () => {
    const res = await request(app).put(`/api/recruitment/applicants/${applicantId}/stage`).set('Authorization', `Bearer ${adminToken}`).send({ stage: 'ONBOARDING' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Candidate can only move forward in the recruitment pipeline.');
  });

  it('expires an open job safely and preserves recruitment history', async () => {
    const beforeJobs = await request(app).get('/api/recruitment/jobs').set('Authorization', `Bearer ${adminToken}`);
    const beforeActive = beforeJobs.body.filter((job) => job.status === 'OPEN').length;
    const beforeClosed = beforeJobs.body.filter((job) => job.status === 'CLOSED').length;

    const expired = await request(app)
      .patch(`/api/recruitment/jobs/${jobId}/expire`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'POSITION_FILLED', remarks: 'Hiring completed.' });
    expect(expired.status).toBe(200);
    expect(expired.body.message).toBe('Job requisition expired successfully.');
    expect(expired.body.job.status).toBe('CLOSED');
    expect(expired.body.job._count.applicants).toBeGreaterThan(0);

    const afterJobs = await request(app).get('/api/recruitment/jobs').set('Authorization', `Bearer ${adminToken}`);
    expect(afterJobs.body.filter((job) => job.status === 'OPEN').length).toBe(beforeActive - 1);
    expect(afterJobs.body.filter((job) => job.status === 'CLOSED').length).toBe(beforeClosed + 1);

    const board = await request(app).get(`/api/recruitment/jobs/${jobId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(board.status).toBe(200);
    expect(board.body.status).toBe('CLOSED');
    expect(board.body.applicants.some((applicant) => applicant.id === applicantId)).toBe(true);
    expect(board.body.applicants.some((applicant) => applicant.interviews.length > 0)).toBe(true);
    expect(board.body.applicants.some((applicant) => applicant.jobOffer)).toBe(true);

    const careerConnect = await request(app).get('/api/recruitment/career-connect/jobs').set('Authorization', `Bearer ${adminToken}`);
    expect(careerConnect.status).toBe(200);
    expect(careerConnect.body.some((job) => job.id === jobId)).toBe(false);

    const publicJob = await request(app).get(`/api/recruitment/career-portal/jobs/${jobId}`);
    expect(publicJob.status).toBe(410);
    expect(publicJob.body.error).toBe('This job opening is no longer accepting applications.');

    const lateApplication = await request(app).post('/api/recruitment/applicants')
      .field('jobOpeningId', jobId).field('fullName', 'Late Closed').field('email', `late-closed-${stamp}@x.com`).field('phone', '9000000099')
      .field('currentCtc', '6 LPA').field('expectedCtc', '9 LPA').field('noticePeriod', '30 Days');
    expect(lateApplication.status).toBe(400);
    expect(lateApplication.body.error).toBe('This job opening is no longer accepting applications.');

    const duplicateExpire = await request(app)
      .patch(`/api/recruitment/jobs/${jobId}/expire`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'EXPIRED' });
    expect(duplicateExpire.status).toBe(400);
    expect(duplicateExpire.body.error).toBe('Job is already closed.');

    const blockedDelete = await request(app)
      .post(`/api/recruitment/jobs/${jobId}/delete`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ confirmation: 'DELETE' });
    expect(blockedDelete.status).toBe(400);
    expect(blockedDelete.body.error).toBe('This job cannot be deleted because recruitment activity already exists. Expire the job instead.');

    const audit = await prisma.auditLog.findFirst({
      where: { entity: 'JobOpening', entityId: jobId, action: 'JOB_REQUISITION_EXPIRED' },
    });
    expect(audit).toBeTruthy();
  });
});
