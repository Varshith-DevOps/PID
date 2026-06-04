/**
 * @fileoverview Authentication middleware.
 * Provides JWT token verification and role-based authorization.
 * @module middleware/auth
 */

const jwt = require('jsonwebtoken');

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
const authenticate = (req, res, next) => {
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
    req.user = decoded;
    next();
  } catch (error) {
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