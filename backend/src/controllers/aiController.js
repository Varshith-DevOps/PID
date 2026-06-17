/**
 * @fileoverview AI Agents API controller.
 * @module controllers/aiController
 */

const {
  SherlockAgent,
  JarvisAgent,
  WinstonAgent,
  AthenaAgent
} = require('../services/aiAgentService');

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

    if (!question || question.trim().isEmpty) {
      return res.status(400).json({ error: 'Question parameter is required.' });
    }

    const result = await AthenaAgent.askPolicyQuestion(question, companyId);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: 'Athena failed to fetch policy answer.' });
  }
};
