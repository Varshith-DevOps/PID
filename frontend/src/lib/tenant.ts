'use client';

/**
 * Resolves the current tenant workspace from the browser host.
 * <subdomain>.<base-domain> = a tenant workspace; the apex/owner host has none.
 * The base domain is NEXT_PUBLIC_BASE_DOMAIN (default 'localhost' for dev, where
 * browsers resolve *.localhost automatically).
 */

const BASE_DOMAIN = (process.env.NEXT_PUBLIC_BASE_DOMAIN || 'localhost').toLowerCase();

const RESERVED = new Set([
  '', '__apex__', 'www', 'app', 'api', 'admin', 'owner', 'platform', 'dashboard',
  'portal', 'mail', 'smtp', 'ftp', 'cdn', 'assets', 'static', 'staging', 'localhost',
  'support', 'help', 'status', 'blog', 'docs',
]);

/** The tenant subdomain for the current host, or '' on the apex/owner host. */
export function getTenantSubdomain(): string {
  if (typeof window === 'undefined') return '';
  const host = window.location.hostname.toLowerCase();
  // Raw IPs never carry a subdomain.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return '';

  let label = '';
  if (host === BASE_DOMAIN) {
    label = '';
  } else if (host.endsWith('.' + BASE_DOMAIN)) {
    label = host.slice(0, host.length - (BASE_DOMAIN.length + 1)).split('.')[0];
  } else {
    // Unknown host shape: treat the first label as the candidate if multi-part.
    const parts = host.split('.');
    label = parts.length > 1 ? parts[0] : '';
  }
  return RESERVED.has(label) ? '' : label;
}

export function isApexHost(): boolean {
  return getTenantSubdomain() === '';
}

/** Header value sent to the API so the backend can enforce workspace binding. */
export function tenantHeaderValue(): string {
  return getTenantSubdomain() || '__apex__';
}

/** Build the absolute workspace URL for a given subdomain (keeps protocol/port). */
export function workspaceUrl(subdomain: string): string {
  if (typeof window === 'undefined') return `https://${subdomain}.${BASE_DOMAIN}`;
  const { protocol, port } = window.location;
  const portPart = port ? `:${port}` : '';
  return `${protocol}//${subdomain}.${BASE_DOMAIN}${portPart}`;
}

export { BASE_DOMAIN };
