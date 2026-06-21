/**
 * @fileoverview Security event logging.
 * Records authentication and authorization events to the structured logger AND
 * (best-effort) to the AuditLog table, so attacks (brute force, IDOR probing,
 * privilege-escalation attempts) leave a searchable trail. No external deps.
 * @module utils/securityEvents
 */

const prisma = require('../config/database');
const logger = require('./logger');

/** Best-effort client IP, honouring a reverse proxy's X-Forwarded-For. */
function clientIp(req) {
  const fwd = req?.headers?.['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req?.ip || req?.socket?.remoteAddress || null;
}

/**
 * Log a security event.
 * @param {import('express').Request} req
 * @param {object} opts
 * @param {string} opts.action  e.g. AUTH_LOGIN_FAILURE, AUTHZ_DENIED
 * @param {string} [opts.entity='AUTH']
 * @param {string} [opts.entityId]
 * @param {string} [opts.userId]
 * @param {string} [opts.userEmail]
 * @param {object} [opts.details]   redacted before logging
 * @param {'info'|'warn'|'error'} [opts.level='warn']
 */
async function logSecurityEvent(req, { action, entity = 'AUTH', entityId = null, userId = null, userEmail = null, details = null, level = 'warn' }) {
  const ip = clientIp(req);
  const emit = logger[level] || logger.warn;
  emit(`SECURITY ${action}`, { userId, userEmail, ip, entity, entityId, ...(details ? { details } : {}) });

  // Persist a durable audit row; never let logging failure break the request.
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        userEmail: userEmail || null,
        action,
        entity,
        entityId: entityId || null,
        ipAddress: ip,
        newDetails: details ? JSON.stringify(details) : null,
      },
    });
  } catch (e) {
    logger.error('Failed to persist security audit log', { error: e.message, action });
  }
}

module.exports = { logSecurityEvent, clientIp };
