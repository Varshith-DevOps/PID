/**
 * @fileoverview Expense Claims & Travel Advances controller.
 * Handles expense claims, multi-level approvals (Manager -> Finance),
 * travel cash advance requests, and settlement tracking.
 * @module controllers/expenseController
 */

const prisma = require('../config/database');
const fs = require('fs');
const { canAccessEmployee, getEmployeeScopeIds, canApproveEmployeeWorkflow, isPayroll } = require('../services/accessControl');
const { resolveStoredUpload } = require('../config/storage');

// ==========================================
// 1. Expense Claims Management
// ==========================================

/**
 * Retrieve list of expense claims.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const getClaims = async (req, res) => {
  try {
    const employeeId = req.query.employeeId;
    const filter = {};

    if (isPayroll(req.user)) {
      if (req.query.all === 'true') {
        // Payroll/HR roles can fetch all claims for audit and settlement.
      } else if (employeeId) {
        filter.employeeId = employeeId;
      }
    } else if (employeeId) {
      if (!(await canAccessEmployee(req.user, employeeId))) {
        return res.status(403).json({ error: 'Access denied for requested expense claims' });
      }
      filter.employeeId = employeeId;
    } else {
      const employeeIds = await getEmployeeScopeIds(req.user);
      filter.employeeId = { in: employeeIds.length ? employeeIds : ['__no_employee_scope__'] };
    }

    if (req.query.status) {
      filter.status = req.query.status;
    }

    const claims = await prisma.expenseClaim.findMany({
      where: filter,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            jobTitle: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(claims);
  } catch (error) {
    console.error('[GET CLAIMS ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Submit a new expense claim with receipt upload.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const createClaim = async (req, res) => {
  try {
    const { title, category, amount, description, currency } = req.body;
    // Self-service defaults to the requester's linked employee; HR/admin may
    // explicitly pass an employeeId they are authorized for.
    let employeeId = req.user.employeeId;
    if (req.body.employeeId) {
      if (!(await canAccessEmployee(req.user, req.body.employeeId))) {
        return res.status(403).json({ error: 'Access denied. You can only create claims for authorized employees.' });
      }
      employeeId = req.body.employeeId;
    }
    if (!employeeId) {
      return res.status(400).json({ error: 'No employee profile is linked to your account. Ask HR to link one before submitting expense claims.' });
    }

    const parsedAmount = Number(amount);
    if (!title || !category || amount === undefined) {
      return res.status(400).json({ error: 'Required fields missing (title, category, amount)' });
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Expense amount must be greater than 0' });
    }

    let receiptUrl = null;
    if (req.file) {
      receiptUrl = `receipts/${req.file.filename}`;
    }

    const claim = await prisma.expenseClaim.create({
      data: {
        employeeId,
        title,
        category,
        amount: parsedAmount,
        currency: currency || 'INR',
        receiptUrl,
        description,
        status: 'PENDING',
      },
    });

    res.status(201).json(claim);
  } catch (error) {
    console.error('[CREATE CLAIM ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Update an existing expense claim.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const updateClaim = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, category, amount, description, currency } = req.body;

    const existingClaim = await prisma.expenseClaim.findUnique({ where: { id } });
    if (!existingClaim) {
      return res.status(404).json({ error: 'Claim not found' });
    }
    if (!(await canAccessEmployee(req.user, existingClaim.employeeId))) {
      return res.status(403).json({ error: 'Access denied. You can only update authorized claims.' });
    }

    if (existingClaim.status !== 'PENDING') {
      return res.status(400).json({ error: 'Only pending claims can be updated' });
    }
    if (amount !== undefined) {
      const parsedAmount = Number(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: 'Expense amount must be greater than 0' });
      }
    }

    let receiptUrl = existingClaim.receiptUrl;
    if (req.file) {
      receiptUrl = `receipts/${req.file.filename}`;
    }

    const updated = await prisma.expenseClaim.update({
      where: { id },
      data: {
        title: title || undefined,
        category: category || undefined,
        amount: amount !== undefined ? parseFloat(amount) : undefined,
        currency: currency || undefined,
        receiptUrl,
        description: description !== undefined ? description : undefined,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('[UPDATE CLAIM ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Approve a claim by Direct Manager.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const managerApproveClaim = async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;

    const claim = await prisma.expenseClaim.findUnique({ where: { id } });
    if (!claim) {
      return res.status(404).json({ error: 'Expense claim not found' });
    }
    if (!(await canApproveEmployeeWorkflow(req.user, claim.employeeId))) {
      return res.status(403).json({ error: 'Access denied. You can only approve claims for your authorized team.' });
    }
    if (claim.status !== 'PENDING') {
      return res.status(400).json({ error: `Only pending claims can be manager-approved. Current: ${claim.status}` });
    }

    const updated = await prisma.expenseClaim.update({
      where: { id },
      data: {
        status: 'APPROVED_BY_MANAGER',
        managerId: req.user.employeeId,
        managerRemarks: remarks || 'Approved by Manager',
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('[MANAGER APPROVE ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Approve a claim by Finance Team (Reimburse).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const financeApproveClaim = async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks, markAsPaid } = req.body;

    const claim = await prisma.expenseClaim.findUnique({ where: { id } });
    if (!claim) {
      return res.status(404).json({ error: 'Expense claim not found' });
    }
    if (!isPayroll(req.user)) {
      return res.status(403).json({ error: 'Only finance/payroll roles can approve claims at finance level' });
    }
    // Enforce the two-level workflow: finance may only act on manager-approved claims.
    if (claim.status !== 'APPROVED_BY_MANAGER') {
      return res.status(409).json({ error: `Only manager-approved claims can be finance-approved. Current status: ${claim.status}` });
    }

    const updated = await prisma.expenseClaim.update({
      where: { id },
      data: {
        status: markAsPaid ? 'PAID' : 'APPROVED_BY_FINANCE',
        financeRemarks: remarks || 'Approved & Settled by Finance',
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('[FINANCE APPROVE ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Reject an expense claim.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const rejectClaim = async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks, level } = req.body; // 'manager' or 'finance'

    const claim = await prisma.expenseClaim.findUnique({ where: { id } });
    if (!claim) {
      return res.status(404).json({ error: 'Expense claim not found' });
    }
    if (level === 'finance' && !isPayroll(req.user)) {
      return res.status(403).json({ error: 'Only finance/payroll roles can reject at finance level' });
    }
    if (level !== 'finance' && !(await canApproveEmployeeWorkflow(req.user, claim.employeeId))) {
      return res.status(403).json({ error: 'Access denied. You cannot reject this claim.' });
    }

    const updateData = { status: 'REJECTED' };
    if (level === 'finance') {
      updateData.financeRemarks = remarks || 'Rejected by Finance';
    } else {
      updateData.managerId = req.user.employeeId;
      updateData.managerRemarks = remarks || 'Rejected by Manager';
    }

    const updated = await prisma.expenseClaim.update({
      where: { id },
      data: updateData,
    });

    res.json(updated);
  } catch (error) {
    console.error('[REJECT CLAIM ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// ==========================================
// 2. Travel Advances Management
// ==========================================

/**
 * Retrieve travel advances.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const getAdvances = async (req, res) => {
  try {
    const employeeId = req.query.employeeId;
    const filter = {};

    if (isPayroll(req.user)) {
      if (req.query.all === 'true') {
        // Payroll/HR roles can fetch all advances.
      } else if (employeeId) {
        filter.employeeId = employeeId;
      }
    } else if (employeeId) {
      if (!(await canAccessEmployee(req.user, employeeId))) {
        return res.status(403).json({ error: 'Access denied for requested travel advances' });
      }
      filter.employeeId = employeeId;
    } else {
      const employeeIds = await getEmployeeScopeIds(req.user);
      filter.employeeId = { in: employeeIds.length ? employeeIds : ['__no_employee_scope__'] };
    }

    const advances = await prisma.travelAdvance.findMany({
      where: filter,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            jobTitle: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(advances);
  } catch (error) {
    console.error('[GET ADVANCES ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Request a travel advance.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const createAdvance = async (req, res) => {
  try {
    const { purpose, amountRequested } = req.body;
    // Self-service defaults to the requester's linked employee; HR/admin may
    // explicitly pass an employeeId they are authorized for.
    let employeeId = req.user.employeeId;
    if (req.body.employeeId) {
      if (!(await canAccessEmployee(req.user, req.body.employeeId))) {
        return res.status(403).json({ error: 'Access denied. You can only create advances for authorized employees.' });
      }
      employeeId = req.body.employeeId;
    }
    if (!employeeId) {
      return res.status(400).json({ error: 'No employee profile is linked to your account. Ask HR to link one before requesting travel advances.' });
    }

    const requested = Number(amountRequested);
    if (!purpose || amountRequested === undefined) {
      return res.status(400).json({ error: 'Required fields missing (purpose, amountRequested)' });
    }
    if (!Number.isFinite(requested) || requested <= 0) {
      return res.status(400).json({ error: 'Requested advance amount must be greater than 0' });
    }

    const advance = await prisma.travelAdvance.create({
      data: {
        employeeId,
        purpose,
        amountRequested: requested,
        status: 'PENDING',
      },
    });

    res.status(201).json(advance);
  } catch (error) {
    console.error('[CREATE ADVANCE ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Approve a travel cash advance request.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const approveAdvance = async (req, res) => {
  try {
    const { id } = req.params;
    const { amountApproved, remarks } = req.body;

    const advance = await prisma.travelAdvance.findUnique({ where: { id } });
    if (!advance) {
      return res.status(404).json({ error: 'Travel advance not found' });
    }
    if (!isPayroll(req.user)) {
      return res.status(403).json({ error: 'Only finance/payroll roles can approve travel advances' });
    }
    if (advance.status !== 'PENDING') {
      return res.status(409).json({ error: `Only pending travel advances can be approved. Current status: ${advance.status}` });
    }
    const approved = amountApproved !== undefined ? Number(amountApproved) : advance.amountRequested;
    if (!Number.isFinite(approved) || approved <= 0) {
      return res.status(400).json({ error: 'Approved amount must be greater than 0' });
    }

    // Status is computed server-side; never trust a client-supplied status here.
    // Only PENDING → APPROVED is supported by the approval endpoint.
    const updated = await prisma.travelAdvance.update({
      where: { id },
      data: {
        amountApproved: approved,
        advanceRemarks: remarks || 'Approved by Finance / HR',
        status: 'APPROVED',
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('[APPROVE ADVANCE ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Settle travel cash advance with actual out-of-pocket usage.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const settleAdvance = async (req, res) => {
  try {
    const { id } = req.params;
    const { settledAmount, remarks } = req.body;

    if (settledAmount === undefined) {
      return res.status(400).json({ error: 'Actual settled amount parameter is required' });
    }
    const settled = Number(settledAmount);
    if (!Number.isFinite(settled) || settled < 0) {
      return res.status(400).json({ error: 'Settled amount cannot be negative' });
    }

    const advance = await prisma.travelAdvance.findUnique({ where: { id } });
    if (!advance) {
      return res.status(404).json({ error: 'Travel advance not found' });
    }
    if (!isPayroll(req.user)) {
      return res.status(403).json({ error: 'Only finance/payroll roles can settle travel advances' });
    }
    if (advance.status !== 'APPROVED') {
      return res.status(409).json({ error: `Only approved travel advances can be settled. Current status: ${advance.status}` });
    }

    const updated = await prisma.travelAdvance.update({
      where: { id },
      data: {
        settledAmount: settled,
        settledDate: new Date(),
        advanceRemarks: remarks || 'Settle travel advance expenses',
        status: 'SETTLED',
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('[SETTLE ADVANCE ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const downloadClaimReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    const claim = await prisma.expenseClaim.findUnique({ where: { id } });
    if (!claim) return res.status(404).json({ error: 'Expense claim not found' });
    if (!(isPayroll(req.user) || await canAccessEmployee(req.user, claim.employeeId))) {
      return res.status(403).json({ error: 'Access denied for requested receipt' });
    }
    const receiptPath = resolveStoredUpload(claim.receiptUrl);
    if (!receiptPath || !fs.existsSync(receiptPath)) {
      return res.status(404).json({ error: 'Receipt file not found' });
    }
    res.download(receiptPath);
  } catch (error) {
    console.error('[DOWNLOAD RECEIPT ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getClaims,
  createClaim,
  updateClaim,
  managerApproveClaim,
  financeApproveClaim,
  rejectClaim,
  getAdvances,
  createAdvance,
  approveAdvance,
  settleAdvance,
  downloadClaimReceipt,
};
