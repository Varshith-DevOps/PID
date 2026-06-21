/**
 * @fileoverview Optional error tracking (Sentry).
 * Fully env-gated and dependency-optional: only activates when SENTRY_DSN is set
 * AND the @sentry/node package is installed. Never breaks boot if either is
 * missing — it just logs a one-line notice. Install with: npm i @sentry/node
 * @module config/sentry
 */

const logger = require('../utils/logger');

let sentry = null;

function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return null;
  try {
    // eslint-disable-next-line global-require
    sentry = require('@sentry/node');
    sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0),
    });
    logger.info('Sentry error tracking initialized');
    return sentry;
  } catch (e) {
    logger.warn('SENTRY_DSN is set but @sentry/node is not installed; error tracking disabled', { error: e.message });
    return null;
  }
}

/** Report an exception to Sentry if active (no-op otherwise). */
function captureException(err, context) {
  if (sentry) {
    try { sentry.captureException(err, context ? { extra: context } : undefined); } catch (_) { /* ignore */ }
  }
}

module.exports = { initSentry, captureException };
