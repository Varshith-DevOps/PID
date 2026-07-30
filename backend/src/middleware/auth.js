/**
 * @fileoverview Authentication middleware.
 * Provides JWT token verification and role-based authorization.
 * @module middleware/auth
 */

const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { runWithCompanyId } = require('../utils/tenantContext');
const { paidThroughFor, assessBilling } = require('../services/dunningService');
const { isTokenBlacklisted } = require('../utils/tokenBlacklist');

/**
 * Middleware to authenticate requests via JWT Bearer token.
 * Extracts the token from the Authorization header, verifies it,
 * and attaches the decoded payload to `req.user`.
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {void}
 */
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  let token;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (decoded.purpose && decoded.purpose !== 'ACCESS') {
      return res.status(401).json({ error: 'MFA verification required before accessing the application.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { employee: { select: { id: true, employeeId: true } } },
    });

    if (!user || !user.isActive) {
      return res.status(403).json({ error: 'Your account has been deactivated. Contact HR.' });
    }

    // Token revocation: check if token is blacklisted (e.g. after logout)
    if (await isTokenBlacklisted(token)) {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }

    // Token revocation: a token is invalid once the user's tokenVersion advances
    // (on logout, password change, or admin reset).
    if ((decoded.tv ?? 0) !== (user.tokenVersion ?? 0)) {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }

    // Sliding expiration: if access token has < 15 minutes remaining, slide it forward
    const now = Math.floor(Date.now() / 1000);
    const timeRemaining = decoded.exp - now;
    if (timeRemaining > 0 && timeRemaining < 15 * 60) {
      const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || '30m';
      const newToken = jwt.sign(
        { id: user.id, email: user.email, role: user.role, purpose: 'ACCESS', tv: user.tokenVersion ?? 0 },
        process.env.JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_TTL }
      );
      res.cookie('token', newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax',
        domain: process.env.COOKIE_DOMAIN || undefined,
        maxAge: 24 * 60 * 60 * 1000
      });
      res.setHeader('x-new-token', newToken);
    }

    // Check Subscription Guard for tenant companies (ignore for global SUPER_ADMIN)
    if (user.companyId && user.role !== 'SUPER_ADMIN') {
      const company = await prisma.company.findUnique({
        where: { id: user.companyId },
        include: {
          subscriptions: {
            where: { status: 'ACTIVE' },
            orderBy: { endDate: 'desc' },
            take: 1
          }
        }
      });

      if (!company || company.status !== 'ACTIVE') {
        return res.status(403).json({ error: 'Access denied. Organization is suspended or inactive.' });
      }

      const isBillingRoute = req.originalUrl.includes('/api/billing') || req.originalUrl.includes('/api/subscriptions') || req.originalUrl.includes('/api/platform/organization/company');
      if (!isBillingRoute) {
        if (company.kycStatus === 'APPROVED') {
          const activeSub = company.subscriptions[0];
          const paidThrough = paidThroughFor(company, activeSub);
          if (!paidThrough) {
            return res.status(402).json({ error: 'No active subscription. Please choose a plan to continue.', billingSuspended: true });
          }
          // Past-due tenants keep access during the grace window; once grace lapses
          // (auto-suspended for non-payment) access is blocked until payment.
          const { state } = assessBilling(paidThrough);
          if (state === 'SUSPENDED_NONPAYMENT') {
            return res.status(402).json({ error: 'Your subscription is past due and access is suspended. Please complete payment to continue.', billingSuspended: true });
          }
        }
      }
    }

    // Platform support/maintenance staff: read-only, scoped to an assigned tenant.
    let effectiveCompanyId = user.companyId;
    let supportViewCompanyId = null;
    if (user.role === 'SUPPORT') {
      // Narrow write exception: support may change a tenant's workspace subdomain
      // (an owner-side platform action, not tenant data). Everything else is read-only.
      const isSubdomainEdit = req.method === 'PUT'
        && /^\/api\/platform-admin\/companies\/[^/]+\/subdomain(?:\?.*)?$/.test(req.originalUrl);

      if (!isSubdomainEdit) {
        // 1. Read-only — reject any mutation outside the auth namespace
        //    (logout / change-password / MFA remain allowed).
        const isAuthPath = req.originalUrl.startsWith('/api/auth/');
        const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
        if (isWrite && !isAuthPath) {
          return res.status(403).json({ error: 'Support accounts have read-only access and cannot modify customer data.' });
        }
      }
      // 2. Resolve the customer being viewed from the request header, and verify
      //    the support user is actively assigned to it.
      const headerCompany = req.headers['x-support-company-id'];
      if (headerCompany) {
        const assignment = await prisma.supportAssignment.findFirst({
          where: { staffUserId: user.id, companyId: String(headerCompany), status: 'ACTIVE' },
        });
        if (!assignment) {
          return res.status(403).json({ error: 'You are not assigned to this customer.' });
        }
        effectiveCompanyId = String(headerCompany);
        supportViewCompanyId = effectiveCompanyId;
      } else {
        // No tenant selected. A null company context is UNSCOPED (cross-tenant),
        // so restrict an unselected support user to the support console + auth
        // namespaces only — never let them read tenant data unscoped.
        const allowed = isSubdomainEdit
          || req.originalUrl.startsWith('/api/support/')
          || req.originalUrl.startsWith('/api/auth/');
        if (!allowed) {
          return res.status(409).json({ error: 'Select a customer to view before accessing this data.' });
        }
        effectiveCompanyId = null;
      }
    }

    req.user = {
      ...decoded,
      role: user.role,
      companyId: effectiveCompanyId,
      supportViewCompanyId,
      employeeId: user.employee?.id || null,
      employeeCode: user.employee?.employeeId || null,
    };

    // Run the rest of the request within the (possibly support-scoped) tenant context
    runWithCompanyId(effectiveCompanyId, () => {
      next();
    });
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Middleware factory to restrict access to specific user roles.
 * Must be used after `authenticate` middleware.
 *
 * @param {...string} roles - Allowed role names (e.g., 'SUPER_ADMIN', 'ADMIN')
 * @returns {import('express').RequestHandler} Express middleware function
 *
 * @example
 * router.get('/admin-only', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), handler);
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied. Insufficient role privileges.' });
    }
    next();
  };
};

module.exports = { authenticate, authorize };
