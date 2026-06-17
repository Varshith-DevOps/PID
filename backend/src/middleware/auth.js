/**
 * @fileoverview Authentication middleware.
 * Provides JWT token verification and role-based authorization.
 * @module middleware/auth
 */

const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { runWithCompanyId } = require('../utils/tenantContext');

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
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.purpose && decoded.purpose !== 'ACCESS') {
      return res.status(401).json({ error: 'MFA verification required before accessing the application.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { employee: { select: { id: true, employeeId: true } } },
    });

    if (!user || !user.isActive) {
      return res.status(403).json({ error: 'Access denied. Account inactive.' });
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
          if (!activeSub || new Date(activeSub.endDate) < new Date()) {
            return res.status(402).json({ error: 'Subscription expired or inactive. Please update your payment plan.' });
          }
        }
      }
    }

    req.user = {
      ...decoded,
      role: user.role,
      companyId: user.companyId,
      employeeId: user.employee?.id || null,
      employeeCode: user.employee?.employeeId || null,
    };

    // Run the rest of the request within the tenant company context
    runWithCompanyId(user.companyId, () => {
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
