'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>, section: 'main' },
  { label: 'Employees', href: '/employees', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, section: 'hr', module: 'EMPLOYEES' },
  { label: 'Attendance', href: '/attendance', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, section: 'hr', module: 'ATTENDANCE' },
  { label: 'Leave', href: '/leave', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m9 16 2 2 4-4"/></svg>, section: 'hr', module: 'LEAVE' },
  { label: 'Payroll', href: '/payroll', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>, section: 'finance', module: 'PAYROLL', adminOnly: true },
  { label: 'Payslips', href: '/payslips', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>, section: 'finance', module: 'REPORTS' },
  { label: 'Projects', href: '/projects', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>, section: 'work', module: 'REPORTS' },
  { label: 'Timesheet', href: '/timesheet', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>, section: 'work', module: 'ATTENDANCE' },
  { label: 'Overtime', href: '/overtime', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/><line x1="19" y1="5" x2="21" y2="3"/></svg>, section: 'work', module: 'REPORTS' },
];

export default function Sidebar({ activePath }: { activePath?: string }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const active = activePath || pathname;

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  if (!user) return null;

  const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
  const sections = [
    { key: 'main', label: 'Overview' },
    { key: 'hr', label: 'HR Management' },
    { key: 'finance', label: 'Finance' },
    { key: 'work', label: 'Work' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h1>NexusHR</h1>
        <span>Management System</span>
      </div>

      <nav className="sidebar-nav">
        {sections.map(section => {
          const items = NAV_ITEMS.filter(item => item.section === section.key);
          const visibleItems = items.filter(item => !item.adminOnly || isAdmin);
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
            <Link href="/permissions" className={active === '/permissions' ? 'active' : ''}>
              <span className="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span>
              Permissions
            </Link>
            <Link href="/dashboard/admin" className={active === '/dashboard/admin' ? 'active' : ''}>
              <span className="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg></span>
              Analytics
            </Link>
          </>
        )}
      </nav>

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
