/**
 * @fileoverview Expense Claims & Travel Advances controller.
 * Handles expense claims, multi-level approvals (Manager -> Finance),
 * travel cash advance requests, and settlement tracking.
 * @module controllers/expenseController
 */

const prisma = require('../config/database');

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
    const employeeId = req.query.employeeId || req.user.employeeId;
    const filter = {};

    // RBAC: Admins & Finance & HR can view all claims.
    if (req.user.role === 'ADMIN' || req.user.role === 'HR' || req.user.role === 'FINANCE') {
      if (req.query.all === 'true') {
        // No filter, fetch everything in the org
      } else if (employeeId) {
        filter.employeeId = employeeId;
      }
    } else {
      // Regular employees can only view their own claims
      filter.employeeId = req.user.employeeId;
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
    const employeeId = req.user.employeeId;

    if (!title || !category || amount === undefined) {
      return res.status(400).json({ error: 'Required fields missing (title, category, amount)' });
    }

    let receiptUrl = null;
    if (req.file) {
      receiptUrl = `/uploads/receipts/${req.file.filename}`;
    }

    const claim = await prisma.expenseClaim.create({
      data: {
        employeeId,
        title,
        category,
        amount: parseFloat(amount),
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

    if (existingClaim.status !== 'PENDING') {
      return res.status(400).json({ error: 'Only pending claims can be updated' });
    }

    let receiptUrl = existingClaim.receiptUrl;
    if (req.file) {
      receiptUrl = `/uploads/receipts/${req.file.filename}`;
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
    const employeeId = req.query.employeeId || req.user.employeeId;
    const filter = {};

    if (req.user.role === 'ADMIN' || req.user.role === 'HR' || req.user.role === 'FINANCE') {
      if (req.query.all === 'true') {
        // Retrieve all advances
      } else if (employeeId) {
        filter.employeeId = employeeId;
      }
    } else {
      filter.employeeId = req.user.employeeId;
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
    const employeeId = req.user.employeeId;

    if (!purpose || amountRequested === undefined) {
      return res.status(400).json({ error: 'Required fields missing (purpose, amountRequested)' });
    }

    const advance = await prisma.travelAdvance.create({
      data: {
        employeeId,
        purpose,
        amountRequested: parseFloat(amountRequested),
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
    const { amountApproved, remarks, status } = req.body;

    const advance = await prisma.travelAdvance.findUnique({ where: { id } });
    if (!advance) {
      return res.status(404).json({ error: 'Travel advance not found' });
    }

    const updated = await prisma.travelAdvance.update({
      where: { id },
      data: {
        amountApproved: amountApproved !== undefined ? parseFloat(amountApproved) : advance.amountRequested,
        advanceRemarks: remarks || 'Approved by Finance / HR',
        status: status || 'APPROVED',
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

    const advance = await prisma.travelAdvance.findUnique({ where: { id } });
    if (!advance) {
      return res.status(404).json({ error: 'Travel advance not found' });
    }

    const updated = await prisma.travelAdvance.update({
      where: { id },
      data: {
        settledAmount: parseFloat(settledAmount),
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
};
