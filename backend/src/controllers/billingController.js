const prisma = require('../config/database');
const crypto = require('crypto');

const mockBillingAllowed = () => (
  process.env.NODE_ENV !== 'production' || process.env.ALLOW_MOCK_BILLING === 'true'
);

const rejectMockBillingInProduction = (res) => {
  if (mockBillingAllowed()) return false;
  res.status(503).json({
    error: 'Billing provider is not configured. Mock billing is disabled in production.'
  });
  return true;
};

/**
 * Get all active pricing plans.
 * GET /api/billing/plans
 */
const getPlans = async (req, res) => {
  try {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' }
    });
    res.json(plans);
  } catch (error) {
    console.error('[GET PLANS ERROR]:', error.message);
    res.status(500).json({ error: 'Failed to retrieve pricing plans' });
  }
};

/**
 * Get tenant subscription details, limits, and usage.
 * GET /api/billing/subscription
 */
const getSubscription = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    if (!companyId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        subscriptions: {
          include: { plan: true },
          orderBy: { endDate: 'desc' },
          take: 1
        }
      }
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Get current employee usage count
    const employeeCount = await prisma.employee.count({
      where: { companyId }
    });

    const activeSub = company.subscriptions[0] || null;

    res.json({
      company: {
        id: company.id,
        name: company.name,
        code: company.code,
        status: company.status
      },
      subscription: activeSub,
      usage: {
        employeeCount,
        employeeLimit: activeSub?.plan?.employeeLimit || 0,
        isNearLimit: activeSub ? (employeeCount >= activeSub.plan.employeeLimit * 0.9) : false,
        isExceeded: activeSub ? (employeeCount >= activeSub.plan.employeeLimit) : false
      }
    });
  } catch (error) {
    console.error('[GET SUBSCRIPTION ERROR]:', error.message);
    res.status(500).json({ error: 'Failed to retrieve subscription status' });
  }
};

/**
 * Create a mock payment transaction.
 * POST /api/billing/checkout
 */
const checkout = async (req, res) => {
  try {
    if (rejectMockBillingInProduction(res)) return;
    const companyId = req.user.companyId;
    const { planId } = req.body;

    if (!companyId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }
    if (!planId) {
      return res.status(400).json({ error: 'Plan ID is required' });
    }

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    // Create a pending transaction
    const transaction = await prisma.paymentTransaction.create({
      data: {
        companyId,
        amount: plan.price,
        currency: 'INR',
        status: 'PENDING',
        paymentProvider: 'MOCK',
        providerPaymentId: `txn_mock_${crypto.randomBytes(8).toString('hex')}`
      }
    });

    res.json({
      message: 'Checkout session initialized successfully',
      transaction,
      plan
    });
  } catch (error) {
    console.error('[CHECKOUT ERROR]:', error.message);
    res.status(500).json({ error: 'Failed to initialize checkout' });
  }
};

/**
 * Confirm the mock payment and update subscription status.
 * POST /api/billing/confirm-payment
 */
const confirmPayment = async (req, res) => {
  try {
    if (rejectMockBillingInProduction(res)) return;
    const companyId = req.user.companyId;
    const { transactionId, planId, status } = req.body;

    if (!companyId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }
    if (!transactionId || !planId) {
      return res.status(400).json({ error: 'Transaction ID and Plan ID are required' });
    }

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const transaction = await prisma.paymentTransaction.findFirst({
      where: { id: transactionId, companyId }
    });
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction record not found' });
    }

    if (status === 'FAILED') {
      await prisma.paymentTransaction.update({
        where: { id: transactionId },
        data: { status: 'FAILED' }
      });
      return res.json({ success: false, message: 'Payment failed' });
    }

    // Process subscription update in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update transaction status
      const updatedTxn = await tx.paymentTransaction.update({
        where: { id: transactionId },
        data: { status: 'SUCCESS' }
      });

      // 2. Create/Extend subscription (30 days from now)
      const duration = 30 * 24 * 60 * 60 * 1000;
      const startDate = new Date();
      const endDate = new Date(Date.now() + duration);

      const subscription = await tx.subscription.create({
        data: {
          companyId,
          planId: plan.id,
          status: 'ACTIVE',
          startDate,
          endDate,
          paymentProvider: 'MOCK',
          providerSubscriptionId: `sub_mock_${crypto.randomBytes(8).toString('hex')}`
        }
      });

      // Link subscription transaction
      await tx.paymentTransaction.update({
        where: { id: transactionId },
        data: { subscriptionId: subscription.id }
      });

      // 3. Update company subscription pointer
      await tx.company.update({
        where: { id: companyId },
        data: { subscriptionId: subscription.id }
      });

      return { transaction: updatedTxn, subscription };
    });

    res.json({
      success: true,
      message: 'Subscription activated successfully',
      subscription: result.subscription
    });
  } catch (error) {
    console.error('[CONFIRM PAYMENT ERROR]:', error.message);
    res.status(500).json({ error: 'Failed to process payment confirmation' });
  }
};

/**
 * Get payment transactions history.
 * GET /api/billing/transactions
 */
const getTransactions = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    if (!companyId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }

    const transactions = await prisma.paymentTransaction.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      include: {
        subscription: {
          include: { plan: true }
        }
      }
    });

    res.json(transactions);
  } catch (error) {
    console.error('[GET TRANSACTIONS ERROR]:', error.message);
    res.status(500).json({ error: 'Failed to fetch transaction history' });
  }
};

module.exports = {
  getPlans,
  getSubscription,
  checkout,
  confirmPayment,
  getTransactions
};
