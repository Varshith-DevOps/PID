'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { getEmployeeOvertime, approveOvertime, rejectOvertime, getOTSummary } from '@/lib/api';
import Sidebar from '@/components/Sidebar';

interface OvertimeEntry {
  id: string;
  employee: { id: string; firstName: string; lastName: string };
  date: string;
  regularHours: number;
  otHours: number;
  status: string;
  reason: string;
  rejectReason: string;
}

const STATUS_MAP: Record<string, string> = {
  PENDING: 'badge-warning',
  APPROVED: 'badge-success',
  REJECTED: 'badge-danger',
};

export default function OvertimePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [overtime, setOvertime] = useState<OvertimeEntry[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'requests' | 'summary'>('requests');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

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

  const handleReject = async (id: string) => {
    try {
      await rejectOvertime(id, rejectReason);
      setRejectingId(null);
      setRejectReason('');
      loadOvertime();
      alert('Overtime rejected');
    } catch (err) { alert('Failed to reject'); }
  };

  const getStatusCount = (status: string) => overtime.filter((o) => o.status === status).length;

  if (authLoading || !user) return <div className="loading-container"><div className="loading-spinner" />Loading...</div>;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div className="page-header-left">
            <div className="page-header-icon" style={{ background: 'linear-gradient(135deg, #f97316, #ef4444)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/><line x1="19" y1="5" x2="21" y2="3"/></svg>
            </div>
            <div><h1 className="page-title">Overtime</h1><p className="page-subtitle">Manage overtime requests</p></div>
          </div>
          <div className="page-header-actions">
            <div className="tab-group">
              <button className={`tab-btn ${view === 'requests' ? 'active' : ''}`} onClick={() => setView('requests')}>Requests</button>
              {(user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') && (
                <button className={`tab-btn ${view === 'summary' ? 'active' : ''}`} onClick={() => setView('summary')}>Summary</button>
              )}
            </div>
          </div>
        </div>

        {view === 'requests' && (
          <>
            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {Object.entries(STATUS_MAP).map(([status, cls]) => (
                <div key={status} className="stat-card">
                  <div className={`stat-card-value ${cls.replace('badge-', 'text-')}`}>{getStatusCount(status)}</div>
                  <div className="stat-card-label">{status}</div>
                </div>
              ))}
            </div>

            <div className="glass-card" style={{ overflow: 'hidden' }}>
              <table className="data-table">
                <thead><tr><th>Employee</th><th>Date</th><th style={{ textAlign: 'center' }}>Regular</th><th style={{ textAlign: 'center' }}>OT Hours</th><th>Reason</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {loading ? <tr><td colSpan={7} className="loading-container"><div className="loading-spinner" />Loading...</td></tr> :
                    overtime.map((ot) => (
                      <tr key={ot.id}>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ot.employee?.firstName} {ot.employee?.lastName}</td>
                        <td>{new Date(ot.date).toLocaleDateString()}</td>
                        <td style={{ textAlign: 'center' }}>{ot.regularHours}h</td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--danger)' }}>{ot.otHours}h</td>
                        <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ot.reason || '—'}</td>
                        <td><span className={`badge ${STATUS_MAP[ot.status] || 'badge-neutral'}`}>{ot.status}</span></td>
                        <td>
                          {ot.status === 'PENDING' && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.role === 'MANAGER') && (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button onClick={() => handleApprove(ot.id)} className="btn btn-success btn-sm">Approve</button>
                              <button onClick={() => setRejectingId(ot.id)} className="btn btn-danger btn-sm">Reject</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  {overtime.length === 0 && !loading && <tr><td colSpan={7} className="empty-state">No overtime requests</td></tr>}
                </tbody>
              </table>
            </div>

            {rejectingId && (
              <div className="modal-overlay">
                <div className="modal-content">
                  <h3 className="modal-title">Reject Overtime</h3>
                  <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for rejection" className="textarea-field" style={{ marginBottom: '1rem' }} />
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button onClick={() => handleReject(rejectingId)} className="btn btn-danger">Reject</button>
                    <button onClick={() => { setRejectingId(null); setRejectReason(''); }} className="btn btn-ghost">Cancel</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {view === 'summary' && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') && (
          <>
            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <div className="stat-card"><div className="stat-card-value text-success">₹{summary?.totalOTPay?.toFixed(0) || 0}</div><div className="stat-card-label">Total OT Pay</div></div>
              <div className="stat-card"><div className="stat-card-value text-blue">{summary?.settings?.otMultiplier || 1.5}x</div><div className="stat-card-label">OT Multiplier</div></div>
              <div className="stat-card"><div className="stat-card-value">{summary?.settings?.standardHours || 176}h</div><div className="stat-card-label">Standard Hours/Month</div></div>
            </div>

            <div className="glass-card" style={{ overflow: 'hidden' }}>
              <table className="data-table">
                <thead><tr><th>Employee</th><th style={{ textAlign: 'center' }}>OT Hours</th><th style={{ textAlign: 'right' }}>Basic Salary</th><th style={{ textAlign: 'right' }}>OT Pay</th></tr></thead>
                <tbody>
                  {loading ? <tr><td colSpan={4} className="loading-container"><div className="loading-spinner" />Loading...</td></tr> :
                    summary?.summary?.map((emp: any, idx: number) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{emp.employee?.firstName} {emp.employee?.lastName}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--danger)' }}>{emp.otHours?.toFixed(1)}h</td>
                        <td style={{ textAlign: 'right' }}>₹{emp.basicSalary?.toLocaleString()}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>₹{emp.otPay?.toFixed(0)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="glass-card mt-2" style={{ padding: '1.25rem', borderLeft: '3px solid var(--warning)' }}>
              <h4 style={{ marginBottom: '0.5rem', color: 'var(--warning)', fontSize: '0.9rem', fontWeight: 700 }}>OT Calculation</h4>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 2 }}>
                <div>Hourly Rate = Basic Salary / {summary?.settings?.standardHours || 176} hours</div>
                <div>OT Rate = Hourly Rate × {summary?.settings?.otMultiplier || 1.5} (Multiplier)</div>
                <div>OT Pay = OT Hours × OT Rate</div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}