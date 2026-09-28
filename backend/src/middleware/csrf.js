/**
 * @fileoverview CSRF protection using the double-submit cookie pattern.
 *
 * Threat model: the API accepts auth via an httpOnly `token` cookie (see
 * middleware/auth.js), so a cross-site form/request could ride the victim's
 * cookie. Bearer-token (Authorization header) requests are NOT CSRF-able — an
 * attacker's site cannot read or set that header — so they are exempt.
 *
 * Rule: for state-changing methods, require a matching `x-csrf-token` header and
 * `csrfToken` cookie ONLY when the request is authenticated via cookie and has
 * no Bearer header. Unauthenticated requests (no session cookie) are exempt
 * (login/signup bootstrap their own session).
 * @module middleware/csrf
 */

const crypto = require('crypto');

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const CSRF_COOKIE = 'csrfToken';

/** Generate a random CSRF token. */
function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Set the CSRF cookie. Readable by JS (NOT httpOnly) so the SPA can echo it back
 * in the x-csrf-token header — the second half of the double-submit check.
 */
function isSecureCookie(req) {
  if (process.env.COOKIE_SECURE === 'true') return true;
  if (process.env.COOKIE_SECURE === 'false') return false;
  return Boolean(req && (req.secure || req.headers?.['x-forwarded-proto'] === 'https'));
}

function setCsrfCookie(req, res, token) {
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: isSecureCookie(req),
    sameSite: 'Lax',
    domain: process.env.COOKIE_DOMAIN || undefined,
    maxAge: 24 * 60 * 60 * 1000,
  });
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * CSRF guard middleware.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function csrfProtection(req, res, next) {
  if (!MUTATING.has(req.method)) return next();

  // Bearer/API clients cannot be CSRF'd.
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) return next();

  // Auth endpoints that bootstrap, teardown, or renew a session are exempt.
  // They don't have a valid CSRF token yet (login/signup), or the session may
  // already be expired (logout/refresh). The login endpoint clears stale cookies
  // itself; logout is idempotent.
  const AUTH_CSRF_EXEMPT = ['/auth/login', '/auth/logout', '/auth/signup', '/auth/refresh', '/auth/mfa/verify-login'];
  if (AUTH_CSRF_EXEMPT.some((path) => req.originalUrl.includes(path))) return next();

  // Only cookie-authenticated sessions are at risk.
  const sessionCookie = req.cookies && req.cookies.token;
  if (!sessionCookie) return next();

  const cookieToken = req.cookies && req.cookies[CSRF_COOKIE];
  const headerToken = req.headers['x-csrf-token'];
  if (cookieToken && headerToken && timingSafeEqual(cookieToken, headerToken)) {
    return next();
  }
  return res.status(403).json({ error: 'Invalid or missing CSRF token.' });
}

module.exports = { csrfProtection, generateCsrfToken, setCsrfCookie, CSRF_COOKIE };
