'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import {
  getLeaveRequests,
  getLeaveBalance,
  getAllLeaveBalances,
  getLeaveCalendar,
  createLeaveRequest,
  approveLeave,
  rejectLeave,
  cancelLeaveRequest,
  getEmployees,
} from '@/lib/api';
import { CanCreate, CanEdit } from '@/components/PermissionGuard';
import Sidebar from '@/components/Sidebar';
import { ValidatedTextarea } from '@/components/ValidatedField';
import { validateForm, required, date as vDate } from '@/lib/validators';

interface EmployeeOption {
  id: string;
  employeeId?: string;
  firstName: string;
  lastName: string;
  jobTitle?: string;
  department?: { name: string };
}

interface LeaveRec {
  id: string;
  employee: EmployeeOption;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: string;
  approvedAt: string;
  rejectReason: string;
}

interface BalanceRow {
  employee: EmployeeOption;
  balances: { leaveType: string; quota: number; used: number; remaining: number }[];
}

const STATUS_MAP: Record<string, string> = { PENDING: 'badge-warning', APPROVED: 'badge-success', REJECTED: 'badge-danger', CANCELLED: 'badge-neutral' };
const LEAVE_TYPES = ['ANNUAL', 'SICK', 'CASUAL', 'MATERNITY', 'PATERNITY', 'UNPAID'];
const BALANCE_TYPES = ['ANNUAL', 'SICK', 'CASUAL'];

const formatDate = (date: string) => new Date(date).toLocaleDateString();
const fullName = (employee?: EmployeeOption) => employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown';

export default function LeavePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [leaves, setLeaves] = useState<LeaveRec[]>([]);
  const [employeeLeaves, setEmployeeLeaves] = useState<LeaveRec[]>([]);
  const [calendarLeaves, setCalendarLeaves] = useState<LeaveRec[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'form' | 'balance' | 'employee' | 'calendar'>('list');
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [balance, setBalance] = useState<any[]>([]);
  const [allBalances, setAllBalances] = useState<BalanceRow[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [form, setForm] = useState({ employeeId: '', leaveType: 'ANNUAL', startDate: '', endDate: '', reason: '' });
  const [submitted, setSubmitted] = useState(false);
  const [rejectSubmitted, setRejectSubmitted] = useState(false);

  const isAdminView = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.role === 'MANAGER';

  useEffect(() => { if (!authLoading && !user) router.push('/'); }, [user, authLoading, router]);
  useEffect(() => { loadEmployees(); }, []);
  useEffect(() => {
    if (view === 'employee' && employees.length && !selectedEmployeeId) {
      setSelectedEmployeeId(employees[0].id);
    }
  }, [employees, selectedEmployeeId, view]);
  useEffect(() => {
    if (!user) return;
    if (view === 'list') loadLeaves();
    if (view === 'balance') loadBalance();
    if (view === 'employee') loadEmployeeLeaves();
    if (view === 'calendar') loadCalendarLeaves();
  }, [user, view, selectedEmployeeId, selectedYear, selectedMonth]);

  const loadLeaves = async () => {
    setLoading(true);
    try {
      const data = await getLeaveRequests({ limit: 100 });
      setLeaves(data.leaves);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    try {
      const data = await getEmployees({ limit: 500 });
      setEmployees(data.employees);
    } catch (err) {
      console.error(err);
    }
  };

  const loadBalance = async () => {
    try {
      if (isAdminView) {
        const data = await getAllLeaveBalances(selectedYear);
        setAllBalances(data.employees);
      } else if (selectedEmployeeId) {
        const data = await getLeaveBalance(selectedEmployeeId, selectedYear);
        setBalance(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadEmployeeLeaves = async () => {
    if (!selectedEmployeeId) return;
    setLoading(true);
    try {
      const data = await getLeaveRequests({ employeeId: selectedEmployeeId, limit: 200 });
      setEmployeeLeaves(data.leaves);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadCalendarLeaves = async () => {
    try {
      const data = await getLeaveCalendar({
        year: selectedYear,
        month: selectedMonth,
        employeeId: selectedEmployeeId || undefined,
      });
      setCalendarLeaves(data.leaves);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const { isValid, firstError } = validateForm(
      { employeeId: form.employeeId, startDate: form.startDate, endDate: form.endDate, reason: form.reason },
      { employeeId: required('Employee'), startDate: vDate('Start date'), endDate: vDate('End date'), reason: required('Reason') }
    );
    if (!isValid) {
      alert(firstError || 'Please correct the highlighted fields.');
      return;
    }
    if (new Date(form.endDate) < new Date(form.startDate)) {
      alert('End date must be on or after the start date.');
      return;
    }
    try {
      await createLeaveRequest(form);
      setView('list');
      setForm({ employeeId: '', leaveType: 'ANNUAL', startDate: '', endDate: '', reason: '' });
      setSubmitted(false);
      loadLeaves();
      alert('Leave request submitted');
    } catch (err) {
      alert('Failed to submit leave request');
    }
  };

  const handleApprove = async (id: string) => { try { await approveLeave(id); loadLeaves(); alert('Leave approved'); } catch (err) { alert('Failed to approve'); } };
  const handleReject = async (id: string) => {
    setRejectSubmitted(true);
    const { isValid, firstError } = validateForm({ rejectReason }, { rejectReason: required('Reason') });
    if (!isValid) {
      alert(firstError || 'Please correct the highlighted fields.');
      return;
    }
    try { await rejectLeave(id, rejectReason); setShowRejectModal(null); setRejectReason(''); setRejectSubmitted(false); loadLeaves(); alert('Leave rejected'); } catch (err) { alert('Failed to reject'); }
  };
  const handleCancel = async (id: string) => { if (!confirm('Cancel this leave request?')) return; try { await cancelLeaveRequest(id); loadLeaves(); } catch (err) { alert('Failed to cancel'); } };
  const getStatusCount = (status: string) => leaves.filter((leave) => leave.status === status).length;
  const getBalance = (row: BalanceRow, type: string) => row.balances.find((balanceItem) => balanceItem.leaveType === type);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(selectedYear, selectedMonth - 1, 1);
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const offset = firstDay.getDay();
    return [
      ...Array.from({ length: offset }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
    ];
  }, [selectedYear, selectedMonth]);

  const leavesForDay = (day: number) => {
    const current = new Date(selectedYear, selectedMonth - 1, day);
    current.setHours(0, 0, 0, 0);
    return calendarLeaves.filter((leave) => {
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      return current >= start && current <= end;
    });
  };

  if (authLoading || !user) return <div className="loading-container"><div className="loading-spinner" />Loading...</div>;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div className="page-header-left">
            <div className="page-header-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <div><h1 className="page-title">Leave Management</h1><p className="page-subtitle">Manage leave requests, balances, and schedules</p></div>
          </div>
          <div className="page-header-actions">
            <div className="tab-group">
              <button className={`tab-btn ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}>Requests</button>
              <CanCreate module="LEAVE"><button className={`tab-btn ${view === 'form' ? 'active' : ''}`} onClick={() => setView('form')}>New Request</button></CanCreate>
              <button className={`tab-btn ${view === 'balance' ? 'active' : ''}`} onClick={() => setView('balance')}>Balance</button>
              {isAdminView && <button className={`tab-btn ${view === 'employee' ? 'active' : ''}`} onClick={() => setView('employee')}>Employee Wise</button>}
              {isAdminView && <button className={`tab-btn ${view === 'calendar' ? 'active' : ''}`} onClick={() => setView('calendar')}>Calendar Wise</button>}
            </div>
          </div>
        </div>

        {view === 'list' && (
          <>
            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {Object.entries(STATUS_MAP).map(([status, cls]) => (
                <div key={status} className="stat-card">
                  <div className={`stat-card-value ${cls.replace('badge-', 'text-')}`}>{getStatusCount(status)}</div>
                  <div className="stat-card-label">{status}</div>
                </div>
              ))}
            </div>
            <div className="glass-card" style={{ overflow: 'hidden' }}>
              <table className="data-table">
                <thead><tr><th>Employee</th><th>Type</th><th>From</th><th>To</th><th style={{ textAlign: 'center' }}>Days</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {loading ? <tr><td colSpan={7} className="loading-container"><div className="loading-spinner" />Loading...</td></tr> :
                    leaves.map((leave) => (
                      <tr key={leave.id}>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{fullName(leave.employee)}</td>
                        <td><span className="badge badge-info">{leave.leaveType}</span></td>
                        <td>{formatDate(leave.startDate)}</td>
                        <td>{formatDate(leave.endDate)}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{leave.days}</td>
                        <td><span className={`badge ${STATUS_MAP[leave.status]}`}>{leave.status}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {leave.status === 'PENDING' && (
                              <>
                                <CanEdit module="LEAVE">
                                  <button className="btn btn-success btn-sm" onClick={() => handleApprove(leave.id)}>Approve</button>
                                  <button className="btn btn-danger btn-sm" onClick={() => setShowRejectModal(leave.id)}>Reject</button>
                                </CanEdit>
                                <button className="btn btn-ghost btn-sm" onClick={() => handleCancel(leave.id)}>Cancel</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {showRejectModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3 className="modal-title">Reject Leave Request</h3>
              <ValidatedTextarea value={rejectReason} onChange={setRejectReason} validator={required('Reason')} forceError={rejectSubmitted} placeholder="Reason for rejection" className="textarea-field" style={{ marginBottom: '1rem' }} />
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button onClick={() => handleReject(showRejectModal)} className="btn btn-danger">Reject</button>
                <button onClick={() => { setShowRejectModal(null); setRejectReason(''); }} className="btn btn-ghost">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {view === 'form' && (
          <div className="glass-card" style={{ padding: '2rem', maxWidth: '500px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.5rem' }}>New Leave Request</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div className="form-group"><label className="form-label">Employee</label><select required value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className="select-field"><option value="">Select</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{fullName(employee)}</option>)}</select></div>
                <div className="form-group"><label className="form-label">Leave Type</label><select required value={form.leaveType} onChange={(e) => setForm({ ...form, leaveType: e.target.value })} className="select-field">{LEAVE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></div>
                <div className="form-group"><label className="form-label">Start Date</label><input required type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="input-field" /></div>
                <div className="form-group"><label className="form-label">End Date</label><input required type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="input-field" /></div>
                <div className="form-group"><label className="form-label">Reason</label><ValidatedTextarea required value={form.reason} onChange={(value) => setForm({ ...form, reason: value })} validator={required('Reason')} forceError={submitted} className="textarea-field" /></div>
                <button type="submit" className="btn btn-primary">Submit Request</button>
              </div>
            </form>
          </div>
        )}

        {view === 'balance' && (
          <div className="glass-card" style={{ padding: '1.5rem', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Leave Balance</h2>
              <input className="input-field" type="number" min="2020" max="2100" value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} style={{ width: '120px' }} />
            </div>
            {isAdminView ? (
              <div style={{ overflow: 'auto' }}>
                <table className="data-table">
                  <thead><tr><th>Employee</th><th>Department</th>{BALANCE_TYPES.map((type) => <th key={type}>{type}</th>)}</tr></thead>
                  <tbody>
                    {allBalances.map((row) => (
                      <tr key={row.employee.id}>
                        <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{fullName(row.employee)}<div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{row.employee.employeeId}</div></td>
                        <td>{row.employee.department?.name || '-'}</td>
                        {BALANCE_TYPES.map((type) => {
                          const item = getBalance(row, type);
                          return <td key={type}><strong>{item?.remaining ?? 0}</strong><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item?.used ?? 0} used / {item?.quota ?? 0}</div></td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {balance.map((item: any) => (
                  <div key={item.leaveType} className="glass-card" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{item.leaveType}</strong>
                    <div style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                      <div>Quota: {item.quota}</div>
                      <div>Used: {item.used}</div>
                      <div className="text-success" style={{ fontWeight: 700 }}>Remaining: {item.remaining}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'employee' && (
          <div className="glass-card" style={{ padding: '1.5rem', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Employee Wise Leaves</h2>
              <select className="select-field" value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)} style={{ maxWidth: '280px' }}>
                {employees.map((employee) => <option key={employee.id} value={employee.id}>{fullName(employee)}</option>)}
              </select>
            </div>
            <table className="data-table">
              <thead><tr><th>Type</th><th>From</th><th>To</th><th style={{ textAlign: 'center' }}>Days</th><th>Status</th><th>Reason</th></tr></thead>
              <tbody>
                {employeeLeaves.map((leave) => (
                  <tr key={leave.id}>
                    <td><span className="badge badge-info">{leave.leaveType}</span></td>
                    <td>{formatDate(leave.startDate)}</td>
                    <td>{formatDate(leave.endDate)}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{leave.days}</td>
                    <td><span className={`badge ${STATUS_MAP[leave.status]}`}>{leave.status}</span></td>
                    <td>{leave.reason || '-'}</td>
                  </tr>
                ))}
                {!loading && employeeLeaves.length === 0 && <tr><td colSpan={6} className="empty-state">No leave records found</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {view === 'calendar' && (
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Calendar Wise Leaves</h2>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <select className="select-field" value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} style={{ width: '150px' }}>
                  {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Date(2026, index, 1).toLocaleString('default', { month: 'long' })}</option>)}
                </select>
                <input className="input-field" type="number" min="2020" max="2100" value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} style={{ width: '110px' }} />
                <select className="select-field" value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)} style={{ width: '220px' }}>
                  <option value="">All employees</option>
                  {employees.map((employee) => <option key={employee.id} value={employee.id}>{fullName(employee)}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))', gap: '0.5rem', overflowX: 'auto' }}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div key={day} style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.8rem' }}>{day}</div>)}
              {calendarDays.map((day, index) => (
                <div key={`${day || 'blank'}-${index}`} style={{ minHeight: '110px', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.65rem', background: day ? 'rgba(255,255,255,0.03)' : 'transparent' }}>
                  {day && <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{day}</div>}
                  {day && leavesForDay(day).slice(0, 3).map((leave) => (
                    <div key={leave.id} style={{ padding: '0.35rem', borderRadius: '6px', marginBottom: '0.35rem', background: 'rgba(245,158,11,0.16)', border: '1px solid rgba(245,158,11,0.25)', fontSize: '0.75rem' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{fullName(leave.employee)}</div>
                      <div style={{ color: 'var(--text-muted)' }}>{leave.leaveType} · {leave.status}</div>
                    </div>
                  ))}
                  {day && leavesForDay(day).length > 3 && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>+{leavesForDay(day).length - 3} more</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
