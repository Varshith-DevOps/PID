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
import { validateForm, required, date as vDate } from '@/lib/validators';
import {
  PageHeader,
  Tabs,
  StatCard,
  Card,
  DataTable,
  Badge,
  StatusChip,
  Button,
  Modal,
  ConfirmDialog,
  Field,
  Select,
  DateField,
  Textarea,
  LoadingBlock,
  EmptyState,
  ErrorState,
} from '@/components/ui';
import type { TabItem } from '@/components/ui';
import type { Column } from '@/components/ui';

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
  [key: string]: unknown;
}

interface BalanceRow {
  employee: EmployeeOption;
  balances: { leaveType: string; quota: number; used: number; remaining: number }[];
}

const STATUS_LIST = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];
const LEAVE_TYPES = ['ANNUAL', 'SICK', 'CASUAL', 'MATERNITY', 'PATERNITY', 'UNPAID'];
const BALANCE_TYPES = ['ANNUAL', 'SICK', 'CASUAL'];

const formatDate = (date: string) => new Date(date).toLocaleDateString();
const fullName = (employee?: EmployeeOption) => employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown';

const CalendarIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
);

export default function LeavePage() {
  const { user, loading: authLoading, hasPermission } = useAuth();
  const router = useRouter();
  const [leaves, setLeaves] = useState<LeaveRec[]>([]);
  const [employeeLeaves, setEmployeeLeaves] = useState<LeaveRec[]>([]);
  const [calendarLeaves, setCalendarLeaves] = useState<LeaveRec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [view, setView] = useState<'list' | 'form' | 'balance' | 'employee' | 'calendar'>('list');
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [balance, setBalance] = useState<any[]>([]);
  const [allBalances, setAllBalances] = useState<BalanceRow[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [form, setForm] = useState({ employeeId: '', leaveType: 'ANNUAL', startDate: '', endDate: '', reason: '' });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rejectSubmitted, setRejectSubmitted] = useState(false);
  const [processingLeaveId, setProcessingLeaveId] = useState<string | null>(null);

  const isAdminView = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'HR';
  const canCreateTab = !!user && hasPermission('LEAVE', 'CREATE');

  const getApiMessage = (err: unknown, fallback: string) => {
    const response = (err as { response?: { data?: { error?: string; message?: string } } })?.response;
    return response?.data?.error || response?.data?.message || fallback;
  };

  const replaceLeave = (updated: LeaveRec) => {
    setLeaves((current) => current.map((leave) => (leave.id === updated.id ? { ...leave, ...updated } : leave)));
    setEmployeeLeaves((current) => current.map((leave) => (leave.id === updated.id ? { ...leave, ...updated } : leave)));
    setCalendarLeaves((current) => current.map((leave) => (leave.id === updated.id ? { ...leave, ...updated } : leave)));
  };

  const logLeaveAction = (action: 'APPROVE' | 'REJECT', leave: LeaveRec | undefined) => {
    if (process.env.NODE_ENV === 'production') return;
    console.debug('[leave-action]', {
      action,
      leaveRequestId: leave?.id,
      status: leave?.status,
    });
  };

  useEffect(() => { if (!authLoading && !user) router.push('/'); }, [user, authLoading, router]);
  useEffect(() => { if (user && isAdminView) loadEmployees(); }, [user]);
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
    setError(false);
    try {
      const data = await getLeaveRequests({ limit: 100 });
      setLeaves(data.leaves);
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    if (!isAdminView) return;
    try {
      const data = await getEmployees({ limit: 500 });
      setEmployees(data.employees);
    } catch (err) {
      console.error(err);
    }
  };

  const loadBalance = async () => {
    setLoading(true);
    setError(false);
    try {
      if (isAdminView) {
        const data = await getAllLeaveBalances(selectedYear);
        setAllBalances(data.employees);
      } else {
        const targetId = selectedEmployeeId || user?.employeeId;
        if (targetId) {
          const data = await getLeaveBalance(targetId, selectedYear);
          setBalance(data);
        }
      }
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const loadEmployeeLeaves = async () => {
    if (!selectedEmployeeId) return;
    setLoading(true);
    setError(false);
    try {
      const data = await getLeaveRequests({ employeeId: selectedEmployeeId, limit: 200 });
      setEmployeeLeaves(data.leaves);
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const loadCalendarLeaves = async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await getLeaveCalendar({
        year: selectedYear,
        month: selectedMonth,
        employeeId: selectedEmployeeId || undefined,
      });
      setCalendarLeaves(data.leaves);
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const targetEmployeeId = isAdminView ? form.employeeId : user?.employeeId;
    const { isValid, firstError } = validateForm(
      { employeeId: targetEmployeeId, startDate: form.startDate, endDate: form.endDate, reason: form.reason },
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
    setSubmitting(true);
    try {
      await createLeaveRequest({ ...form, employeeId: targetEmployeeId as string });
      setView('list');
      setForm({ employeeId: '', leaveType: 'ANNUAL', startDate: '', endDate: '', reason: '' });
      setSubmitted(false);
      loadLeaves();
      alert('Leave request submitted');
    } catch (err) {
      alert('Failed to submit leave request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id: string) => {
    const selected = leaves.find((leave) => leave.id === id);
    logLeaveAction('APPROVE', selected);
    setProcessingLeaveId(id);
    try {
      const result = await approveLeave(id);
      if (result.leaveRequest) replaceLeave(result.leaveRequest);
      alert(result.message || 'Leave request approved successfully.');
    } catch (err) {
      alert(getApiMessage(err, 'Could not update the leave request. Please try again.'));
    } finally {
      setProcessingLeaveId(null);
    }
  };
  const handleReject = async (id: string) => {
    setRejectSubmitted(true);
    const { isValid, firstError } = validateForm({ rejectReason }, { rejectReason: required('Reason') });
    if (!isValid) {
      alert(firstError || 'Please correct the highlighted fields.');
      return;
    }
    const selected = leaves.find((leave) => leave.id === id);
    logLeaveAction('REJECT', selected);
    setProcessingLeaveId(id);
    try {
      const result = await rejectLeave(id, rejectReason);
      if (result.leaveRequest) replaceLeave(result.leaveRequest);
      setShowRejectModal(null);
      setRejectReason('');
      setRejectSubmitted(false);
      alert(result.message || 'Leave request rejected successfully.');
    } catch (err) {
      alert(getApiMessage(err, 'Could not update the leave request. Please try again.'));
    } finally {
      setProcessingLeaveId(null);
    }
  };
  const handleCancel = async (id: string) => { try { await cancelLeaveRequest(id); loadLeaves(); } catch (err) { alert('Failed to cancel'); } };
  const getStatusCount = (status: string) => leaves.filter((leave) => leave.status === status).length;
  const getBalance = (row: BalanceRow, type: string) => row.balances.find((balanceItem) => balanceItem.leaveType === type);

  const closeRejectModal = () => { setShowRejectModal(null); setRejectReason(''); setRejectSubmitted(false); };

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

  // Rejected requests (per current employee context) — surfaced in the Balance view as
  // visibly non-impacting on the computed balance. Derived from records already in state;
  // no extra API call is made and balance fetching/computation is unchanged.
  const rejectedLeaves = useMemo(
    () => leaves.filter((leave) => leave.status === 'REJECTED'),
    [leaves]
  );

  if (authLoading || !user) {
    return (
      <div className="app-layout">
        <Sidebar activePath="/leave" />
        <main className="main-content">
          <LoadingBlock label="Loading leave..." />
        </main>
      </div>
    );
  }

  const tabs: TabItem[] = [
    { key: 'list', label: 'Requests' },
    ...(canCreateTab ? [{ key: 'form', label: 'New Request' } as TabItem] : []),
    { key: 'balance', label: 'Balance' },
    ...(isAdminView ? [{ key: 'employee', label: 'Employee Wise' } as TabItem] : []),
    ...(isAdminView ? [{ key: 'calendar', label: 'Calendar Wise' } as TabItem] : []),
  ];

  const requestColumns: Column<LeaveRec>[] = [
    { key: 'employee', header: 'Employee', render: (row) => <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{fullName(row.employee)}</span> },
    { key: 'leaveType', header: 'Type', render: (row) => <Badge tone="info">{row.leaveType}</Badge> },
    { key: 'startDate', header: 'From', render: (row) => formatDate(row.startDate) },
    { key: 'endDate', header: 'To', render: (row) => formatDate(row.endDate) },
    { key: 'days', header: 'Days', align: 'center', render: (row) => <span style={{ fontWeight: 700 }}>{row.days}</span> },
    { key: 'status', header: 'Status', render: (row) => <StatusChip status={row.status} /> },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {row.status === 'PENDING' && (
            <>
              <CanEdit module="LEAVE">
                <Button variant="success" size="sm" loading={processingLeaveId === row.id} onClick={() => handleApprove(row.id)}>Approve</Button>
                <Button variant="danger" size="sm" disabled={processingLeaveId === row.id} onClick={() => setShowRejectModal(row.id)}>Reject</Button>
              </CanEdit>
              <Button variant="ghost" size="sm" disabled={processingLeaveId === row.id} onClick={() => setShowCancelDialog(row.id)}>Cancel</Button>
            </>
          )}
        </div>
      ),
    },
  ];

  const employeeColumns: Column<LeaveRec>[] = [
    { key: 'leaveType', header: 'Type', render: (row) => <Badge tone="info">{row.leaveType}</Badge> },
    { key: 'startDate', header: 'From', render: (row) => formatDate(row.startDate) },
    { key: 'endDate', header: 'To', render: (row) => formatDate(row.endDate) },
    { key: 'days', header: 'Days', align: 'center', render: (row) => <span style={{ fontWeight: 700 }}>{row.days}</span> },
    { key: 'status', header: 'Status', render: (row) => <StatusChip status={row.status} /> },
    { key: 'reason', header: 'Reason', render: (row) => row.reason || '-' },
  ];

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <PageHeader
          title="Leave Management"
          subtitle="Manage leave requests, balances, and schedules"
          icon={CalendarIcon}
          actions={<Tabs items={tabs} value={view} onChange={(key) => setView(key as typeof view)} />}
        />

        {view === 'list' && (
          <>
            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {STATUS_LIST.map((status) => (
                <StatCard key={status} label={status} value={getStatusCount(status)} />
              ))}
            </div>
            {error ? (
              <Card><ErrorState onRetry={loadLeaves} /></Card>
            ) : (
              <DataTable
                columns={requestColumns}
                rows={leaves}
                loading={loading}
                rowKey={(row) => row.id}
                emptyTitle="No leave requests"
                emptyMessage="Leave requests will appear here once submitted."
              />
            )}
          </>
        )}

        <Modal
          open={!!showRejectModal}
          onClose={closeRejectModal}
          title="Reject Leave Request"
          footer={
            <>
              <Button variant="ghost" onClick={closeRejectModal}>Cancel</Button>
              <Button variant="danger" loading={processingLeaveId === showRejectModal} onClick={() => showRejectModal && handleReject(showRejectModal)}>Reject</Button>
            </>
          }
        >
          <Textarea
            label="Reason for rejection"
            required
            value={rejectReason}
            onChange={setRejectReason}
            validator={required('Reason')}
            forceError={rejectSubmitted}
            placeholder="Reason for rejection"
          />
        </Modal>

        <ConfirmDialog
          open={!!showCancelDialog}
          title="Cancel leave request"
          message="Cancel this leave request? This cannot be undone."
          tone="danger"
          confirmLabel="Cancel Request"
          cancelLabel="Keep"
          onConfirm={() => { if (showCancelDialog) handleCancel(showCancelDialog); setShowCancelDialog(null); }}
          onCancel={() => setShowCancelDialog(null)}
        />

        {view === 'form' && (
          <Card style={{ maxWidth: '500px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>New Leave Request</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gap: '1rem' }}>
                {isAdminView && (
                  <Select
                    label="Employee"
                    required
                    value={form.employeeId}
                    onChange={(value) => setForm({ ...form, employeeId: value })}
                    placeholder="Select"
                    options={employees.map((employee) => ({ value: employee.id, label: fullName(employee) }))}
                  />
                )}
                <Select
                  label="Leave Type"
                  required
                  value={form.leaveType}
                  onChange={(value) => setForm({ ...form, leaveType: value })}
                  options={LEAVE_TYPES.map((type) => ({ value: type, label: type }))}
                />
                <DateField
                  label="Start Date"
                  required
                  value={form.startDate}
                  onChange={(value) => setForm({ ...form, startDate: value })}
                />
                <DateField
                  label="End Date"
                  required
                  value={form.endDate}
                  onChange={(value) => setForm({ ...form, endDate: value })}
                />
                <Textarea
                  label="Reason"
                  required
                  value={form.reason}
                  onChange={(value) => setForm({ ...form, reason: value })}
                  validator={required('Reason')}
                  forceError={submitted}
                />
                <Button type="submit" variant="primary" loading={submitting}>Submit Request</Button>
              </div>
            </form>
          </Card>
        )}

        {view === 'balance' && (
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Leave Balance</h2>
              <input className="input-field" type="number" min="2020" max="2100" value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} style={{ width: '120px' }} />
            </div>
            {loading ? (
              <LoadingBlock />
            ) : error ? (
              <ErrorState onRetry={loadBalance} />
            ) : isAdminView ? (
              allBalances.length === 0 ? (
                <EmptyState title="No balances found" message="Leave balances will appear here." />
              ) : (
                <div className="table-container">
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
              )
            ) : balance.length === 0 ? (
              <EmptyState title="No balance found" message="Select a year to view leave balances." />
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {balance.map((item: any) => (
                  <Card key={item.leaveType} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{item.leaveType}</strong>
                    <div style={{ textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <div>Quota: {item.quota}</div>
                      <div>Used: {item.used}</div>
                      <div style={{ fontWeight: 700, color: 'var(--success-fg)' }}>Remaining: {item.remaining}</div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Rejected requests do not consume the balance — shown struck/greyed and excluded from the used tally. */}
            {!loading && !error && rejectedLeaves.length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-secondary)', margin: 0 }}>Rejected leave (not counted)</h3>
                  <span
                    title="Rejected leave requests are excluded from the used tally and do not affect the remaining balance."
                    style={{ cursor: 'help', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, border: '1px solid var(--border-subtle)', borderRadius: '50%', width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    aria-label="Rejected leave requests are excluded from the used tally and do not affect the remaining balance."
                  >
                    ?
                  </span>
                </div>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {rejectedLeaves.map((leave) => (
                    <div
                      key={leave.id}
                      title="Rejected — does not affect balance"
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '1rem',
                        padding: '0.6rem 0.85rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px dashed var(--border-subtle)',
                        background: 'var(--surface-sunken)',
                        color: 'var(--text-muted)',
                        textDecoration: 'line-through',
                        opacity: 0.7,
                      }}
                    >
                      <span style={{ textDecoration: 'line-through' }}>
                        {fullName(leave.employee)} · {leave.leaveType} · {formatDate(leave.startDate)}–{formatDate(leave.endDate)} ({leave.days}d)
                      </span>
                      <span style={{ textDecoration: 'none' }}><StatusChip status={leave.status} /></span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        {view === 'employee' && (
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Employee Wise Leaves</h2>
              <div style={{ minWidth: '240px' }}>
                <select className="select-field" value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)} style={{ maxWidth: '280px' }}>
                  {employees.map((employee) => <option key={employee.id} value={employee.id}>{fullName(employee)}</option>)}
                </select>
              </div>
            </div>
            {error ? (
              <ErrorState onRetry={loadEmployeeLeaves} />
            ) : (
              <DataTable
                columns={employeeColumns}
                rows={employeeLeaves}
                loading={loading}
                rowKey={(row) => row.id}
                emptyTitle="No leave records found"
              />
            )}
          </Card>
        )}

        {view === 'calendar' && (
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Calendar Wise Leaves</h2>
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
            {loading ? (
              <LoadingBlock />
            ) : error ? (
              <ErrorState onRetry={loadCalendarLeaves} />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))', gap: '0.5rem', overflowX: 'auto' }}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div key={day} style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.8rem' }}>{day}</div>)}
                {calendarDays.map((day, index) => (
                  <div key={`${day || 'blank'}-${index}`} style={{ minHeight: '110px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '0.65rem', background: day ? 'var(--surface-sunken)' : 'transparent' }}>
                    {day && <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{day}</div>}
                    {day && leavesForDay(day).slice(0, 3).map((leave) => (
                      <div key={leave.id} style={{ padding: '0.35rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.35rem', background: 'var(--leave-bg)', border: '1px solid var(--leave-border, transparent)', fontSize: '0.75rem' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{fullName(leave.employee)}</div>
                        <div style={{ color: 'var(--text-muted)' }}>{leave.leaveType} · {leave.status}</div>
                      </div>
                    ))}
                    {day && leavesForDay(day).length > 3 && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>+{leavesForDay(day).length - 3} more</div>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </main>
    </div>
  );
}
