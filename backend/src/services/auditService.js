/**
 * @fileoverview Immutable Audit Logging Service for Payroll operations.
 */

const prisma = require('../config/database');

/**
 * Logs a payroll-related action to the immutable audit log table.
 * @param {Object} params
 * @param {string} params.userEmail - Email of the actor performing the operation
 * @param {string} params.action - Action name (e.g. PAYROLL_RUN, PAYROLL_REVIEW, PAYROLL_APPROVE, PAYROLL_REVERSE, TAX_DECLARATION)
 * @param {string} params.entity - Entity affected (e.g. PayrollRun, Employee, TaxDeclaration)
 * @param {string} [params.entityId] - Database ID of the affected entity
 * @param {Object} [params.oldDetails] - Previous state of the entity (will be JSON serialized)
 * @param {Object} [params.newDetails] - New state of the entity (will be JSON serialized)
 * @param {string} [params.ipAddress] - Request IP address
 */
const logPayrollEvent = async ({
  userEmail,
  action,
  entity,
  entityId = null,
  oldDetails = null,
  newDetails = null,
  ipAddress = null
}) => {
  try {
    await prisma.payrollAuditLog.create({
      data: {
        userEmail: userEmail || 'system@nexushr.com',
        action,
        entity,
        entityId,
        oldDetails: oldDetails ? JSON.stringify(oldDetails) : null,
        newDetails: newDetails ? JSON.stringify(newDetails) : null,
        ipAddress
      }
    });
  } catch (error) {
    console.error('[AUDIT LOGGER ERROR]: Failed to log event:', error.message);
  }
};

module.exports = {
  logPayrollEvent
};
