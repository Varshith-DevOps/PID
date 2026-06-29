/**
 * @fileoverview Dunning / non-payment lifecycle.
 * A tenant is paid through its active subscription's endDate (or trial expiry).
 * After that date a configurable grace window keeps access open (PAST_DUE); once
 * grace lapses the tenant is auto-suspended for non-payment (SUSPENDED_NONPAYMENT),
 * which the auth guard enforces. State is persisted on Company for owner visibility.
 * @module services/dunningService
 */
const prisma = require('../config/database');
const { logPlatformAction } = require('./platformAudit');

const GRACE_DAYS = Number.parseInt(process.env.BILLING_GRACE_DAYS, 10) > 0
  ? Number.parseInt(process.env.BILLING_GRACE_DAYS, 10)
  : 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const STATES = { CURRENT: 'CURRENT', PAST_DUE: 'PAST_DUE', SUSPENDED: 'SUSPENDED_NONPAYMENT' };

/** The date a company is paid through: active paid subscription end, else trial expiry. */
function paidThroughFor(company, activeSub) {
  if (activeSub?.endDate) return new Date(activeSub.endDate);
  if (company?.freeTrialExpiresAt) return new Date(company.freeTrialExpiresAt);
  return null;
}

/** Classify billing state from a paid-through date. */
function assessBilling(paidThrough, now = new Date()) {
  if (!paidThrough) return { state: STATES.CURRENT, graceEndsAt: null, paidThrough: null };
  const through = new Date(paidThrough);
  if (through >= now) return { state: STATES.CURRENT, graceEndsAt: null, paidThrough: through };
  const graceEndsAt = new Date(through.getTime() + GRACE_DAYS * DAY_MS);
  return {
    state: now <= graceEndsAt ? STATES.PAST_DUE : STATES.SUSPENDED,
    graceEndsAt,
    paidThrough: through,
  };
}

/** Evaluate one company (given its active subscription) without persisting. */
function evaluateCompany(company, activeSub, now = new Date()) {
  return assessBilling(paidThroughFor(company, activeSub), now);
}

/**
 * Sweep all KYC-approved tenants, persist billingStatus + graceEndsAt, and log any
 * state transitions. Safe to run repeatedly (idempotent). `actor` is null for the
 * scheduler, or the requesting owner for a manual run.
 */
async function runDunningSweep(actor = null) {
  const now = new Date();
  const companies = await prisma.company.findMany({
    where: { kycStatus: 'APPROVED' },
    include: { subscriptions: { where: { status: 'ACTIVE' }, orderBy: { endDate: 'desc' }, take: 1 } },
  });

  const summary = { scanned: companies.length, current: 0, pastDue: 0, suspended: 0, changed: 0, graceDays: GRACE_DAYS };
  for (const c of companies) {
    const { state, graceEndsAt } = evaluateCompany(c, c.subscriptions[0], now);
    if (state === STATES.PAST_DUE) summary.pastDue++;
    else if (state === STATES.SUSPENDED) summary.suspended++;
    else summary.current++;

    const graceChanged = (graceEndsAt ? graceEndsAt.getTime() : null) !== (c.graceEndsAt ? new Date(c.graceEndsAt).getTime() : null);
    if (c.billingStatus !== state || graceChanged) {
      await prisma.company.update({ where: { id: c.id }, data: { billingStatus: state, graceEndsAt } });
      if (c.billingStatus !== state) {
        summary.changed++;
        await logPlatformAction(actor, { action: 'BILLING_STATE_CHANGE', entity: 'Company', entityId: c.id, oldDetails: c.billingStatus, newDetails: state });
      }
    }
  }
  return { ...summary, ranAt: now };
}

module.exports = { GRACE_DAYS, STATES, paidThroughFor, assessBilling, evaluateCompany, runDunningSweep };
