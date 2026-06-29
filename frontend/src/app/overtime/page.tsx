'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { getEmployeeOvertime, approveOvertime, rejectOvertime, getOTSummary } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import {
  Banner,
  Button,
  ConfirmDialog,
  DataTable,
  LoadingBlock,
  PageHeader,
  StatCard,
  StatusChip,
  Tabs,
} from '@/components/ui';
import type { Column } from '@/components/ui';

interface OvertimeEntry extends Record<string, unknown> {
  id: string;
  employee: { id: string; firstName: string; lastName: string };
  date: string;
  regularHours: number;
  otHours: number;
  status: string;
  reason: string;
  rejectReason: string;
}

const OT_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/><line x1="19" y1="5" x2="21" y2="3"/></svg>
);

export default function OvertimePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [overtime, setOvertime] = useState<OvertimeEntry[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'requests' | 'summary'>('requests');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);

  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
  const canAction = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.role === 'MANAGER';

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading]);

  useEffect(() => {
    if (user) loadOvertime();
  }, [user]);

  useEffect(() => {
    if (user && (view === 'summary') && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN')) loadSummary();
  }, [user, view]);

  const loadOvertime = async () => {
    setLoading(true);
    try {
      let employeeId = undefined;
      if (user?.role === 'EMPLOYEE') {
        employeeId = user.id;
      }
      const data = await getEmployeeOvertime({ employeeId });
      setOvertime(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadSummary = async () => {
    setLoading(true);
    try {
      const data = await getOTSummary({});
      setSummary(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleApprove = async (id: string) => {
    try {
      await approveOvertime(id);
      loadOvertime();
      alert('Overtime approved');
    } catch (err) { alert('Failed to approve'); }
  };

  const handleReject = async (reason?: string) => {
    if (!rejectingId) return;
    setRejectLoading(true);
    try {
      await rejectOvertime(rejectingId, reason ?? rejectReason);
      setRejectingId(null);
      setRejectReason('');
      loadOvertime();
      alert('Overtime rejected');
    } catch (err) { alert('Failed to reject'); }
    finally { setRejectLoading(false); }
  };

  const getStatusCount = (status: string) => overtime.filter((o) => o.status === status).length;

  if (authLoading || !user) return <LoadingBlock label="Loading…" />;

  const tabItems = [
    { key: 'requests', label: 'Requests' },
    ...(isAdmin ? [{ key: 'summary', label: 'Summary' }] : []),
  ];

  const requestColumns: Column<OvertimeEntry>[] = [
    { key: 'employee', header: 'Employee', render: (ot) => <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ot.employee?.firstName} {ot.employee?.lastName}</span> },
    { key: 'date', header: 'Date', render: (ot) => new Date(ot.date).toLocaleDateString() },
    { key: 'regular', header: 'Regular', align: 'center', render: (ot) => `${ot.regularHours}h` },
    { key: 'otHours', header: 'OT Hours', align: 'center', render: (ot) => <span style={{ fontWeight: 700, color: 'var(--danger)' }}>{ot.otHours}h</span> },
    { key: 'reason', header: 'Reason', render: (ot) => <span style={{ display: 'inline-block', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ot.reason || '—'}</span> },
    { key: 'status', header: 'Status', render: (ot) => <StatusChip status={ot.status} /> },
    {
      key: 'actions', header: 'Actions', render: (ot) => (
        ot.status === 'PENDING' && canAction ? (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button variant="success" size="sm" onClick={() => handleApprove(ot.id)}>Approve</Button>
            <Button variant="danger" size="sm" onClick={() => setRejectingId(ot.id)}>Reject</Button>
          </div>
        ) : null
      ),
    },
  ];

  const summaryColumns: Column<any>[] = [
    { key: 'employee', header: 'Employee', render: (emp) => <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{emp.employee?.firstName} {emp.employee?.lastName}</span> },
    { key: 'otHours', header: 'OT Hours', align: 'center', render: (emp) => <span style={{ fontWeight: 700, color: 'var(--danger)' }}>{emp.otHours?.toFixed(1)}h</span> },
    { key: 'basicSalary', header: 'Basic Salary', align: 'right', render: (emp) => `₹${emp.basicSalary?.toLocaleString()}` },
    { key: 'otPay', header: 'OT Pay', align: 'right', render: (emp) => <span style={{ fontWeight: 700, color: 'var(--success)' }}>₹{emp.otPay?.toFixed(0)}</span> },
  ];

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <PageHeader
          title="Overtime"
          subtitle="Manage overtime requests"
          icon={<div className="page-header-icon" style={{ background: 'linear-gradient(135deg, #14b8a6, #10b981)' }}>{OT_ICON}</div>}
          actions={<Tabs items={tabItems} value={view} onChange={(k) => setView(k as typeof view)} />}
        />

        {view === 'requests' && (
          <>
            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <StatCard label="Pending" value={<span className="text-warning">{getStatusCount('PENDING')}</span>} />
              <StatCard label="Approved" value={<span className="text-success">{getStatusCount('APPROVED')}</span>} />
              <StatCard label="Rejected" value={<span className="text-danger">{getStatusCount('REJECTED')}</span>} />
            </div>

            <DataTable
              columns={requestColumns}
              rows={overtime}
              loading={loading}
              rowKey={(ot) => ot.id}
              emptyTitle="No overtime requests"
              emptyMessage="Overtime requests will appear here once submitted."
            />

            <ConfirmDialog
              open={!!rejectingId}
              title="Reject Overtime"
              message="Provide a reason for rejecting this overtime request."
              tone="danger"
              confirmLabel="Reject"
              requireReason
              reasonLabel="Reason for rejection"
              loading={rejectLoading}
              onConfirm={(reason) => handleReject(reason)}
              onCancel={() => { setRejectingId(null); setRejectReason(''); }}
            />
          </>
        )}

        {view === 'summary' && isAdmin && (
          <>
            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <StatCard label="Total OT Pay" value={<span className="text-success">₹{summary?.totalOTPay?.toFixed(0) || 0}</span>} />
              <StatCard label="OT Multiplier" value={<span className="text-blue">{summary?.settings?.otMultiplier || 1.5}x</span>} />
              <StatCard label="Standard Hours/Month" value={`${summary?.settings?.standardHours || 176}h`} />
            </div>

            <DataTable
              columns={summaryColumns}
              rows={summary?.summary || []}
              loading={loading}
              rowKey={(_, i) => i}
              emptyTitle="No summary data"
              emptyMessage="Overtime summary by employee will appear here."
            />

            <div style={{ marginTop: '1rem' }}>
              <Banner tone="warning" title="OT Calculation">
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 2 }}>
                  <div>Hourly Rate = Basic Salary / {summary?.settings?.standardHours || 176} hours</div>
                  <div>OT Rate = Hourly Rate × {summary?.settings?.otMultiplier || 1.5} (Multiplier)</div>
                  <div>OT Pay = OT Hours × OT Rate</div>
                </div>
              </Banner>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
