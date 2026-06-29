/**
 * @fileoverview Platform (owner-side) audit logging. Records who-did-what for
 * owner actions (KYC decisions, tenant suspends, billing, role/staff changes) into
 * the global AuditLog with category=PLATFORM, for the owner Audit viewer.
 * @module services/platformAudit
 */
const prisma = require('../config/database');

const clip = (v) => (v == null ? null : String(typeof v === 'object' ? JSON.stringify(v) : v).slice(0, 2000));

/**
 * @param {{id?:string,email?:string,role?:string}|null} actor - acting user (null = system)
 * @param {{action:string,entity:string,entityId?:string,oldDetails?:any,newDetails?:any,ipAddress?:string}} ev
 */
async function logPlatformAction(actor, ev) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: actor?.id || null,
        userEmail: actor?.email || (actor ? null : 'system'),
        actorRole: actor?.role || 'SYSTEM',
        category: 'PLATFORM',
        action: ev.action,
        entity: ev.entity,
        entityId: ev.entityId || null,
        oldDetails: clip(ev.oldDetails),
        newDetails: clip(ev.newDetails),
        ipAddress: ev.ipAddress || null,
      },
    });
  } catch (e) {
    console.error('[PLATFORM AUDIT ERROR]:', e.message);
  }
}

module.exports = { logPlatformAction };
