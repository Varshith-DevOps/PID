/**
 * @fileoverview Platform (app-owner) roles and separation-of-duties groups.
 * These are owner-side accounts (no tenant company). Each owner action is gated to
 * the role(s) responsible for it, so e.g. the person approving KYC cannot also
 * change billing or suspend tenants.
 * @module rbac/platformRoles
 */

// All owner-side staff roles a SUPER_ADMIN can create (besides SUPER_ADMIN itself).
const PLATFORM_STAFF_ROLES = ['PLATFORM_ADMIN', 'COMPLIANCE', 'BILLING', 'SALES', 'AUDITOR', 'SUPPORT'];

// Every account that belongs to the owner/platform plane (not a tenant).
const PLATFORM_ACCOUNT_ROLES = ['SUPER_ADMIN', ...PLATFORM_STAFF_ROLES];

// authorize() groups — separation of duties.
const GROUPS = {
  // Read the Control Center / tenant directory.
  VIEW: ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'COMPLIANCE', 'BILLING', 'SALES', 'AUDITOR'],
  // Tenant lifecycle (suspend/deactivate), provisioning, staff & subdomains.
  OPS: ['SUPER_ADMIN', 'PLATFORM_ADMIN'],
  // KYC verification & data governance.
  COMPLIANCE: ['SUPER_ADMIN', 'COMPLIANCE'],
  // Subscriptions, payments, dunning, plans.
  BILLING: ['SUPER_ADMIN', 'BILLING'],
  // Leads / pipeline / plan proposals.
  SALES: ['SUPER_ADMIN', 'SALES', 'BILLING'],
  // Metrics + audit log (read-only oversight).
  AUDIT: ['SUPER_ADMIN', 'AUDITOR', 'PLATFORM_ADMIN'],
  // Create/manage platform staff & support assignments.
  STAFF: ['SUPER_ADMIN', 'PLATFORM_ADMIN'],
  // Subdomain edits (ops + support keep their narrow exception).
  SUBDOMAIN: ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'SUPPORT'],
};

const isPlatformAccount = (role) => PLATFORM_ACCOUNT_ROLES.includes(role);

module.exports = { PLATFORM_STAFF_ROLES, PLATFORM_ACCOUNT_ROLES, GROUPS, isPlatformAccount };
