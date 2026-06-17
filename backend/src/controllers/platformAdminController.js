const prisma = require('../config/database');

/**
 * List all registered companies (tenants) on the SaaS platform.
 * GET /api/platform-admin/companies
 */
const getCompanies = async (req, res) => {
  try {
    const companies = await prisma.company.findMany({
      include: {
        subscriptions: {
          include: { plan: true },
          orderBy: { endDate: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(companies);
  } catch (error) {
    console.error('[ADMIN GET COMPANIES ERROR]:', error.message);
    res.status(500).json({ error: 'Failed to retrieve tenant companies' });
  }
};

/**
 * Update the status of a tenant company (ACTIVE, SUSPENDED, etc.).
 * PUT /api/platform-admin/companies/:id/status
 */
const updateCompanyStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const company = await prisma.company.update({
      where: { id },
      data: { status }
    });

    res.json({ message: 'Company status updated successfully', company });
  } catch (error) {
    console.error('[ADMIN UPDATE COMPANY STATUS ERROR]:', error.message);
    res.status(500).json({ error: 'Failed to update company status' });
  }
};

/**
 * List all subscriptions.
 * GET /api/platform-admin/subscriptions
 */
const getSubscriptions = async (req, res) => {
  try {
    const subscriptions = await prisma.subscription.findMany({
      include: {
        company: true,
        plan: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(subscriptions);
  } catch (error) {
    console.error('[ADMIN GET SUBSCRIPTIONS ERROR]:', error.message);
    res.status(500).json({ error: 'Failed to retrieve subscriptions' });
  }
};

/**
 * Update a company's subscription.
 * PUT /api/platform-admin/subscriptions/:id
 */
const updateSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { planId, status, endDate } = req.body;

    const data = {};
    if (planId) data.planId = planId;
    if (status) data.status = status;
    if (endDate) data.endDate = new Date(endDate);

    const subscription = await prisma.subscription.update({
      where: { id },
      data,
      include: { plan: true }
    });

    res.json({ message: 'Subscription updated successfully', subscription });
  } catch (error) {
    console.error('[ADMIN UPDATE SUBSCRIPTION ERROR]:', error.message);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
};

/**
 * Get platform-wide metrics.
 * GET /api/platform-admin/metrics
 */
const getMetrics = async (req, res) => {
  try {
    const totalTenants = await prisma.company.count();
    const activeSubs = await prisma.subscription.count({ where: { status: 'ACTIVE' } });
    const pendingLeads = await prisma.contactRequest.count({ where: { status: 'PENDING' } });
    const pendingKycCount = await prisma.company.count({ where: { kycStatus: 'PENDING' } });
    
    const revenueSum = await prisma.paymentTransaction.aggregate({
      where: { status: 'SUCCESS' },
      _sum: { amount: true }
    });

    const recentTxns = await prisma.paymentTransaction.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        company: { select: { name: true } }
      }
    });

    const companies = await prisma.company.findMany({
      include: {
        _count: {
          select: {
            employees: true,
            users: true,
          }
        }
      }
    });

    const tenantBehavior = [];
    for (const comp of companies) {
      // Get attendance count
      const attendanceCount = await prisma.attendance.count({
        where: { employee: { companyId: comp.id } }
      });
      // Get leave count
      const leaveCount = await prisma.leave.count({
        where: { employee: { companyId: comp.id } }
      });
      // Get payroll count
      const payrollCount = await prisma.payrollRecord.count({
        where: { employee: { companyId: comp.id } }
      });
      // Get helpdesk tickets count
      const ticketsCount = await prisma.helpdeskTicket.count({
        where: { employee: { companyId: comp.id } }
      });

      tenantBehavior.push({
        companyId: comp.id,
        name: comp.name,
        code: comp.code,
        kycStatus: comp.kycStatus,
        createdAt: comp.createdAt,
        employeeCount: comp._count.employees,
        activeUserCount: comp._count.users,
        attendanceCount,
        leaveCount,
        payrollCount,
        ticketsCount
      });
    }

    res.json({
      metrics: {
        totalTenants,
        activeSubscriptions: activeSubs,
        pendingContactRequests: pendingLeads,
        totalRevenue: revenueSum._sum.amount || 0,
        pendingKycCount
      },
      recentTransactions: recentTxns,
      tenantBehavior
    });
  } catch (error) {
    console.error('[ADMIN GET METRICS ERROR]:', error.message);
    res.status(500).json({ error: 'Failed to retrieve platform metrics' });
  }
};

/**
 * Create and assign a custom subscription plan for a tenant company.
 * POST /api/platform-admin/companies/:id/custom-plan
 */
const createCustomPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, employeeLimit, featureLimits, durationDays } = req.body;

    if (!name || price === undefined || employeeLimit === undefined) {
      return res.status(400).json({ error: 'Plan name, price, and employee limit are required' });
    }

    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // 1. Create the custom plan (not public)
    const customPlan = await prisma.plan.create({
      data: {
        name,
        description: description || `Custom plan for ${company.name}`,
        price: parseFloat(price),
        billingCycle: 'MONTHLY',
        employeeLimit: parseInt(employeeLimit),
        featureLimits: typeof featureLimits === 'string' ? featureLimits : JSON.stringify(featureLimits),
        isActive: false
      }
    });

    // 2. Set all existing subscriptions for this company to INACTIVE
    await prisma.subscription.updateMany({
      where: { companyId: id, status: 'ACTIVE' },
      data: { status: 'INACTIVE' }
    });

    // 3. Create the new active subscription
    const duration = parseInt(durationDays) || 30;
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + duration);

    const subscription = await prisma.subscription.create({
      data: {
        companyId: id,
        planId: customPlan.id,
        status: 'ACTIVE',
        startDate: new Date(),
        endDate
      },
      include: { plan: true }
    });

    res.json({ message: 'Custom subscription created and activated successfully', subscription });
  } catch (error) {
    console.error('[ADMIN CREATE CUSTOM PLAN ERROR]:', error.message);
    res.status(500).json({ error: 'Failed to create and assign custom plan' });
  }
};

/**
 * Verify a company's KYC status (Approve/Reject).
 * PUT /api/platform-admin/companies/:id/kyc
 */
const verifyCompanyKYC = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;

    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'Valid status (APPROVED or REJECTED) is required.' });
    }

    const company = await prisma.company.findUnique({
      where: { id }
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updateData = {
        kycStatus: status,
        kycRemarks: remarks || null
      };

      if (status === 'APPROVED' && !company.hasUsedFreeTrial) {
        // Find default trial plan (e.g. Starter or Professional)
        let trialPlan = await tx.plan.findFirst({
          where: { name: 'Starter' }
        });
        if (!trialPlan) {
          trialPlan = await tx.plan.findFirst();
        }

        if (trialPlan) {
          const startDate = new Date();
          const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

          // Deactivate any existing active subscriptions
          await tx.subscription.updateMany({
            where: { companyId: id, status: 'ACTIVE' },
            data: { status: 'INACTIVE' }
          });

          // Create active trial subscription
          const subscription = await tx.subscription.create({
            data: {
              companyId: id,
              planId: trialPlan.id,
              status: 'ACTIVE',
              startDate,
              endDate,
              paymentProvider: 'MOCK',
              providerSubscriptionId: `trial_${Date.now()}`
            }
          });

          updateData.subscriptionId = subscription.id;
          updateData.hasUsedFreeTrial = true;
          updateData.freeTrialExpiresAt = endDate;
        }
      }

      const updatedCompany = await tx.company.update({
        where: { id },
        data: updateData
      });

      return updatedCompany;
    });

    res.json({ message: `Company KYC updated to ${status} successfully.`, company: result });
  } catch (error) {
    console.error('[ADMIN VERIFY KYC ERROR]:', error.message);
    res.status(500).json({ error: 'Failed to update company KYC status' });
  }
};

module.exports = {
  getCompanies,
  updateCompanyStatus,
  getSubscriptions,
  updateSubscription,
  getMetrics,
  createCustomPlan,
  verifyCompanyKYC
};
