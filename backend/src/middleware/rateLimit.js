/**
 * @fileoverview Rate limiting middleware for authentication endpoints.
 * Protects against brute-force attacks by limiting request rates per IP.
 */

const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

// Disable rate limiting under the integration test runner: Jest packs multiple
// suites into one process, so a shared in-memory limiter causes cross-suite
// flakiness. Limiters stay fully active in dev/production.
const skip = () => process.env.NODE_ENV === 'test';

// Optional Redis store so rate limits are shared across multiple app instances
// (in-memory limits are per-process and useless when horizontally scaled).
// Activates only when REDIS_URL is set AND the packages are installed; otherwise
// falls back to the per-process memory store. Install: npm i redis rate-limit-redis
let redisClient = null;
function makeStore(prefix) {
  const url = process.env.REDIS_URL;
  if (!url) return undefined;
  try {
    const { RedisStore } = require('rate-limit-redis');
    if (!redisClient) {
      const { createClient } = require('redis');
      redisClient = createClient({ url });
      redisClient.on('error', (e) => logger.warn('Redis error (rate limiting)', { error: e.message }));
      redisClient.connect().catch((e) => logger.warn('Redis connect failed; rate limiting falls back to memory', { error: e.message }));
    }
    return new RedisStore({ prefix, sendCommand: (...args) => redisClient.sendCommand(args) });
  } catch (e) {
    logger.warn('REDIS_URL set but redis/rate-limit-redis not installed; using in-memory rate limiting', { error: e.message });
    return undefined;
  }
}

/**
 * Global safety net: a default per-IP limit on EVERY request so no route is
 * completely unthrottled. Generous enough not to affect normal SPA usage, low
 * enough to blunt scripted floods. Per-route limiters below stack on top.
 * NOTE: in-memory store is per-process; set REDIS_URL + install redis packages
 * to share limits across cluster workers / instances.
 */
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.GLOBAL_RATE_LIMIT_MAX) || 300,
  message: { error: 'Too many requests. Please slow down and try again shortly.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  store: makeStore('rl:global:'),
});

/**
 * Tighter limiter for unauthenticated public form endpoints (contact, etc.).
 */
const publicFormLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many submissions from this network. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  store: makeStore('rl:publicform:'),
});

/**
 * Limit login requests to 5 per minute per IP.
 */
const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5,
  message: { error: 'Too many login attempts. Please try again after a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  store: makeStore('rl:login:'),
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
  skip,
  store: makeStore('rl:register:'),
});

const publicApplicationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many application submissions. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  store: makeStore('rl:apply:'),
});

/**
 * Limit sensitive authenticated security operations (password reset, password
 * change, MFA setup/enable/disable) to curb brute-force and abuse. Generous
 * enough for normal admin/user workflows, tight enough to matter.
 */
const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  message: { error: 'Too many security operations. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  store: makeStore('rl:sensitive:'),
});

module.exports = { globalLimiter, publicFormLimiter, loginLimiter, registerLimiter, publicApplicationLimiter, sensitiveLimiter };
