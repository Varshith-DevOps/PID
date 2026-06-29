'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import BrandLogo from '@/components/BrandLogo';
import ThemeToggle from '@/components/ThemeToggle';
import { exitSupportView } from '@/lib/supportView';
import { isOwnerRole, ownerTabsFor } from '@/lib/platformRoles';

type NavItem = {
  label: string;
  href: string;
  icon: ReactNode;
  section: string;
  module?: string;
  adminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>, section: 'main' },
  { label: 'AI Command Center', href: '/dashboard/ai-agents', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1 0-3.12 3 3 0 0 1 0-3.88 2.5 2.5 0 0 1 0-3.12A2.5 2.5 0 0 1 9.5 2zM14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 0-3.12 3 3 0 0 0 0-3.88 2.5 2.5 0 0 0 0-3.12A2.5 2.5 0 0 0 14.5 2z"/></svg>, section: 'main' },
  { label: 'Employees', href: '/employees', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, section: 'hr', module: 'EMPLOYEES' },
  { label: 'Org Chart', href: '/org-chart', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="3"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><path d="M12 8v6M5 16v-2h14v2"/></svg>, section: 'hr', module: 'EMPLOYEES' },
  { label: 'Attendance', href: '/attendance', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, section: 'hr', module: 'ATTENDANCE' },
  { label: 'Leave', href: '/leave', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m9 16 2 2 4-4"/></svg>, section: 'hr', module: 'LEAVE' },
  { label: 'Recruitment', href: '/recruitment', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 11v6"/><path d="M16 14h6"/></svg>, section: 'hr', module: 'RECRUITMENT' },
  { label: 'On/Offboarding', href: '/checklists', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>, section: 'hr', module: 'EMPLOYEES' },
  { label: 'Performance', href: '/performance', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>, section: 'hr', module: 'PERFORMANCE' },
  { label: 'Payroll', href: '/payroll', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>, section: 'finance', module: 'PAYROLL', adminOnly: true },
  { label: 'Payslips', href: '/payslips', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>, section: 'finance', module: 'PAYROLL' },
  { label: 'Payslip Format', href: '/payroll/payslip-format', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="12" y2="16"/></svg>, section: 'finance', module: 'PAYROLL', adminOnly: true },
  { label: 'Expense Claims', href: '/expenses', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="2" y1="12" x2="22" y2="12"/></svg>, section: 'finance', module: 'EXPENSES' },
  { label: 'Assets', href: '/assets', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M2 12h20"/></svg>, section: 'work', module: 'ASSETS' },
  { label: 'Learning', href: '/learning', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M4 4v15.5"/><path d="M20 22V6a2 2 0 0 0-2-2H6.5A2.5 2.5 0 0 0 4 6.5"/></svg>, section: 'work', module: 'LEARNING' },
  { label: 'Helpdesk', href: '/helpdesk', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 1 1 5.83 1c0 2-3 2-3 4"/><path d="M12 17h.01"/></svg>, section: 'work', module: 'HELPDESK' },
  { label: 'Notifications', href: '/notifications', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>, section: 'work', module: 'NOTIFICATIONS' },
  { label: 'Projects', href: '/projects', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>, section: 'work', module: 'PROJECTS' },
  { label: 'Project Board', href: '/projects/board', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18"/></svg>, section: 'work', module: 'PROJECTS' },
  { label: 'Timesheet', href: '/timesheet', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>, section: 'work', module: 'ATTENDANCE' },
  { label: 'Overtime', href: '/overtime', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/><line x1="19" y1="5" x2="21" y2="3"/></svg>, section: 'work', module: 'ATTENDANCE' },
  { label: 'Shift Roster', href: '/shifts', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M12 14v4"/><path d="M8 16h8"/></svg>, section: 'work', module: 'ATTENDANCE' },
];

export default function Sidebar({ activePath }: { activePath?: string }) {
  const { user, logout, hasPermission } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const active = activePath || pathname;

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  if (!user) return null;

  const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
  // App-owner accounts (the platform / "Admin Portal") — NOT tenants.
  const isOwner = isOwnerRole(user.role);
  const sections = [
    { key: 'main', label: 'Overview' },
    { key: 'hr', label: 'HR Management' },
    { key: 'finance', label: 'Finance' },
    { key: 'work', label: 'Work' },
  ];

  // ── App-owner portal: a platform-only nav, fully separate from the tenant app,
  //    further filtered per platform role (separation of duties) ──
  if (isOwner) {
    const currentTab = (typeof window !== 'undefined' && active.startsWith('/platform-admin'))
      ? (new URLSearchParams(window.location.search).get('tab') || 'overview')
      : null;
    const allowed = new Set(ownerTabsFor(user.role));
    const icon = (d: string) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: d }} />;
    const ownerNav = ([
      { key: 'overview', label: 'Overview', d: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>' },
      { key: 'tenants', label: 'Tenants', d: '<path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/>' },
      { key: 'kyc', label: 'KYC Approvals', d: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>' },
      { key: 'subscriptions', label: 'Subscriptions', d: '<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>' },
      { key: 'leads', label: 'Leads', d: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/>' },
      { key: 'custom-plan', label: 'Custom Plans', d: '<path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>' },
      { key: 'support', label: 'Platform Staff', d: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },
      { key: 'audit', label: 'Audit Log', d: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>' },
    ] as { key: string; label: string; d: string }[]).filter(i => allowed.has(i.key as any));
    return (
      <aside className="sidebar">
        <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1.5rem 1.25rem' }}>
          <BrandLogo compact height={34} />
          <div style={{ overflow: 'hidden' }}>
            <h1 style={{ fontSize: '1.05rem', fontWeight: 800, lineHeight: 1.2, color: '#fff', margin: 0 }}>PID hcms</h1>
            <span style={{ fontSize: '0.65rem', color: '#73E0E7', textTransform: 'uppercase', display: 'block', letterSpacing: '1px', fontWeight: 700 }}>Admin Portal</span>
          </div>
        </div>
        <nav className="sidebar-nav" style={{ flex: 1 }}>
          <div className="sidebar-section">Platform</div>
          {ownerNav.map(item => (
            <Link key={item.key} href={`/platform-admin?tab=${item.key}`} className={currentTab === item.key ? 'active' : ''}>
              <span className="nav-icon">{icon(item.d)}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div style={{ padding: '0.5rem 1rem 0' }}>
          <ThemeToggle />
        </div>
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">{user.name?.charAt(0)?.toUpperCase()}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user.name}</div>
            <div className="sidebar-user-role">{user.role?.replace('_', ' ')}</div>
          </div>
          <button onClick={handleLogout} title="Logout" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'rgba(255,255,255,0.4)', transition: 'color 0.3s' }} onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')} onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1.5rem 1.25rem' }}>
        {user.companyLogo ? (
          <img src={user.companyLogo} alt="Logo" style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'contain' }} />
        ) : (
          <BrandLogo compact height={34} />
        )}
        <div style={{ overflow: 'hidden' }}>
          <h1 style={{ fontSize: '1.05rem', fontWeight: 800, lineHeight: 1.2, color: '#fff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', margin: 0 }}>{user.companyName || 'PID hcms'}</h1>
          <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', display: 'block', letterSpacing: '0.5px' }}>Human Capital</span>
        </div>
      </div>

      {user.role === 'SUPPORT' && (
        <div style={{ margin: '0 1rem 0.75rem', padding: '0.75rem', borderRadius: '8px', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)', fontSize: '0.7rem' }}>
          <div style={{ fontWeight: 700, letterSpacing: '0.5px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px', color: '#fbbf24' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }} />
            READ-ONLY SUPPORT
          </div>
          <div style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>
            {user.companyName ? `Viewing ${user.companyName}` : 'No customer selected'}
          </div>
          <button onClick={() => exitSupportView()} style={{ marginTop: '6px', background: 'none', border: 'none', color: '#73E0E7', textDecoration: 'underline', fontWeight: 600, cursor: 'pointer', padding: 0, fontSize: '0.7rem' }}>
            Switch customer
          </button>
        </div>
      )}

      <nav className="sidebar-nav" style={{ flex: 1 }}>
        {sections.map(section => {
          const items = NAV_ITEMS.filter(item => item.section === section.key);
          const visibleItems = items.filter(item => {
            if (item.adminOnly && !isAdmin) return false;
            if (item.module && !hasPermission(item.module, 'VIEW')) return false;

            // KYC gating for tenant users. A newly created tenant can immediately do
            // employee data entry, attendance and leave (so they can start setting up);
            // every other tool unlocks once KYC is APPROVED.
            if (user.role !== 'SUPER_ADMIN' && user.role !== 'SALES' && user.role !== 'SUPPORT') {
              if (user.companyKycStatus !== 'APPROVED') {
                const PRE_KYC_MODULES = ['EMPLOYEES', 'ATTENDANCE', 'LEAVE', 'ONBOARDING'];
                if (item.module && !PRE_KYC_MODULES.includes(item.module)) {
                  return false;
                }
                // Hide AI agent hub until verified
                if (item.href === '/dashboard/ai-agents') return false;
              }
            }

            if (user.role !== 'SUPER_ADMIN' && user.subscriptionFeatures) {
              const features = user.subscriptionFeatures;
              if (item.module === 'ATTENDANCE' && !features.attendance) return false;
              if (item.module === 'LEAVE' && !features.leave) return false;
              if (item.module === 'PAYROLL' && !features.payroll) return false;
              if (item.module === 'PERFORMANCE' && !features.performance) return false;
              if (item.module === 'LEARNING' && !features.learning) return false;
              if (item.module === 'HELPDESK' && !features.helpdesk) return false;
              if (item.module === 'INTEGRATIONS' && !features.apiAccess) return false;
              if (item.module === 'WORKFLOWS' && !features.customWorkflows) return false;
            }
            return true;
          });
          if (visibleItems.length === 0) return null;
          return (
            <div key={section.key}>
              <div className="sidebar-section">{section.label}</div>
              {visibleItems.map(item => (
                <Link key={item.href} href={item.href} className={active === item.href || (item.href !== '/dashboard' && active.startsWith(item.href)) ? 'active' : ''}>
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          );
        })}

        {isAdmin && (
          <>
            <div className="sidebar-section">Admin</div>
            {(!user.companyCin || user.companyKycStatus !== 'APPROVED') ? (
              <Link href="/kyc" className={active === '/kyc' ? 'active' : ''}>
                <span className="nav-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </span>
                KYC Verification
              </Link>
            ) : (
              <>
                <Link href="/permissions" className={active === '/permissions' ? 'active' : ''}>
                  <span className="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span>
                  Permissions
                </Link>
                <Link href="/platform" className={active === '/platform' ? 'active' : ''}>
                  <span className="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h10"/><path d="M18 15l2 2 3-4"/></svg></span>
                  Platform Settings
                </Link>
                <Link href="/dashboard/admin" className={active === '/dashboard/admin' ? 'active' : ''}>
                  <span className="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg></span>
                  Analytics
                </Link>
                <Link href="/dashboard/admin/reports" className={active === '/dashboard/admin/reports' ? 'active' : ''}>
                  <span className="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></span>
                  Compliance & Reports
                </Link>
                <Link href="/dashboard/billing" className={active === '/dashboard/billing' ? 'active' : ''}>
                  <span className="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="2" y1="12" x2="22" y2="12"/></svg></span>
                  SaaS Billing
                </Link>
              </>
            )}
          </>
        )}

        {(user.role === 'SUPER_ADMIN' || user.role === 'SALES') && (
          <>
            <div className="sidebar-section">Platform Admin</div>
            <Link href="/platform-admin" className={active.startsWith('/platform-admin') ? 'active' : ''}>
              <span className="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M21 12H3"/><path d="M12 3v18"/></svg></span>
              Control Center
            </Link>
          </>
        )}

        {user.companyKycStatus && user.companyKycStatus !== 'APPROVED' && user.role !== 'SUPER_ADMIN' && user.role !== 'SALES' && user.role !== 'SUPPORT' && (
          <div style={{ margin: '1rem', padding: '0.75rem', borderRadius: '8px', background: user.companyKycStatus === 'REJECTED' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)', border: `1px solid ${user.companyKycStatus === 'REJECTED' ? '#ef4444' : '#f59e0b'}`, color: user.companyKycStatus === 'REJECTED' ? '#ef4444' : '#f59e0b', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
              KYC: {user.companyKycStatus.replace(/_/g, ' ')}
            </div>
            <span style={{ fontSize: '0.65rem', opacity: 0.8, lineHeight: 1.3 }}>
              {user.companyKycStatus === 'REJECTED' 
                ? 'Your registration was rejected. Resubmit details to continue.' 
                : 'Under verification. Access restricted to Attendance & Leave.'}
            </span>
            {isAdmin && (
              <Link href="/kyc" style={{ marginTop: '6px', color: '#73E0E7', textDecoration: 'underline', fontWeight: 600 }}>
                Complete KYC
              </Link>
            )}
          </div>
        )}

        {user.role !== 'SUPER_ADMIN' && user.role !== 'SALES' && user.role !== 'SUPPORT' &&
         (user.billingStatus === 'PAST_DUE' || user.billingStatus === 'SUSPENDED_NONPAYMENT') && (
          <div style={{ margin: '0 1rem 1rem', padding: '0.75rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', fontSize: '0.72rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
              {user.billingStatus === 'SUSPENDED_NONPAYMENT' ? 'Account suspended' : 'Payment past due'}
            </div>
            <span style={{ fontSize: '0.65rem', opacity: 0.85, lineHeight: 1.3 }}>
              {user.billingStatus === 'SUSPENDED_NONPAYMENT'
                ? 'Access is suspended for non-payment. Settle your dues to restore access.'
                : `Your subscription has lapsed.${user.graceEndsAt ? ` Access continues until ${new Date(user.graceEndsAt).toLocaleDateString()}.` : ''} Please pay to avoid suspension.`}
            </span>
            {isAdmin && (
              <Link href="/dashboard/billing" style={{ marginTop: '6px', color: '#73E0E7', textDecoration: 'underline', fontWeight: 600 }}>
                Manage billing
              </Link>
            )}
          </div>
        )}
      </nav>

      <div style={{ padding: '0.5rem 1rem 0' }}>
        <ThemeToggle />
      </div>

      <div className="sidebar-user">
        <div className="sidebar-user-avatar">{user.name?.charAt(0)?.toUpperCase()}</div>
        <div className="sidebar-user-info">
          <div className="sidebar-user-name">{user.name}</div>
          <div className="sidebar-user-role">{user.role?.replace('_', ' ')}</div>
        </div>
        <button onClick={handleLogout} title="Logout" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'rgba(255,255,255,0.4)', transition: 'color 0.3s' }} onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')} onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </button>
      </div>
    </aside>
  );
}
