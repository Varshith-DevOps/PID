// Owner/platform roles and which Control Center tabs each may use (mirrors the
// backend separation-of-duties groups). SUPPORT is a platform-staff role but uses
// the dedicated /support console, so it is NOT an owner-sidebar role here.

export const OWNER_SIDEBAR_ROLES = ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'COMPLIANCE', 'BILLING', 'SALES', 'AUDITOR'];

export function isOwnerRole(role?: string | null): boolean {
  return !!role && OWNER_SIDEBAR_ROLES.includes(role);
}

export type OwnerTab = 'overview' | 'tenants' | 'kyc' | 'subscriptions' | 'leads' | 'custom-plan' | 'support' | 'audit';

export function ownerTabsFor(role?: string | null): OwnerTab[] {
  switch (role) {
    case 'SUPER_ADMIN': return ['overview', 'tenants', 'kyc', 'subscriptions', 'leads', 'custom-plan', 'support', 'audit'];
    case 'PLATFORM_ADMIN': return ['overview', 'tenants', 'support', 'audit'];
    case 'COMPLIANCE': return ['overview', 'tenants', 'kyc', 'audit'];
    case 'BILLING': return ['overview', 'tenants', 'subscriptions', 'custom-plan'];
    case 'SALES': return ['overview', 'tenants', 'leads', 'custom-plan'];
    case 'AUDITOR': return ['overview', 'tenants', 'audit'];
    default: return [];
  }
}

export const PLATFORM_STAFF_ROLE_OPTIONS = [
  { value: 'SUPPORT', label: 'Support Engineer (read-only customer access)' },
  { value: 'COMPLIANCE', label: 'Compliance Officer (KYC review)' },
  { value: 'BILLING', label: 'Billing Officer (subscriptions & payments)' },
  { value: 'SALES', label: 'Sales Representative (leads & plans)' },
  { value: 'PLATFORM_ADMIN', label: 'Platform Admin (ops & staff)' },
  { value: 'AUDITOR', label: 'Auditor (read-only oversight)' },
];
