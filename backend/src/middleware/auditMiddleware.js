/**
 * @fileoverview Express middleware to log sensitive payroll and tax mutations to the immutable audit database ledger.
 */

const { logPayrollEvent } = require('../services/auditService');

/**
 * Middleware to intercept and log payroll mutations.
 */
const auditPayrollMiddleware = (req, res, next) => {
  res.on('finish', async () => {
    // Only audit successful modifications
    if (res.statusCode >= 400) return;

    const method = req.method;
    const path = req.path;

    if (!method || !path) return;
    if (method === 'GET') return; // Skip read operations

    let action = null;
    let entity = null;
    let entityId = null;

    if (path.includes('/payroll/runs/review') && method === 'POST') {
      action = 'PAYROLL_RUN_REVIEWED';
      entity = 'PayrollRun';
      entityId = req.params.runId;
    } else if (path.includes('/payroll/runs/approve') && method === 'POST') {
      action = 'PAYROLL_RUN_APPROVED';
      entity = 'PayrollRun';
      entityId = req.params.runId;
    } else if (path.includes('/payroll/runs/process') && method === 'POST') {
      action = 'PAYROLL_RUN_PROCESSED';
      entity = 'PayrollRun';
      entityId = req.params.runId;
    } else if (path.includes('/payroll/runs/reject') && method === 'POST') {
      action = 'PAYROLL_RUN_REJECTED';
      entity = 'PayrollRun';
      entityId = req.params.runId;
    } else if (path.includes('/payroll/runs/reverse') && method === 'POST') {
      action = 'PAYROLL_RUN_REVERSED';
      entity = 'PayrollRun';
      entityId = req.params.runId;
    } else if (path.includes('/payroll/run') && method === 'POST') {
      action = 'PAYROLL_RUN_INITIATED';
      entity = 'PayrollRun';
    } else if (path.includes('/payroll/structure') && (method === 'PUT' || method === 'POST')) {
      action = 'SALARY_STRUCTURE_SET';
      entity = 'SalaryStructure';
      entityId = req.params.employeeId;
    } else if (path.includes('/tax/declaration') && method === 'POST') {
      action = 'TAX_DECLARATION_SUBMITTED';
      entity = 'EmployeeTaxDeclaration';
    } else if (path.includes('/tax/previous-employer') && method === 'POST') {
      action = 'PREV_EMPLOYER_INCOME_SUBMITTED';
      entity = 'PreviousEmployerIncome';
    } else if (path.includes('/fnf/finalize') && method === 'POST') {
      action = 'FNF_SETTLEMENT_FINALIZED';
      entity = 'Employee';
      entityId = req.params.employeeId;
    }

    if (action) {
      try {
        await logPayrollEvent({
          userEmail: req.user?.email || 'admin@nexushr.com',
          action,
          entity,
          entityId: entityId || req.body.employeeId || req.body.runId || null,
          newDetails: req.body,
          ipAddress: req.ip
        });
      } catch (err) {
        console.error('[AUDIT MIDDLEWARE ERROR]: Failed to log payroll event:', err);
      }
    }
  });

  next();
};

module.exports = {
  auditPayrollMiddleware
};
