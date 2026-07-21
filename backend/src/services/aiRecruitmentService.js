const crypto = require('crypto');

const safeJson = (value, fallback) => {
  try {
    return JSON.parse(value || '');
  } catch {
    return fallback;
  }
};

const stringify = (value, fallback) => JSON.stringify(value ?? fallback);

const formatAssessment = (assessment) => {
  if (!assessment) return null;
  return {
    ...assessment,
    matchedSkills: safeJson(assessment.matchedSkills, []),
    missingRequiredSkills: safeJson(assessment.missingRequiredSkills, []),
    missingPreferredSkills: safeJson(assessment.missingPreferredSkills, []),
    evidence: safeJson(assessment.evidence, {}),
    approvalHistory: safeJson(assessment.approvalHistory, []),
  };
};

const toAssessmentCreateData = (payload, companyId) => ({
  tenantId: payload.tenantId,
  companyId,
  organizationId: payload.organizationId,
  jobId: payload.jobId,
  applicationId: payload.applicationId,
  candidateId: payload.candidateId,
  workflowId: payload.workflowId,
  status: payload.status || 'PENDING_APPROVAL',
  skillsScore: Number(payload.skillsScore || 0),
  experienceScore: Number(payload.experienceScore || 0),
  educationScore: Number(payload.educationScore || 0),
  projectScore: Number(payload.projectScore || 0),
  certificationScore: Number(payload.certificationScore || 0),
  domainScore: Number(payload.domainScore || 0),
  overallScore: Number(payload.overallScore || 0),
  confidence: Number(payload.confidence || 0),
  matchedSkills: stringify(payload.matchedSkills, []),
  missingRequiredSkills: stringify(payload.missingRequiredSkills, []),
  missingPreferredSkills: stringify(payload.missingPreferredSkills, []),
  evidence: stringify(payload.evidence, {}),
  recruiterNotes: String(payload.recruiterNotes || ''),
  recommendation: String(payload.recommendation || 'RECRUITER_REVIEW_REQUIRED'),
  approvalStatus: payload.approvalStatus || 'PENDING',
  modelProvider: payload.modelProvider || null,
  modelName: payload.modelName || null,
  promptVersion: payload.promptVersion || null,
  scoringVersion: payload.scoringVersion || null,
  createdBy: payload.createdBy || null,
});

const callAiService = async (path, { method = 'GET', body } = {}) => {
  const aiServiceUrl = process.env.AI_RECRUITMENT_SERVICE_URL || 'http://localhost:8001';
  const aiServiceToken = process.env.AI_RECRUITMENT_SERVICE_TOKEN || process.env.HRMS_SERVICE_TOKEN || '';
  if (!aiServiceToken) {
    const error = new Error('AI recruitment service token is not configured.');
    error.code = 'UNAUTHORIZED_SERVICE';
    throw error;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.AI_RECRUITMENT_TIMEOUT_MS || 60000));
  try {
    const response = await fetch(`${aiServiceUrl.replace(/\/$/, '')}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${aiServiceToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.detail?.message || data?.error || 'AI screening failed.');
      error.code = data?.detail?.code || data?.code || 'AI_SCREENING_FAILED';
      error.status = response.status;
      throw error;
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      error.code = 'AI_SCREENING_FAILED';
      error.status = 504;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

module.exports = {
  callAiService,
  formatAssessment,
  toAssessmentCreateData,
};
