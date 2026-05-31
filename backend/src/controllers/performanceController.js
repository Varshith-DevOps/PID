/**
 * @fileoverview Performance Management & Appraisal controller.
 * Handles KRAs (Goals), Appraisals (Self & Manager evaluations),
 * and Peer 360 continuous feedback.
 * @module controllers/performanceController
 */

const prisma = require('../config/database');

// ==========================================
// 1. Key Result Areas (KRAs) / Goal Setting
// ==========================================

/**
 * Get all KRAs / Goals for an employee.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const getKras = async (req, res) => {
  try {
    const employeeId = req.query.employeeId || req.user.employeeId;
    if (!employeeId) {
      return res.status(400).json({ error: 'Employee ID is required' });
    }

    const kras = await prisma.kRA.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
    });

    res.json(kras);
  } catch (error) {
    console.error('[GET KRAS ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Create a new KRA / Goal.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const createKra = async (req, res) => {
  try {
    const { employeeId, title, description, weightage, target, year, quarter } = req.body;

    if (!employeeId || !title || weightage === undefined) {
      return res.status(400).json({ error: 'Missing required parameters (employeeId, title, weightage)' });
    }

    const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!emp) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Check sum of weightages does not exceed 100% for this year/quarter
    const existingKras = await prisma.kRA.findMany({
      where: {
        employeeId,
        year: year ? parseInt(year) : 2026,
        quarter: quarter ? parseInt(quarter) : null,
      },
    });

    const currentWeightageSum = existingKras.reduce((acc, curr) => acc + curr.weightage, 0);
    if (currentWeightageSum + parseFloat(weightage) > 100) {
      return res.status(400).json({
        error: `Total KRA weightage cannot exceed 100%. Current sum: ${currentWeightageSum}%`,
      });
    }

    const kra = await prisma.kRA.create({
      data: {
        employeeId,
        title,
        description,
        weightage: parseFloat(weightage),
        target,
        year: year ? parseInt(year) : 2026,
        quarter: quarter ? parseInt(quarter) : null,
        status: 'PENDING',
      },
    });

    res.status(201).json(kra);
  } catch (error) {
    console.error('[CREATE KRA ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Update an existing KRA / Goal.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const updateKra = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, weightage, target, status, year, quarter } = req.body;

    const existingKra = await prisma.kRA.findUnique({ where: { id } });
    if (!existingKra) {
      return res.status(404).json({ error: 'KRA record not found' });
    }

    // Check weightages if weightage changes
    if (weightage !== undefined && parseFloat(weightage) !== existingKra.weightage) {
      const allKras = await prisma.kRA.findMany({
        where: {
          employeeId: existingKra.employeeId,
          year: year ? parseInt(year) : existingKra.year,
          quarter: quarter !== undefined ? (quarter ? parseInt(quarter) : null) : existingKra.quarter,
        },
      });

      const currentSum = allKras
        .filter((k) => k.id !== id)
        .reduce((acc, curr) => acc + curr.weightage, 0);

      if (currentSum + parseFloat(weightage) > 100) {
        return res.status(400).json({
          error: `Total KRA weightage exceeds 100%. Current remaining sum: ${currentSum}%`,
        });
      }
    }

    const updatedKra = await prisma.kRA.update({
      where: { id },
      data: {
        title: title || undefined,
        description: description !== undefined ? description : undefined,
        weightage: weightage !== undefined ? parseFloat(weightage) : undefined,
        target: target !== undefined ? target : undefined,
        status: status || undefined,
        year: year ? parseInt(year) : undefined,
        quarter: quarter !== undefined ? (quarter ? parseInt(quarter) : null) : undefined,
      },
    });

    res.json(updatedKra);
  } catch (error) {
    console.error('[UPDATE KRA ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Delete a KRA.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const deleteKra = async (req, res) => {
  try {
    const { id } = req.params;

    const existingKra = await prisma.kRA.findUnique({ where: { id } });
    if (!existingKra) {
      return res.status(404).json({ error: 'KRA not found' });
    }

    await prisma.kRA.delete({ where: { id } });
    res.json({ message: 'KRA successfully deleted' });
  } catch (error) {
    console.error('[DELETE KRA ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// ==========================================
// 2. Performance Appraisals Cycles
// ==========================================

/**
 * Get all appraisals (optionally filtered by employee or status).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const getAppraisals = async (req, res) => {
  try {
    const employeeId = req.query.employeeId || req.user.employeeId;
    const filter = {};

    // Allow admins/HR to query all appraisals or specific employee
    if (req.user.role === 'ADMIN' || req.user.role === 'HR') {
      if (req.query.all === 'true') {
        // Fetch all appraisals
      } else if (employeeId) {
        filter.employeeId = employeeId;
      }
    } else {
      filter.employeeId = req.user.employeeId;
    }

    const appraisals = await prisma.performanceAppraisal.findMany({
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

    res.json(appraisals);
  } catch (error) {
    console.error('[GET APPRAISALS ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Initiate a new appraisal cycle for an employee.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const createAppraisal = async (req, res) => {
  try {
    const { employeeId, appraisalCycle, startDate, endDate } = req.body;

    if (!employeeId || !appraisalCycle || !startDate || !endDate) {
      return res.status(400).json({ error: 'Missing required appraisal initiation parameters' });
    }

    const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!emp) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Check if an appraisal cycle already exists for this employee
    const existing = await prisma.performanceAppraisal.findFirst({
      where: { employeeId, appraisalCycle },
    });
    if (existing) {
      return res.status(400).json({ error: 'Appraisal cycle already exists for this employee' });
    }

    const appraisal = await prisma.performanceAppraisal.create({
      data: {
        employeeId,
        appraisalCycle,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: 'DRAFT',
      },
    });

    res.status(201).json(appraisal);
  } catch (error) {
    console.error('[CREATE APPRAISAL ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Submit self-evaluation details.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const submitSelfEvaluation = async (req, res) => {
  try {
    const { id } = req.params;
    const { selfRating, selfFeedback } = req.body;

    if (selfRating === undefined || !selfFeedback) {
      return res.status(400).json({ error: 'Self-rating and detailed feedback is required' });
    }

    const appraisal = await prisma.performanceAppraisal.findUnique({ where: { id } });
    if (!appraisal) {
      return res.status(404).json({ error: 'Appraisal cycle not found' });
    }

    const updated = await prisma.performanceAppraisal.update({
      where: { id },
      data: {
        selfRating: parseFloat(selfRating),
        selfFeedback,
        status: 'SUBMITTED_SELF',
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('[SUBMIT SELF EVAL ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Submit manager-evaluation details and conclude appraisal cycle.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const submitManagerEvaluation = async (req, res) => {
  try {
    const { id } = req.params;
    const { managerRating, managerFeedback, finalRating } = req.body;

    if (managerRating === undefined || !managerFeedback) {
      return res.status(400).json({ error: 'Manager rating and feedback parameters are required' });
    }

    const appraisal = await prisma.performanceAppraisal.findUnique({ where: { id } });
    if (!appraisal) {
      return res.status(404).json({ error: 'Appraisal record not found' });
    }

    const updated = await prisma.performanceAppraisal.update({
      where: { id },
      data: {
        managerRating: parseFloat(managerRating),
        managerFeedback,
        finalRating: finalRating !== undefined ? parseFloat(finalRating) : parseFloat(managerRating),
        status: 'COMPLETED',
        approvedBy: req.user.email,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('[SUBMIT MANAGER EVAL ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// ==========================================
// 3. 360-Degree Continuous Feedback
// ==========================================

/**
 * Get all 360 feedback reviews received by the logged in user or specific employee.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const getFeedback360 = async (req, res) => {
  try {
    const employeeId = req.query.employeeId || req.user.employeeId;

    if (!employeeId) {
      return res.status(400).json({ error: 'Employee ID is required' });
    }

    const feedbacks = await prisma.feedback360.findMany({
      where: { employeeId },
      include: {
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            jobTitle: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Handle anonymity mask
    const processedFeedbacks = feedbacks.map((fb) => {
      if (fb.anonymous) {
        return {
          ...fb,
          reviewerId: 'anonymous',
          reviewer: {
            firstName: 'Anonymous',
            lastName: 'Peer',
            jobTitle: 'Team Member',
          },
        };
      }
      return fb;
    });

    res.json(processedFeedbacks);
  } catch (error) {
    console.error('[GET FEEDBACK360 ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Submit continuous 360 feedback reviews.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const submitFeedback360 = async (req, res) => {
  try {
    const { employeeId, feedback, rating, relationship, anonymous } = req.body;
    const reviewerId = req.user.employeeId;

    if (!employeeId || !feedback || rating === undefined) {
      return res.status(400).json({ error: 'Missing feedback parameters (employeeId, feedback, rating)' });
    }

    if (employeeId === reviewerId) {
      return res.status(400).json({ error: 'You cannot submit 360 feedback for yourself' });
    }

    // Verify recipient employee
    const recipient = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!recipient) {
      return res.status(404).json({ error: 'Recipient employee not found' });
    }

    const fb = await prisma.feedback360.create({
      data: {
        employeeId,
        reviewerId,
        feedback,
        rating: parseInt(rating),
        relationship: relationship || 'PEER',
        anonymous: anonymous || false,
      },
    });

    res.status(201).json(fb);
  } catch (error) {
    console.error('[CREATE FEEDBACK360 ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getKras,
  createKra,
  updateKra,
  deleteKra,
  getAppraisals,
  createAppraisal,
  submitSelfEvaluation,
  submitManagerEvaluation,
  getFeedback360,
  submitFeedback360,
};
