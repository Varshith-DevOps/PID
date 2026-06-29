'use client';

/**
 * Support-staff "view as tenant" selection, persisted in localStorage and echoed
 * to the backend via the `x-support-company-id` request header (see api.ts).
 * Switching/exiting triggers a full reload so the auth profile re-resolves under
 * the new (or cleared) tenant scope.
 */

const ID_KEY = 'pid_support_company_id';
const NAME_KEY = 'pid_support_company_name';

export function getSupportView(): { companyId: string; companyName: string } | null {
  if (typeof window === 'undefined') return null;
  const companyId = localStorage.getItem(ID_KEY);
  if (!companyId) return null;
  return { companyId, companyName: localStorage.getItem(NAME_KEY) || '' };
}

export function enterSupportView(companyId: string, companyName: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ID_KEY, companyId);
  localStorage.setItem(NAME_KEY, companyName);
  window.location.href = '/dashboard';
}

export function exitSupportView() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ID_KEY);
  localStorage.removeItem(NAME_KEY);
  window.location.href = '/support';
}
