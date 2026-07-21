const request = require('supertest');
const app = require('../src/index');
const prisma = require('../src/config/database');

const stamp = `${Date.now()}`.slice(-9);
const JOB_TITLE = `AI Screening Role ${stamp}`;
const CAND_EMAIL = `ai-candidate-${stamp}@example.com`;

describe('AI candidate screening integration', () => {
  let adminToken, departmentId, jobId, applicantId, workflowId, organizationId;
  const originalFetch = global.fetch;

  beforeAll(async () => {
    process.env.HRMS_SERVICE_TOKEN = 'test-service-token';
    process.env.AI_RECRUITMENT_SERVICE_TOKEN = 'test-service-token';
    const login = await request(app).post('/api/auth/login').send({ email: 'admin@hrms.com', password: 'admin123' });
    adminToken = login.body.token;
    const admin = await prisma.user.findUnique({ where: { email: 'admin@hrms.com' } });
    organizationId = admin?.companyId || `org-${stamp}`;
    departmentId = (await prisma.department.findFirst()).id;
  });

  afterAll(async () => {
    global.fetch = originalFetch;
    await prisma.aiCandidateAssessment.deleteMany({ where: { candidateId: applicantId } }).catch(() => {});
    await prisma.jobOpening.deleteMany({ where: { title: JOB_TITLE } }).catch(() => {});
    await prisma.$disconnect();
  });

  it('saves AI recommendation and approval without changing candidate stage', async () => {
    const job = await request(app)
      .post('/api/recruitment/jobs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: JOB_TITLE,
        departmentId,
        description: 'Build internal HR APIs',
        requirements: 'Node, React, SQL',
        location: 'Bengaluru',
        employmentType: 'FULL_TIME',
        status: 'OPEN',
      });
    expect(job.status).toBe(201);
    jobId = job.body.id;
    await prisma.jobOpening.update({ where: { id: jobId }, data: { companyId: organizationId } });

    const applicant = await request(app)
      .post('/api/recruitment/applicants')
      .field('jobOpeningId', jobId)
      .field('fullName', 'AI Candidate')
      .field('email', CAND_EMAIL)
      .field('phone', '9000000789')
      .field('experience', '4 years')
      .field('skills', 'Node, React, SQL')
      .field('currentCtc', '8 LPA')
      .field('expectedCtc', '10 LPA')
      .field('noticePeriod', '30 Days');
    expect(applicant.status).toBe(201);
    applicantId = applicant.body.application.id;

    global.fetch = jest.fn(async (url, options = {}) => {
      expect(options.headers.Authorization).toBe('Bearer test-service-token');
      workflowId = workflowId || `wf-${stamp}`;
      if (String(url).includes('/approval')) {
        return {
          ok: true,
          json: async () => ({ workflowId, approvalStatus: 'APPROVED' }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          workflowId,
          status: 'PENDING_APPROVAL',
          scores: { overall: 88 },
          recommendation: 'SHORTLIST_RECOMMENDED',
          approvalStatus: 'PENDING',
        }),
      };
    });

    const context = await request(app)
      .post('/api/internal/recruitment/ai/context')
      .set('Authorization', 'Bearer test-service-token')
      .send({
        tenantId: organizationId,
        organizationId,
        jobId,
        applicationId: applicantId,
        candidateId: applicantId,
        workflowId,
      });
    expect(context.status).toBe(200);
    expect(context.body.job.id).toBe(jobId);

    const saved = await request(app)
      .post('/api/internal/recruitment/ai/assessments')
      .set('Authorization', 'Bearer test-service-token')
      .send({
        tenantId: organizationId,
        organizationId,
        jobId,
        applicationId: applicantId,
        candidateId: applicantId,
        workflowId: `wf-${stamp}`,
        status: 'PENDING_APPROVAL',
        overallScore: 88,
        skillsScore: 90,
        experienceScore: 80,
        educationScore: 100,
        projectScore: 70,
        certificationScore: 0,
        domainScore: 80,
        confidence: 86,
        matchedSkills: ['Node', 'React', 'SQL'],
        missingRequiredSkills: [],
        missingPreferredSkills: [],
        evidence: { 'Resume -> Skills': ['Node', 'React', 'SQL'] },
        recruiterNotes: 'Evidence-based recommendation only.',
        recommendation: 'SHORTLIST_RECOMMENDED',
        approvalStatus: 'PENDING',
      });
    expect(saved.status).toBe(201);

    const listed = await request(app)
      .get(`/api/recruitment/applicants/${applicantId}/ai-assessments`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listed.status).toBe(200);
    expect(listed.body.currentAssessment.overallScore).toBe(88);

    const run = await request(app)
      .post(`/api/recruitment/applicants/${applicantId}/ai-screenings`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(run.status).toBe(202);
    expect(run.body.recommendation).toBe('SHORTLIST_RECOMMENDED');

    const approval = await request(app)
      .post(`/api/recruitment/applicants/${applicantId}/ai-assessments/wf-${stamp}/approval`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'APPROVED' });
    expect(approval.status).toBe(200);

    const after = await prisma.jobApplicant.findUnique({ where: { id: applicantId } });
    expect(after.stage).toBe('APPLIED');
  });
});
