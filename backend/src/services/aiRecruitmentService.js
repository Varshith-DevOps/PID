const crypto = require('crypto');
const logger = require('../utils/logger');

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

/**
 * Map an HTTP status code returned by the AI service to a descriptive error code.
 * @param {number} status
 * @returns {string}
 */
const httpStatusToCode = (status) => {
  if (status === 401 || status === 403) return 'INVALID_SERVICE_TOKEN';
  if (status === 503 || status === 502 || status === 504) return 'AI_SERVICE_OFFLINE';
  return 'AI_SCREENING_FAILED';
};

/**
 * Map a low-level Node.js network error code to a descriptive error code.
 * @param {string|undefined} code - error.code from a fetch/network failure
 * @returns {string}
 */
const networkErrorToCode = (code) => {
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ECONNRESET') {
    return 'AI_SERVICE_OFFLINE';
  }
  return 'AI_SCREENING_FAILED';
};

const callAiService = async (path, { method = 'GET', body } = {}) => {
  const aiServiceUrl = process.env.AI_RECRUITMENT_SERVICE_URL || 'http://localhost:8001';
  const aiServiceToken = process.env.AI_RECRUITMENT_SERVICE_TOKEN || process.env.HRMS_SERVICE_TOKEN || '';
  const targetUrl = `${aiServiceUrl.replace(/\/$/, '')}${path}`;

  if (!aiServiceToken) {
    logger.warn('[AI SCREENING] Service token not configured — set AI_RECRUITMENT_SERVICE_TOKEN in backend/.env', {
      url: targetUrl,
      method,
    });
    const error = new Error('AI recruitment service token is not configured.');
    error.code = 'UNAUTHORIZED_SERVICE';
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.AI_RECRUITMENT_TIMEOUT_MS || 60000));

  logger.info('[AI SCREENING] Sending request', { method, url: targetUrl });

  try {
    const response = await fetch(targetUrl, {
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

    logger.info('[AI SCREENING] Response received', { method, url: targetUrl, status: response.status });

    if (!response.ok) {
      const code = data?.detail?.code || data?.code || httpStatusToCode(response.status);
      const message = data?.detail?.message || data?.error || 'AI screening failed.';
      logger.warn('[AI SCREENING] Non-OK response from AI service', {
        method,
        url: targetUrl,
        status: response.status,
        code,
      });
      const error = new Error(message);
      error.code = code;
      error.status = response.status;
      throw error;
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      logger.warn('[AI SCREENING] Request timed out', { method, url: targetUrl });
      error.code = 'AI_SCREENING_TIMEOUT';
      error.status = 504;
    } else if (error.code && !error.status) {
      // Low-level network errors (ECONNREFUSED, ENOTFOUND, etc.)
      const mappedCode = networkErrorToCode(error.code);
      logger.warn('[AI SCREENING] Network error reaching AI service', {
        method,
        url: targetUrl,
        networkErrorCode: error.code,
        mappedCode,
      });
      error.code = mappedCode;
      error.status = 503;
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
