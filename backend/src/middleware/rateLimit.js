/**
 * @fileoverview Rate limiting middleware for authentication endpoints.
 * Protects against brute-force attacks by limiting request rates per IP.
 */

const rateLimit = require('express-rate-limit');

/**
 * Limit login requests to 5 per minute per IP.
 */
const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5,
  message: { error: 'Too many login attempts. Please try again after a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Limit registration requests to 3 per minute per IP.
 */
const registerLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 3,
  message: { error: 'Too many accounts created from this IP. Please try again after a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { loginLimiter, registerLimiter };
