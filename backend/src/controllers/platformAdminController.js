const prisma = require('../config/database');
const { isValidSubdomain, normalizeSubdomain } = require('../utils/subdomain');
const { runDunningSweep } = require('../services/dunningService');
const { logPlatformAction } = require('../services/platformAudit');
const bcrypt = require('bcryptjs');

/**
 * Record a (manual/offline) payment for a tenant: extends the active subscription,
 * logs the transaction, and clears any past-due / non-payment-suspended state.
 * POST /api/platform-admin/companies/:id/record-payment
 */
const recordTenantPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const months = Math.max(1, Number.parseInt(req.body.months, 10) || 1);
    const amount = req.body.amount != null ? Number.parseFloat(req.body.amount) : 0;

    const company = await prisma.company.findUnique({
      where: { id },
      include: { subscriptions: { where: { status: 'ACTIVE' }, orderBy: { endDate: 'desc' }, take: 1 } },
    });
    if (!company) return res.status(404).json({ error: 'Company not found.' });
    const activeSub = company.subscriptions[0];
    if (!activeSub) return res.status(400).json({ error: 'No active subscription. Assign a plan before recording a payment.' });

    const now = new Date();
    const base = new Date(activeSub.endDate) > now ? new Date(activeSub.endDate) : now;
    const newEnd = new Date(base);
    newEnd.setMonth(newEnd.getMonth() + months);

    await prisma.subscription.update({ where: { id: activeSub.id }, data: { endDate: newEnd, status: 'ACTIVE' } });
    await prisma.paymentTransaction.create({
      data: { companyId: id, subscriptionId: activeSub.id, amount, status: 'SUCCESS', paymentProvider: 'MANUAL' },
    });
    // Clear payment-driven suspension. Manual `status` is intentionally left as-is
    // (a manual suspend is a separate decision from billing).
    await prisma.company.update({ where: { id }, data: { billingStatus: 'CURRENT', graceEndsAt: null } });

    await logPlatformAction(req.user, { action: 'RECORD_PAYMENT', entity: 'Company', entityId: id, newDetails: { amount, months, paidThrough: newEnd }, ipAddress: req.ip });
    res.json({ message: `Payment recorded. ${company.name} is paid through ${newEnd.toDateString()}.`, paidThrough: newEnd });
  } catch (error) {
    console.error('[RECORD PAYMENT ERROR]:', error.message);
    res.status(500).json({ error: 'Failed to record payment' });
  }
};

/**
 * Owner audit log — every platform-side action (who did what, when). Read-only.
 * GET /api/platform-admin/audit-logs?action=&actor=&days=&take=
 */
const getAuditLogs = async (req, res) => {
  try {
    const take = Math.min(500, Math.max(1, Number.parseInt(req.query.take, 10) || 200));
    const where = { category: 'PLATFORM' };
    if (req.query.action) where.action = { contains: String(req.query.action).toUpperCase() };
    if (req.query.actor) where.userEmail = { contains: String(req.query.actor).toLowerCase() };
    if (req.query.days) {
      const days = Number.parseInt(req.query.days, 10);
      if (days > 0) where.createdAt = { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
    }
    const logs = await prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take });
    res.json({ logs });
  } catch (error) {
    console.error('[AUDIT LOGS ERROR]:', error.message);
    res.status(500).json({ error: 'Failed to load audit logs' });
  }
};

/** Run the dunning sweep now (also runs on a daily schedule). POST /api/platform-admin/billing/run-dunning */
const runDunning = async (req, res) => {
  try {
    const summary = await runDunningSweep(req.user);
    res.json({ message: 'Dunning sweep complete.', ...summary });
  } catch (error) {
    console.error('[RUN DUNNING ERROR]:', error.message);
    res.status(500).json({ error: 'Failed to run dunning sweep' });
  }
};

/**
 * Change a tenant's workspace subdomain. Owner-side only (SUPER_ADMIN or SUPPORT);
 * tenants can never change their own. PUT /api/platform-admin/companies/:id/subdomain
 */
const updateCompanySubdomain = async (req, res) => {
  try {
    const { id } = req.params;
    const requested = normalizeSubdomain(req.body.subdomain);

    if (!isValidSubdomain(requested)) {
      return res.status(400).json({ error: 'Invalid subdomain. Use 3–63 letters, digits, or hyphens, and avoid reserved names.' });
    }

    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) return res.status(404).json({ error: 'Company not found.' });

    // Support staff may only change subdomains for customers assigned to them.
    if (req.user?.role === 'SUPPORT') {
      const assigned = await prisma.supportAssignment.findFirst({
        where: { staffUserId: req.user.id, companyId: id, status: 'ACTIVE' },
      });
      if (!assigned) return res.status(403).json({ error: 'You are not assigned to this customer.' });
    }

    const clash = await prisma.company.findFirst({ where: { subdomain: requested, NOT: { id } } });
    if (clash) return res.status(409).json({ error: 'That subdomain is already taken by another tenant.' });

    const updated = await prisma.company.update({
      where: { id },
      data: { subdomain: requested },
      select: { id: true, name: true, code: true, subdomain: true },
    });
    await logPlatformAction(req.user, { action: 'TENANT_SUBDOMAIN', entity: 'Company', entityId: id, oldDetails: company.subdomain, newDetails: requested, ipAddress: req.ip });
    res.json({ message: `Subdomain updated to "${requested}".`, company: updated });
  } catch (error) {
    console.error('[ADMIN UPDATE SUBDOMAIN ERROR]:', error.message);
    res.status(500).json({ error: 'Failed to update subdomain' });
  }
};

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
 * Create a new tenant company manually.
 * POST /api/platform-admin/companies
 */
const createCompany = async (req, res) => {
  try {
    const { 
      name, email, phone, address, industry, companySize, 
      planId, durationDays, billingCycle, status,
      adminName, adminEmail, adminPassword, code: inputCode, subdomain: inputSubdomain
    } = req.body;
    
    if (!name) return res.status(400).json({ error: 'Company name is required.' });
    if (!adminEmail || !adminPassword || !adminName) return res.status(400).json({ error: 'Admin name, email, and password are required.' });

    // Check if admin email already exists globally
    const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (existingUser) return res.status(409).json({ error: 'A user with the admin email already exists.' });

    // Auto-generate code and subdomain if not provided
    const code = inputCode ? inputCode.toUpperCase().replace(/[^A-Z0-9]/g, '') : name.substring(0, 4).toUpperCase().replace(/[^A-Z]/g, '') + Math.floor(1000 + Math.random() * 9000);
    const subdomain = inputSubdomain ? normalizeSubdomain(inputSubdomain) : code.toLowerCase();
    
    if (!isValidSubdomain(subdomain)) {
      return res.status(400).json({ error: 'Invalid subdomain format.' });
    }

    // Default plan logic
    let defaultPlanId = planId;
    if (!defaultPlanId) {
      const plan = await prisma.plan.findFirst();
      if (plan) defaultPlanId = plan.id;
    }

    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Run creation in a sequential manner (since Company is required for the rest)
    const company = await prisma.company.create({
      data: {
        name,
        code,
        subdomain,
        email,
        phone,
        address,
        industry,
        companySize,
        kycStatus: 'APPROVED',
        status: status || 'ACTIVE'
      }
    });

    let subscription;
    if (defaultPlanId) {
      const duration = durationDays ? parseInt(durationDays, 10) : (billingCycle === 'ANNUAL' ? 365 : 30);
      const endDate = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
      subscription = await prisma.subscription.create({
        data: {
          companyId: company.id,
          planId: defaultPlanId,
          status: 'ACTIVE',
          startDate: new Date(),
          endDate
        }
      });
      await prisma.company.update({
        where: { id: company.id },
        data: { subscriptionId: subscription.id }
      });
    }

    // Create a default department
    const defaultDepartment = await prisma.department.create({
      data: {
        name: 'Administration',
        company: { connect: { id: company.id } }
      }
    });

    // Extract names for Admin User
    const nameParts = adminName.split(' ');
    const firstName = nameParts[0];
    // Create Company Admin user
    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        name: adminName,
        role: 'ADMIN',
        isActive: true,
        company: { connect: { id: company.id } }
      }
    });

    // Create employee record for admin
    await prisma.employee.create({
      data: {
        employeeId: `EMP-${code}-001`,
        firstName,
        lastName: nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Admin',
        email: adminEmail,
        jobTitle: 'Administrator',
        salary: 0,
        joinDate: new Date(),
        accountStage: 'ACTIVE',
        user: { connect: { id: adminUser.id } },
        company: { connect: { id: company.id } },
        department: { connect: { id: defaultDepartment.id } }
      }
    });

    await logPlatformAction(req.user, { action: 'CREATE_TENANT', entity: 'Company', entityId: company.id, newDetails: { name, code, subdomain, adminEmail }, ipAddress: req.ip });
    res.status(201).json(company);
  } catch (error) {
    console.error('[ADMIN CREATE COMPANY ERROR]:', error.message);
    if (error.code === 'P2002') return res.status(409).json({ error: 'Code or subdomain conflict, please try again.' });
    res.status(500).json({ error: 'Failed to create tenant company' });
  }
};

/**
 * Edit an existing tenant company.
 * PUT /api/platform-admin/companies/:id
 */
const updateCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, address, industry, companySize, kycStatus } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;
    if (industry !== undefined) updateData.industry = industry;
    if (companySize !== undefined) updateData.companySize = companySize;
    if (kycStatus !== undefined) updateData.kycStatus = kycStatus;

    const company = await prisma.company.update({
      where: { id },
      data: updateData
    });
    await logPlatformAction(req.user, { action: 'UPDATE_TENANT', entity: 'Company', entityId: id, newDetails: updateData, ipAddress: req.ip });
    res.json(company);
  } catch (error) {
    console.error('[ADMIN UPDATE COMPANY ERROR]:', error.message);
    res.status(500).json({ error: 'Failed to update tenant company' });
  }
};

/**
 * Delete a tenant company completely (hard cascade delete).
 * DELETE /api/platform-admin/companies/:id
 */
const deleteCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) return res.status(404).json({ error: 'Company not found' });
    
    // Delete company (cascades automatically because of schema relations)
    await prisma.company.delete({ where: { id } });
    await logPlatformAction(req.user, { action: 'DELETE_TENANT', entity: 'Company', entityId: id, oldDetails: { name: company.name, code: company.code }, ipAddress: req.ip });
    res.json({ message: 'Tenant company successfully deleted.' });
  } catch (error) {
    console.error('[ADMIN DELETE COMPANY ERROR]:', error.message);
    res.status(500).json({ error: 'Failed to delete tenant company' });
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

    await logPlatformAction(req.user, { action: 'TENANT_STATUS', entity: 'Company', entityId: id, newDetails: status, ipAddress: req.ip });
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

    await logPlatformAction(req.user, { action: 'SUBSCRIPTION_UPDATE', entity: 'Subscription', entityId: id, newDetails: { planId, status, endDate }, ipAddress: req.ip });
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
    if (
      req.user?.role === 'SALES' &&
      process.env.NODE_ENV === 'production' &&
      process.env.ALLOW_SALES_CUSTOM_PLANS !== 'true'
    ) {
      return res.status(403).json({ error: 'Sales custom plan assignment requires production approval workflow.' });
    }

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

    await logPlatformAction(req.user, { action: 'CUSTOM_PLAN', entity: 'Company', entityId: id, newDetails: { name, price }, ipAddress: req.ip });
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

    if (!status || !['APPROVED', 'REJECTED', 'NEEDS_INFO'].includes(status)) {
      return res.status(400).json({ error: 'Valid status (APPROVED, REJECTED, or NEEDS_INFO) is required.' });
    }
    if (status === 'NEEDS_INFO' && !String(remarks || '').trim()) {
      return res.status(400).json({ error: 'Remarks explaining what is needed are required for "Needs Info".' });
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

    await logPlatformAction(req.user, { action: 'KYC_DECISION', entity: 'Company', entityId: id, oldDetails: company.kycStatus, newDetails: { status, remarks: remarks || null }, ipAddress: req.ip });
    res.json({ message: `Company KYC updated to ${status} successfully.`, company: result });
  } catch (error) {
    console.error('[ADMIN VERIFY KYC ERROR]:', error.message);
    res.status(500).json({ error: 'Failed to update company KYC status' });
  }
};

module.exports = {
  getCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
  updateCompanyStatus,
  getSubscriptions,
  updateSubscription,
  getMetrics,
  createCustomPlan,
  verifyCompanyKYC,
  updateCompanySubdomain,
  recordTenantPayment,
  runDunning,
  getAuditLogs
};
