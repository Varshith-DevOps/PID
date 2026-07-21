const express = require('express');
const prisma = require('../config/database');
const { authenticateService } = require('../middleware/serviceAuth');
const { resolveStoredUpload } = require('../config/storage');
const { runWithCompanyId } = require('../utils/tenantContext');
const { formatAssessment, toAssessmentCreateData } = require('../services/aiRecruitmentService');

const router = express.Router();

const jsonArray = (value) => Array.isArray(value) ? value : [];

router.use(authenticateService);

router.post('/context', async (req, res) => {
  try {
    const { organizationId, jobId, applicationId, candidateId } = req.body || {};
    if (!organizationId || !jobId || !applicationId || !candidateId) {
      return res.status(400).json({ code: 'AI_SCREENING_FAILED', error: 'Missing screening context identifiers.' });
    }
    await runWithCompanyId(organizationId, async () => {
      const job = await prisma.jobOpening.findFirst({ where: { id: jobId, companyId: organizationId } });
      if (!job) return res.status(404).json({ code: 'JOB_NOT_FOUND', error: 'Job not found.' });
      const applicant = await prisma.jobApplicant.findFirst({
        where: { id: applicationId, jobOpeningId: jobId },
      });
      if (!applicant) return res.status(404).json({ code: 'APPLICATION_NOT_FOUND', error: 'Application not found.' });
      if (candidateId !== applicant.id) return res.status(404).json({ code: 'CANDIDATE_NOT_FOUND', error: 'Candidate not found.' });
      const resumePath = resolveStoredUpload(applicant.resumeUrl);
      res.json({
        job: {
          id: job.id,
          title: job.title,
          description: job.description,
          requirements: job.requirements,
          location: job.location,
          employmentType: job.employmentType,
        },
        candidate: {
          id: applicant.id,
          fullName: applicant.fullName,
          experience: applicant.experience,
          skills: applicant.skills,
          coverLetter: applicant.coverLetter,
        },
        resume: {
          url: applicant.resumeUrl,
          available: Boolean(resumePath),
          text: [applicant.fullName, applicant.experience, applicant.skills, applicant.coverLetter].filter(Boolean).join('\n'),
        },
      });
    });
  } catch (error) {
    console.error('[AI CONTEXT ERROR]:', error.message);
    res.status(500).json({ code: 'AI_SCREENING_FAILED', error: 'Unable to prepare screening context.' });
  }
});

router.post('/assessments', async (req, res) => {
  try {
    const payload = req.body || {};
    await runWithCompanyId(payload.organizationId, async () => {
      const existing = await prisma.aiCandidateAssessment.findUnique({ where: { workflowId: payload.workflowId } });
      if (existing) return res.status(409).json({ code: 'SCREENING_ALREADY_EXISTS', error: 'Screening already exists.' });
      const applicant = await prisma.jobApplicant.findFirst({
        where: { id: payload.applicationId, jobOpeningId: payload.jobId },
        include: { jobOpening: true },
      });
      if (!applicant || applicant.jobOpening.companyId !== payload.organizationId) {
        return res.status(404).json({ code: 'APPLICATION_NOT_FOUND', error: 'Application not found.' });
      }
      const assessment = await prisma.aiCandidateAssessment.create({
        data: toAssessmentCreateData(payload, payload.organizationId),
      });
      await prisma.auditLog.create({
        data: {
          userId: null,
          userEmail: null,
          actorRole: 'AI_SERVICE',
          category: 'TENANT',
          action: 'AI_CANDIDATE_ASSESSMENT_SAVED',
          entity: 'AiCandidateAssessment',
          entityId: assessment.id,
          newDetails: JSON.stringify({ workflowId: assessment.workflowId, recommendation: assessment.recommendation }),
        },
      }).catch(() => {});
      res.status(201).json(formatAssessment(assessment));
    });
  } catch (error) {
    console.error('[AI ASSESSMENT SAVE ERROR]:', error.message);
    res.status(500).json({ code: 'AI_SCREENING_FAILED', error: 'Unable to save AI assessment.' });
  }
});

router.post('/assessments/:workflowId/approval', async (req, res) => {
  try {
    const decision = String(req.body?.decision || '').toUpperCase();
    if (!['APPROVED', 'REJECTED', 'NEEDS_REVIEW'].includes(decision)) {
      return res.status(400).json({ code: 'INVALID_APPROVAL_DECISION', error: 'Invalid approval decision.' });
    }
    const existing = await prisma.aiCandidateAssessment.findUnique({ where: { workflowId: req.params.workflowId } });
    if (!existing) return res.status(404).json({ code: 'WORKFLOW_NOT_FOUND', error: 'Workflow not found.' });
    await runWithCompanyId(existing.organizationId, async () => {
      const history = jsonArray(JSON.parse(existing.approvalHistory || '[]'));
      history.push({
        decision,
        approvedBy: req.body?.approvedBy || null,
        comments: req.body?.comments || null,
        timestamp: new Date().toISOString(),
        originalRecommendation: req.body?.originalRecommendation || existing.recommendation,
        finalRecruiterDecision: decision,
      });
      const assessment = await prisma.aiCandidateAssessment.update({
        where: { workflowId: req.params.workflowId },
        data: {
          approvalStatus: decision,
          approvedBy: req.body?.approvedBy || null,
          approvedAt: new Date(),
          approvalComments: req.body?.comments || null,
          approvalHistory: JSON.stringify(history),
        },
      });
      res.json(formatAssessment(assessment));
    });
  } catch (error) {
    console.error('[AI APPROVAL ERROR]:', error.message);
    res.status(500).json({ code: 'AI_SCREENING_FAILED', error: 'Unable to record approval.' });
  }
});

module.exports = router;
