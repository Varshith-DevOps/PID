'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { CanView } from '@/components/PermissionGuard';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';

const MODULES = [
  { label: 'Employees', desc: 'Manage employee records', href: '/employees', module: 'EMPLOYEES', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
  { label: 'Attendance', desc: 'Track daily attendance', href: '/attendance', module: 'ATTENDANCE', color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
  { label: 'Leave', desc: 'Manage leave requests', href: '/leave', module: 'LEAVE', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
  { label: 'Payroll', desc: 'Process payroll', href: '/payroll', module: 'PAYROLL', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> },
  { label: 'Payslips', desc: 'View & download payslips', href: '/payslips', module: 'REPORTS', color: '#06b6d4', bg: 'rgba(6,182,212,0.12)', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
  { label: 'Projects', desc: 'Manage projects & tasks', href: '/projects', module: 'REPORTS', color: '#ec4899', bg: 'rgba(236,72,153,0.12)', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> },
  { label: 'Timesheet', desc: 'Log daily work hours', href: '/timesheet', module: 'ATTENDANCE', color: '#14b8a6', bg: 'rgba(20,184,166,0.12)', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> },
  { label: 'Overtime', desc: 'Manage OT requests', href: '/overtime', module: 'REPORTS', color: '#f97316', bg: 'rgba(249,115,22,0.12)', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/><line x1="19" y1="5" x2="21" y2="3"/></svg> },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  if (!user) return null;

  const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        {/* Welcome Banner */}
        <div className="welcome-banner">
          <div className="welcome-title">Welcome back, {user.name}! 👋</div>
          <div className="welcome-subtitle">Role: {user.role?.replace('_', ' ')} · {user.email}</div>
        </div>

        {/* Module Grid */}
        <div className="module-grid">
          {MODULES.map((mod, i) => (
            <CanView key={mod.href} module={mod.module}>
              <Link href={mod.href} className="module-card" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="module-card-icon" style={{ background: mod.bg }}>
                  <span style={{ color: mod.color }}>{mod.icon}</span>
                </div>
                <h3>{mod.label}</h3>
                <p>{mod.desc}</p>
              </Link>
            </CanView>
          ))}

          {isAdmin && (
            <Link href="/dashboard/admin" className="module-card">
              <div className="module-card-icon" style={{ background: 'rgba(59,130,246,0.12)' }}>
                <span style={{ color: '#3b82f6' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg></span>
              </div>
              <h3>Admin Dashboard</h3>
              <p>Overview & analytics</p>
            </Link>
          )}

          {user.role === 'MANAGER' && (
            <Link href="/dashboard/manager" className="module-card">
              <div className="module-card-icon" style={{ background: 'rgba(16,185,129,0.12)' }}>
                <span style={{ color: '#10b981' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>
              </div>
              <h3>Manager Hub</h3>
              <p>Team workload & tasks</p>
            </Link>
          )}

          {user.role === 'EMPLOYEE' && (
            <Link href="/dashboard/employee" className="module-card">
              <div className="module-card-icon" style={{ background: 'rgba(139,92,246,0.12)' }}>
                <span style={{ color: '#8b5cf6' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>
              </div>
              <h3>My Dashboard</h3>
              <p>My tasks & hours</p>
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}