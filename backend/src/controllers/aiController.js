/**
 * @fileoverview Rule-based assistant API controller (branded "agents").
 * These endpoints run deterministic heuristics, not AI/ML or LLMs. Every result
 * is advisory and carries a disclaimer; never use the output as an authoritative
 * decision. See services/aiAgentService.js.
 * @module controllers/aiController
 */

const {
  SherlockAgent,
  JarvisAgent,
  WinstonAgent,
  AthenaAgent
} = require('../services/aiAgentService');
const { askProjectQuestion } = require('../services/ai/projectAgent');
const { askRecruitmentQuestion } = require('../services/ai/recruitmentAgent');
const { askPriyaQuestion } = require('../services/ai/priyaAgent');
const prisma = require('../config/database');

const PROJECT_AI_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'MANAGER']);
const RECRUITMENT_AI_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'HR_ADMIN', 'HR', 'RECRUITER']);

const hasRole = (user, roles) => Boolean(user?.role && roles.has(user.role));

/**
 * Invokes Sherlock to scan an investment receipt.
 */
exports.auditProof = async (req, res) => {
  try {
    const { category, amount, rentDetails } = req.body;
    const documentName = req.file ? req.file.originalname : 'declaration_proof.pdf';

    const result = await SherlockAgent.auditTdsProof({
      category: category || 'HRA',
      amount: amount || '120000',
      documentName,
      rentDetails: rentDetails ? JSON.parse(rentDetails) : null
    });

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: 'Sherlock failed to audit document.' });
  }
};

/**
 * Invokes Jarvis to scan active payroll statistics.
 */
exports.auditPayroll = async (req, res) => {
  try {
    const { month, year } = req.body;
    const companyId = req.user.companyId;

    if (!companyId) {
      return res.status(400).json({ error: 'Tenant context required.' });
    }

    const result = await JarvisAgent.auditMonthlyPayroll(companyId, month || 6, year || 2026);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: 'Jarvis failed to audit payroll compliance.' });
  }
};

/**
 * Invokes Winston to verify check-in logs.
 */
exports.regularizeAttendance = async (req, res) => {
  try {
    const { dateStr, timeIn, timeOut } = req.body;
    const employeeId = req.user.employeeId || req.user.id;

    const result = await WinstonAgent.resolveRegularization(employeeId, dateStr || '2026-06-12', timeIn, timeOut);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: 'Winston failed to resolve regularization.' });
  }
};

/**
 * Invokes Athena to answer conversational queries.
 */
exports.askQuestion = async (req, res) => {
  try {
    const { question } = req.body;
    const companyId = req.user.companyId;

    if (!question || question.trim() === '') {
      return res.status(400).json({ error: 'Question parameter is required.' });
    }

    const result = await AthenaAgent.askPolicyQuestion(question, companyId);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: 'Athena failed to fetch policy answer.' });
  }
};

/**
 * Invokes Atlas to answer read-only project questions.
 */
exports.askProject = async (req, res) => {
  try {
    if (!hasRole(req.user, PROJECT_AI_ROLES)) {
      return res.status(403).json({ error: 'Atlas is available to managers and admins only.' });
    }

    const { question } = req.body;
    if (!question || question.trim() === '') {
      return res.status(400).json({ error: 'Question parameter is required.' });
    }

    const result = await askProjectQuestion(question, req.user);
    return res.status(200).json(result);
  } catch (error) {
    console.error('ATLAS PROJECT AI ERROR:', error);
    return res.status(500).json({ error: 'Atlas failed to fetch project answer.' });
  }
};

/**
 * Invokes Nova to answer read-only recruitment questions.
 */
exports.askRecruitment = async (req, res) => {
  try {
    if (!hasRole(req.user, RECRUITMENT_AI_ROLES)) {
      return res.status(403).json({ error: 'Nova is available to HR, recruiters, and admins only.' });
    }

    const { question } = req.body;
    if (!question || question.trim() === '') {
      return res.status(400).json({ error: 'Question parameter is required.' });
    }

    const result = await askRecruitmentQuestion(question);
    return res.status(200).json(result);
  } catch (error) {
    console.error('NOVA RECRUITMENT AI ERROR:', error);
    return res.status(500).json({ error: 'Nova failed to fetch recruitment answer.' });
  }
};

/**
 * Invokes Priya HR agent to answer employee and manager queries.
 */
exports.askPriya = async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || question.trim() === '') {
      return res.status(400).json({ error: 'Question parameter is required.' });
    }

    const result = await askPriyaQuestion(question, req.user);
    return res.status(200).json(result);
  } catch (error) {
    console.error('PRIYA HR AGENT ERROR:', error);
    return res.status(500).json({ error: 'Priya failed to process the request.' });
  }
};

/**
 * Records user feedback (upvote, downvote, text comment, corrections) for any agent.
 */
exports.submitFeedback = async (req, res) => {
  try {
    const { agentName, question, response, rating, feedbackText, correctedText } = req.body;
    if (!agentName || !question) {
      return res.status(400).json({ error: 'agentName and question parameters are required.' });
    }

    const companyId = req.user?.companyId || null;
    const userId = req.user?.id || null;

    const feedback = await prisma.agentFeedback.create({
      data: {
        agentName,
        companyId,
        userId,
        question,
        response: response || '',
        rating: rating !== undefined ? parseInt(rating) : null,
        feedbackText: feedbackText || null,
        isCorrected: Boolean(correctedText && correctedText.trim() !== ''),
        correctedText: correctedText || null
      }
    });

    return res.status(201).json({ success: true, feedback });
  } catch (error) {
    console.error('SUBMIT AGENT FEEDBACK ERROR:', error);
    return res.status(500).json({ error: 'Failed to record agent feedback.' });
  }
};
