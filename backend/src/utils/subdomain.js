/**
 * @fileoverview Tenant subdomain helpers.
 * A tenant workspace is reached at `<subdomain>.<APP_BASE_DOMAIN>`. The app owner
 * (super admin / support / sales) uses the apex domain. Subdomains are DNS labels.
 * @module utils/subdomain
 */

// Hosts/labels that are NOT tenant workspaces (apex / infra / owner area).
const RESERVED = new Set([
  '', '__apex__', 'www', 'app', 'api', 'admin', 'owner', 'platform', 'dashboard',
  'portal', 'mail', 'smtp', 'ftp', 'cdn', 'assets', 'static', 'staging', 'localhost',
  'support', 'help', 'status', 'blog', 'docs',
]);

const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/;

/** Normalize a raw subdomain/header value. Reserved/empty → '' (apex). */
function normalizeSubdomain(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (RESERVED.has(s)) return '';
  return s;
}

/** True when `value` is a valid, non-reserved tenant subdomain label. */
function isValidSubdomain(value) {
  const s = String(value || '').trim().toLowerCase();
  if (RESERVED.has(s)) return false;
  return LABEL_RE.test(s);
}

/** Coerce an arbitrary string (e.g. a tenant code) into a usable subdomain label. */
function slugifySubdomain(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

module.exports = { RESERVED, normalizeSubdomain, isValidSubdomain, slugifySubdomain };
