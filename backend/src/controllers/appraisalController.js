const prisma = require('../config/database');

const submitSelfEvaluation = async (req, res) => {
  try {
    const { cycleName, selfRatingScore, selfComments } = req.body;

    const employee = await prisma.employee.findFirst({ where: { userId: req.user.id } });
    if (!employee) return res.status(404).json({ error: 'Employee profile not found.' });

    let review = await prisma.performanceReview9Box.findFirst({
      where: { employeeId: employee.id, cycleName }
    });

    const reviewerId = employee.managerId || employee.id;

    if (review) {
      review = await prisma.performanceReview9Box.update({
        where: { id: review.id },
        data: {
          selfRatingScore: parseFloat(selfRatingScore) || 0.0,
          selfComments: selfComments || '',
          status: 'SELF_SUBMITTED'
        }
      });
    } else {
      review = await prisma.performanceReview9Box.create({
        data: {
          companyId: employee.companyId,
          employeeId: employee.id,
          reviewerId,
          cycleName,
          selfRatingScore: parseFloat(selfRatingScore) || 0.0,
          selfComments: selfComments || '',
          status: 'SELF_SUBMITTED'
        }
      });
    }

    res.status(201).json(review);
  } catch (error) {
    console.error('[SELF EVAL ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const submitManagerEvaluation = async (req, res) => {
  try {
    const { employeeId, cycleName, managerRatingScore, managerComments, performanceRating, potentialRating } = req.body;

    const manager = await prisma.employee.findFirst({ where: { userId: req.user.id } });
    if (!manager) return res.status(404).json({ error: 'Manager profile not found.' });

    const perf = parseInt(performanceRating);
    const pot = parseInt(potentialRating);

    if (isNaN(perf) || perf < 1 || perf > 3 || isNaN(pot) || pot < 1 || pot > 3) {
      return res.status(400).json({ error: 'Ratings must be integers between 1 (Low) and 3 (High).' });
    }

    // Grid matrix placement formula: (Performance - 1) * 3 + Potential
    const box = (perf - 1) * 3 + pot;

    let review = await prisma.performanceReview9Box.findFirst({
      where: { employeeId, cycleName }
    });

    if (review) {
      review = await prisma.performanceReview9Box.update({
        where: { id: review.id },
        data: {
          reviewerId: manager.id,
          managerRatingScore: parseFloat(managerRatingScore) || 0.0,
          managerComments: managerComments || '',
          performanceRating: perf,
          potentialRating: pot,
          boxPlacement: box,
          status: 'COMPLETED'
        }
      });
    } else {
      review = await prisma.performanceReview9Box.create({
        data: {
          companyId: manager.companyId,
          employeeId,
          reviewerId: manager.id,
          cycleName,
          managerRatingScore: parseFloat(managerRatingScore) || 0.0,
          managerComments: managerComments || '',
          performanceRating: perf,
          potentialRating: pot,
          boxPlacement: box,
          status: 'COMPLETED'
        }
      });
    }

    res.status(201).json(review);
  } catch (error) {
    console.error('[MANAGER EVAL ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const get9BoxAnalytics = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    if (!companyId) return res.status(400).json({ error: 'Company context missing.' });

    const list = await prisma.performanceReview9Box.findMany({
      where: { companyId },
      include: {
        employee: { select: { firstName: true, lastName: true, jobTitle: true, department: { select: { name: true } } } }
      }
    });

    // Grouping by box location index (1 to 9)
    const grid = Array.from({ length: 9 }).map((_, i) => ({
      boxNumber: i + 1,
      employees: []
    }));

    list.forEach((rev) => {
      const placement = rev.overrideBoxPlacement !== null && rev.overrideBoxPlacement !== undefined
        ? rev.overrideBoxPlacement
        : rev.boxPlacement;
      const idx = placement - 1;
      if (idx >= 0 && idx < 9) {
        grid[idx].employees.push({
          id: rev.employeeId,
          reviewId: rev.id,
          name: `${rev.employee.firstName} ${rev.employee.lastName}`,
          title: rev.employee.jobTitle,
          department: rev.employee.department.name,
          performanceRating: rev.performanceRating,
          potentialRating: rev.potentialRating,
          overrideBoxPlacement: rev.overrideBoxPlacement,
          reviewNotes: rev.reviewNotes
        });
      }
    });

    res.json({
      reviews: list,
      grid
    });
  } catch (error) {
    console.error('[9-BOX ANALYTICS ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const override9BoxPlacement = async (req, res) => {
  try {
    const { id } = req.params;
    const { overrideBoxPlacement, reviewNotes } = req.body;

    const review = await prisma.performanceReview9Box.findUnique({
      where: { id }
    });

    if (!review) return res.status(404).json({ error: '9-Box performance record not found' });

    // Validate that the override value is between 1 and 9 (or null to clear)
    const val = Number(overrideBoxPlacement);
    const targetBox = (isNaN(val) || val <= 0 || val > 9) ? null : val;

    const updated = await prisma.performanceReview9Box.update({
      where: { id },
      data: {
        overrideBoxPlacement: targetBox,
        reviewNotes: reviewNotes || null
      },
      include: {
        employee: { select: { firstName: true, lastName: true, jobTitle: true, department: { select: { name: true } } } }
      }
    });

    res.json({ success: true, review: updated });
  } catch (error) {
    console.error('[9-BOX OVERRIDE ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  submitSelfEvaluation,
  submitManagerEvaluation,
  get9BoxAnalytics,
  override9BoxPlacement
};
