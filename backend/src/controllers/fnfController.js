/**
 * @fileoverview Full & Final (F&F) Settlement Controller.
 * Manages exit calculations, final settlement summaries, and database finalization.
 */

const prisma = require('../config/database');
const { calculateFNFSettlement } = require('../services/fnfService');
const { logPayrollEvent } = require('../services/auditService');

/**
 * Calculates F&F payout draft.
 * GET /api/fnf/calculate/:employeeId
 */
const getFNFCalculation = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const calc = await calculateFNFSettlement(employeeId);
    res.json(calc);
  } catch (error) {
    console.error('FNF CALCULATION ERROR:', error.message);
    res.status(400).json({ error: error.message });
  }
};

/**
 * Finalizes F&F Settlement, records transaction, and locks/updates employee status to INACTIVE.
 * POST /api/fnf/finalize/:employeeId
 */
const finalizeFNFSettlement = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { remarks } = req.body;

    const calc = await calculateFNFSettlement(employeeId);

    // Update Employee status and exit details inside a transaction
    const transaction = await prisma.$transaction(async (tx) => {
      // 1. Mark employee as INACTIVE
      const emp = await tx.employee.update({
        where: { id: employeeId },
        data: { isActive: false }
      });

      // 2. Finalize exit details
      await tx.exitDetails.update({
        where: { employeeId },
        data: {
          fnfStatus: 'COMPLETED',
          fnfAmount: calc.netSettlement,
          remarks: remarks || 'F&F Finalized successfully.'
        }
      });

      // 3. Log a dummy payroll run entry for F&F or log it in audit details
      return emp;
    });

    await logPayrollEvent({
      userEmail: req.user?.email || 'admin@nexushr.com',
      action: 'FNF_FINALIZED',
      entity: 'Employee',
      entityId: employeeId,
      newDetails: { settlement: calc, remarks },
      ipAddress: req.ip
    });

    res.json({
      message: 'Full & Final settlement finalized successfully. Employee is now deactivated.',
      settlement: calc,
      employee: transaction
    });
  } catch (error) {
    console.error('FNF FINALIZATION ERROR:', error.message);
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  getFNFCalculation,
  finalizeFNFSettlement
};
