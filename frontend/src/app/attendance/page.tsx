'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { useToast } from '@/lib/toastContext';
import {
  getTodayAttendance,
  getMonthlyReport,
  markAttendance,
  getAttendanceSettings,
  updateAttendanceSettings,
  getMyAttendanceHistory,
  getProfile,
  getRegularizations,
  submitRegularization,
  actionRegularization,
  checkIn,
  checkOut,
} from '@/lib/api';
import { CanView, CanCreate, CanEdit } from '@/components/PermissionGuard';
import Sidebar from '@/components/Sidebar';
import { validateForm, required } from '@/lib/validators';
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  Field,
  LoadingBlock,
  Modal,
  ConfirmDialog,
  PageHeader,
  Select,
  StatCard,
  StatusChip,
  Tabs,
  TimeField,
  DateField,
  Textarea,
  Banner,
} from '@/components/ui';
import type { Column, Tone } from '@/components/ui';
import { ValidatedInput } from '@/components/ValidatedField';

interface AttendanceRec extends Record<string, unknown> { id?: string; employee?: { id: string; firstName: string; lastName: string; jobTitle: string; department: { name: string } }; employeeId?: string; date: string; checkIn?: string; checkOut?: string; status: string; lateMinutes?: number; workHours?: number; }

// Distinct tone per attendance state (present/late/half-day/WFH/absent etc.)
const ATTENDANCE_TONE: Record<string, Tone> = {
  PRESENT: 'success',
  LATE: 'warning',
  ABSENT: 'danger',
  HALF_DAY: 'payroll',
  ON_LEAVE: 'leave',
  WEEKLY_OFF: 'info',
  WFH: 'compliance',
  OVERTIME: 'success',
};

const STATUS_LABEL: Record<string, string> = {
  PRESENT: 'Present',
  LATE: 'Late',
  ABSENT: 'Absent',
  HALF_DAY: 'Half Day',
  ON_LEAVE: 'On Leave',
  WEEKLY_OFF: 'Weekly Off',
  OVERTIME: 'Overtime',
  WFH: 'WFH',
};

function AttendanceStatus({ status }: { status?: string | null }) {
  const key = (status || 'UNKNOWN').toString().toUpperCase().replace(/\s+/g, '_');
  const tone = ATTENDANCE_TONE[key];
  if (!tone) return <StatusChip status={status} />;
  return <Badge tone={tone} dot>{STATUS_LABEL[key] || (status || '').toString().replace(/_/g, ' ')}</Badge>;
}

const CLOCK_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
);

export default function AttendancePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [attendance, setAttendance] = useState<AttendanceRec[]>([]);
  const [myAttendance, setMyAttendance] = useState<AttendanceRec[]>([]);
  const [regularizations, setRegularizations] = useState<any[]>([]);
  const [showRegModal, setShowRegModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'today' | 'report' | 'settings' | 'my' | 'regularization'>('today');
  const [monthlyData, setMonthlyData] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [dateFilter, setDateFilter] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });
  const [employeeId, setEmployeeId] = useState(user?.employeeId || '');
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [clockLoading, setClockLoading] = useState(false);

  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
  const isEmployee = user?.role === 'EMPLOYEE';
  const canManageOthers = ['MANAGER', 'HR', 'ADMIN', 'SUPER_ADMIN'].includes(user?.role || '');

  useEffect(() => { if (!authLoading && !user) router.push('/'); }, [user, authLoading]);

  useEffect(() => {
    if (user) {
      loadProfile();
      setView('my');
    }
  }, [user]);

  useEffect(() => {
    if (user && view === 'today') loadTodayAttendance();
    if (user && view === 'report') loadMonthlyReport();
    if (user && view === 'settings' && isAdmin) loadSettings();
    if (user && view === 'my' && employeeId) loadMyAttendance();
    if (user && (view === 'regularization' || view === 'my')) loadRegularizations();
  }, [user, view, employeeId]);

  const loadProfile = async () => {
    try {
      const profile = await getProfile();
      const resolvedEmpId = profile.employeeId || user?.employeeId || '';
      setEmployeeId(resolvedEmpId);
    } catch (err) {
      console.error(err);
      if (user?.employeeId) {
        setEmployeeId(user.employeeId);
      }
    } finally {
      setProfileLoaded(true);
    }
  };

  const loadRegularizations = async () => {
    try {
      const data = await getRegularizations();
      setRegularizations(data || []);
    } catch (err) {
      console.error(err);
      showToast('Failed to load attendance correction requests.', 'error');
    }
  };

  const loadTodayAttendance = async () => {
    setLoading(true);
    try {
      const data = await getTodayAttendance();
      setAttendance(data);
    } catch (err) {
      console.error(err);
      showToast('Failed to load today’s attendance records.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadMonthlyReport = async () => {
    setLoading(true);
    try {
      const data = await getMonthlyReport(dateFilter);
      setMonthlyData(data);
    } catch (err) {
      console.error(err);
      showToast('Failed to load monthly attendance report.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const data = await getAttendanceSettings();
      setSettings(data);
    } catch (err) {
      console.error(err);
      showToast('Failed to load attendance configurations.', 'error');
    }
  };

  const loadMyAttendance = async () => {
    setLoading(true);
    try {
      const data = await getMyAttendanceHistory(employeeId, {});
      setMyAttendance(data.attendances || []);
    } catch (err) {
      console.error(err);
      showToast('Failed to load attendance logs.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const reloadEmployeeAttendance = async () => {
    if (!employeeId) return;
    const data = await getMyAttendanceHistory(employeeId, {});
    setMyAttendance(data.attendances || []);
  };

  const handleClockIn = async () => {
    if (!employeeId) return;
    setClockLoading(true);
    try {
      await checkIn(employeeId);
      await reloadEmployeeAttendance();
      showToast('Checked in successfully.', 'success');
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || 'Check-in failed.';
      showToast(errMsg, 'error');
      if (errMsg.toLowerCase().includes('wi-fi') || errMsg.toLowerCase().includes('geofencing') || errMsg.toLowerCase().includes('corporate')) {
        triggerFailsafeGPS();
      }
    } finally {
      setClockLoading(false);
    }
  };

  const triggerFailsafeGPS = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser.', 'error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoords(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`);
        setShowFailsafeModal(true);
      },
      (err) => {
        showToast('Unable to capture location coordinates. Please enable GPS permissions.', 'error');
        setGpsCoords('0.000000, 0.000000');
        setShowFailsafeModal(true);
      }
    );
  };

  const handleSaveFailsafe = async () => {
    if (!failsafeReason) {
      showToast('Justification reason is required.', 'error');
      return;
    }
    setClockLoading(true);
    try {
      await submitRegularization({
        date: new Date().toISOString(),
        requestType: 'MISSING_PUNCH_IN',
        reason: `[FAILSAFE GPS BYPASS]: ${failsafeReason}`,
        isFailsafeRegularization: true,
        gpsCoordinates: gpsCoords,
        checkInCorrection: new Date().toISOString()
      });
      showToast('Failsafe regularization request submitted to manager review.', 'success');
      setShowFailsafeModal(false);
      setFailsafeReason('');
      setView('regularization');
      loadRegularizations();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to submit regularization.', 'error');
    } finally {
      setClockLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!employeeId) return;
    setClockLoading(true);
    try {
      await checkOut(employeeId);
      await reloadEmployeeAttendance();
      showToast('Checked out successfully.', 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Check-out failed.', 'error');
    } finally {
      setClockLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      await updateAttendanceSettings(settings);
      showToast('Attendance settings updated successfully.', 'success');
    } catch (err) {
      showToast('Failed to update attendance configurations.', 'error');
    }
  };

  const handleSubmitRegularization = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegSubmitted(true);
    const values: Record<string, string> = { date: regForm.date, reason: regForm.reason };
    const rules: Record<string, (value: string) => string | null> = { date: required('Date'), reason: required('Reason') };
    if (regForm.requestType === 'MISSING_PUNCH_IN') {
      values.checkInCorrection = regForm.checkInCorrection;
      rules.checkInCorrection = required('Check-in time');
    }
    if (regForm.requestType === 'MISSING_PUNCH_OUT') {
      values.checkOutCorrection = regForm.checkOutCorrection;
      rules.checkOutCorrection = required('Check-out time');
    }
    const { isValid, firstError } = validateForm(values, rules);
    if (!isValid) {
      showToast(firstError || 'Please correct the highlighted fields.', 'error');
      return;
    }
    try {
      await submitRegularization({
        ...regForm,
        checkInCorrection: regForm.requestType.includes('IN') ? regForm.checkInCorrection : undefined,
        checkOutCorrection: regForm.requestType.includes('OUT') ? regForm.checkOutCorrection : undefined,
      });
      setShowRegModal(false);
      setRegForm({
        date: new Date().toISOString().split('T')[0],
        requestType: 'MISSING_PUNCH_IN',
        checkInCorrection: '09:00',
        checkOutCorrection: '18:00',
        statusCorrection: 'PRESENT',
        reason: '',
      });
      setRegSubmitted(false);
      loadRegularizations();
      showToast('Correction request submitted for approval.', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to submit correction request.', 'error');
    }
  };

  const handleActionRegularization = async (reason?: string) => {
    if (!regAction) return;
    const { id, status } = regAction;
    setRegActionLoading(true);
    try {
      await actionRegularization(id, { status, managerRemarks: reason ?? '' });
      loadRegularizations();
      if (view === 'today') loadTodayAttendance();
      showToast(`Request ${status.toLowerCase()} successfully!`, 'success');
      setRegAction(null);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Action failed.', 'error');
    } finally {
      setRegActionLoading(false);
    }
  };

  const getStatusCount = (status: string) => attendance.filter((a) => a.status === status).length;

  // Stats for employee's own attendance
  const myStats = {
    present: myAttendance.filter(a => a.status === 'PRESENT').length,
    late: myAttendance.filter(a => a.status === 'LATE').length,
    halfDay: myAttendance.filter(a => a.status === 'HALF_DAY').length,
    absent: myAttendance.filter(a => a.status === 'ABSENT').length,
    totalHours: myAttendance.reduce((sum, a) => sum + (a.workHours || 0), 0),
  };

  const pendingCorrections = regularizations.filter(r => r.status === 'PENDING').length;
  const todayKey = new Date().toLocaleDateString('en-CA');
  const todayAttendance = myAttendance.find((a) => new Date(a.date).toLocaleDateString('en-CA') === todayKey);
  const hasCheckedIn = Boolean(todayAttendance?.checkIn);
  const hasCheckedOut = Boolean(todayAttendance?.checkOut);

  if (authLoading || !user) {
    return (
      <div className="app-layout">
        <Sidebar activePath="/attendance" />
        <main className="main-content">
          <LoadingBlock label="Loading attendance..." />
        </main>
      </div>
    );
  }

  // Tab set: Available to EVERY authenticated user
  const tabItems = [
    { key: 'my', label: 'My Attendance' },
    { key: 'today', label: 'Today' },
    { key: 'report', label: 'Report' },
    {
      key: 'regularization',
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
          Corrections
          {pendingCorrections > 0 && <Badge tone="danger">{pendingCorrections}</Badge>}
        </span>
      ),
    },
    { key: 'settings', label: 'Settings' },
  ];

  // ---- Column configs ----
  const myColumns: Column<AttendanceRec>[] = [
    { key: 'date', header: 'Date', render: (att) => <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{new Date(att.date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}</span> },
    { key: 'checkIn', header: 'Check In', render: (att) => att.checkIn ? new Date(att.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—' },
    { key: 'checkOut', header: 'Check Out', render: (att) => att.checkOut ? new Date(att.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—' },
    { key: 'hours', header: 'Hours', align: 'center', render: (att) => <span style={{ fontWeight: 600 }}>{att.workHours?.toFixed(1) || '—'}</span> },
    { key: 'status', header: 'Status', render: (att) => <AttendanceStatus status={att.status} /> },
  ];

  const todayColumns: Column<AttendanceRec>[] = [
    { key: 'employee', header: 'Employee', render: (att) => <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{att.employee?.firstName} {att.employee?.lastName}</span> },
    { key: 'department', header: 'Department', render: (att) => att.employee?.department?.name },
    { key: 'checkIn', header: 'Check In', render: (att) => att.checkIn ? new Date(att.checkIn).toLocaleTimeString() : '—' },
    { key: 'checkOut', header: 'Check Out', render: (att) => att.checkOut ? new Date(att.checkOut).toLocaleTimeString() : '—' },
    { key: 'hours', header: 'Hours', align: 'center', render: (att) => <span style={{ fontWeight: 600 }}>{att.workHours || '—'}</span> },
    { key: 'status', header: 'Status', render: (att) => <AttendanceStatus status={att.status} /> },
  ];

  const reportColumns: Column<any>[] = [
    { key: 'employee', header: 'Employee', render: (rec) => <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{rec.employee?.firstName} {rec.employee?.lastName}</span> },
    { key: 'present', header: 'Present', align: 'center', render: (rec) => <span className="text-success" style={{ fontWeight: 600 }}>{rec.present}</span> },
    { key: 'late', header: 'Late', align: 'center', render: (rec) => <span className="text-warning" style={{ fontWeight: 600 }}>{rec.late}</span> },
    { key: 'halfDay', header: 'Half Day', align: 'center', render: (rec) => <span className="text-violet" style={{ fontWeight: 600 }}>{rec.halfDay}</span> },
    { key: 'absent', header: 'Absent', align: 'center', render: (rec) => <span className="text-danger" style={{ fontWeight: 600 }}>{rec.absent}</span> },
    { key: 'workHours', header: 'Work Hours', align: 'center', render: (rec) => <span style={{ fontWeight: 600 }}>{rec.workHours.toFixed(1)}</span> },
  ];

  const correctionColumns: Column<any>[] = [
    ...(canManageOthers ? [{
      key: 'employee', header: 'Employee', render: (reg: any) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{reg.employee?.firstName} {reg.employee?.lastName}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{reg.employee?.jobTitle || 'Staff Member'}</div>
        </div>
      ),
    } as Column<any>] : []),
    { key: 'date', header: 'Date', render: (reg) => <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{new Date(reg.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span> },
    { key: 'type', header: 'Correction Type', render: (reg) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <Badge tone={reg.isFailsafeRegularization ? 'warning' : 'neutral'}>
          {reg.requestType.replace(/_/g, ' ')}
        </Badge>
        {reg.isFailsafeRegularization && (
          <span style={{ fontSize: '0.62rem', color: '#ffcc00', fontWeight: 'bold' }}>
            🛰️ Failsafe GPS Bypass
          </span>
        )}
      </div>
    ) },
    {
      key: 'value', header: 'Correction Value', render: (reg) => (
        <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>
          {reg.requestType === 'MISSING_PUNCH_IN' && reg.checkInCorrection && `Check-In: ${reg.checkInCorrection}`}
          {reg.requestType === 'MISSING_PUNCH_OUT' && reg.checkOutCorrection && `Check-Out: ${reg.checkOutCorrection}`}
          {reg.requestType === 'STATUS_OVERRIDE' && 'Status Override'}
          {reg.requestType === 'LATE_JUSTIFICATION' && 'Late Justification'}
        </span>
      ),
    },
    { key: 'statusTo', header: 'Status To Be', render: (reg) => <AttendanceStatus status={reg.statusCorrection} /> },
    { key: 'reason', header: 'Reason / Justification', render: (reg) => (
      <div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'inline-block', maxWidth: '200px', wordBreak: 'break-word' }}>
          {reg.reason || '—'}
        </span>
        {reg.gpsCoordinates && (
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            GPS: <a href={`https://www.google.com/maps?q=${reg.gpsCoordinates}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>{reg.gpsCoordinates}</a>
          </div>
        )}
      </div>
    ) },
    { key: 'auditStatus', header: 'Auditing Status', render: (reg) => <StatusChip status={reg.status} /> },
    {
      key: 'actions', header: 'Actions / Audit Trails', render: (reg) => (
        reg.status === 'PENDING' && canManageOthers ? (
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <Button variant="success" size="sm" onClick={() => setRegAction({ id: reg.id, status: 'APPROVED' })}>Approve</Button>
            <Button variant="danger" size="sm" onClick={() => setRegAction({ id: reg.id, status: 'REJECTED' })}>Reject</Button>
          </div>
        ) : (
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
            {reg.managerRemarks && <div style={{ fontStyle: 'italic' }}>Remarks: &quot;{reg.managerRemarks}&quot;</div>}
            {reg.actionedBy && <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>By: {reg.actionedBy}</div>}
          </div>
        )
      ),
    },
  ];

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <PageHeader
          title="Attendance"
          subtitle={canManageOthers ? 'Track daily attendance & self-service clock' : 'View your attendance records'}
          icon={<div className="page-header-icon" style={{ background: 'linear-gradient(135deg, #10b981, #00A7B5)' }}>{CLOCK_ICON}</div>}
          actions={<Tabs items={tabItems} value={view} onChange={(k) => setView(k as typeof view)} />}
        />

        {/* Employee Profile Not Linked Alert Banner */}
        {profileLoaded && !employeeId && (
          <div style={{ marginBottom: '1.5rem' }}>
            <Banner tone="warning" title="Employee Profile Not Linked">
              Your login account (<strong>{user?.email}</strong>) is not linked to an HR Employee profile.
              Self-service Time Clock requires an active Employee record linked to your user account. Please contact your HR Administrator to link your account.
            </Banner>
          </div>
        )}

        {/* Employee's own attendance view */}
        {view === 'my' && (
          <>
            {Boolean(employeeId) && (
              <Card style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                      Time Clock
                    </h2>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {!hasCheckedIn && 'You have not clocked in today.'}
                      {hasCheckedIn && !hasCheckedOut && `Clocked in at ${new Date(todayAttendance!.checkIn!).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}.`}
                      {hasCheckedIn && hasCheckedOut && `Shift completed. Clocked out at ${new Date(todayAttendance!.checkOut!).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}.`}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {!hasCheckedIn && (
                      <Button variant="success" onClick={handleClockIn} loading={clockLoading}>
                        Clock In
                      </Button>
                    )}
                    {hasCheckedIn && !hasCheckedOut && (
                      <Button variant="danger" onClick={handleClockOut} loading={clockLoading}>
                        Clock Out
                      </Button>
                    )}
                    {hasCheckedIn && hasCheckedOut && (
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <Badge tone="success" dot>Completed Today</Badge>
                        <Button variant="success" onClick={handleClockIn} loading={clockLoading}>
                          Clock In Again
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}

            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
              <StatCard label="Present" value={<span className="text-success">{myStats.present}</span>} />
              <StatCard label="Late" value={<span className="text-warning">{myStats.late}</span>} />
              <StatCard label="Half Day" value={<span className="text-violet">{myStats.halfDay}</span>} />
              <StatCard label="Absent" value={<span className="text-danger">{myStats.absent}</span>} />
              <StatCard label="Total Hours" value={<span className="text-blue">{myStats.totalHours.toFixed(1)}h</span>} />
            </div>

            <DataTable
              columns={myColumns}
              rows={myAttendance}
              loading={loading}
              rowKey={(_, i) => i}
              emptyTitle="No attendance records"
              emptyMessage="Your attendance history will appear here once recorded."
            />
          </>
        )}

        {/* Regularization (Correction Requests) Portal */}
        {view === 'regularization' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {isEmployee ? 'My Attendance Correction Logs' : 'Auditing Correction Requests'}
                  </h2>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {isEmployee
                      ? 'Submit regularization requests for missing check-in/out stamps or status overrides'
                      : 'Process and recalculate daily punches to resolve late minutes or weekly-off anomalies'}
                  </p>
                </div>
                {employeeId && (
                  <Button variant="primary" onClick={() => setShowRegModal(true)} leftIcon={<span aria-hidden>➕</span>}>
                    Request Punch Correction
                  </Button>
                )}
              </div>
            </Card>

            <DataTable
              columns={correctionColumns}
              rows={regularizations}
              loading={loading}
              rowKey={(reg) => reg.id}
              emptyTitle="No correction requests"
              emptyMessage="No regularization correction requests found."
            />

            {/* Submission Modal for Employee Correction Requests */}
            <Modal
              open={showRegModal}
              onClose={() => setShowRegModal(false)}
              title="Request Punch Correction"
              width={460}
            >
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '-0.5rem', marginBottom: '1rem' }}>
                Submit correction stamps for manager auditing
              </p>
              <form onSubmit={handleSubmitRegularization} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <DateField
                  label="Date of Punch"
                  required
                  value={regForm.date}
                  onChange={(v) => setRegForm({ ...regForm, date: v })}
                />

                <Select
                  label="Correction Request Type"
                  value={regForm.requestType}
                  onChange={(v) => setRegForm({ ...regForm, requestType: v })}
                  options={[
                    { value: 'MISSING_PUNCH_IN', label: 'Missing Check-In Stamp' },
                    { value: 'MISSING_PUNCH_OUT', label: 'Missing Check-Out Stamp' },
                    { value: 'STATUS_OVERRIDE', label: 'Correction Status Override' },
                    { value: 'LATE_JUSTIFICATION', label: 'Late / Grace Justification' },
                  ]}
                />

                {regForm.requestType === 'MISSING_PUNCH_IN' && (
                  <Field label="Correct Check-In Time" required>
                    <ValidatedInput
                      type="text"
                      placeholder="e.g. 09:15"
                      required
                      value={regForm.checkInCorrection}
                      onChange={(value) => setRegForm({ ...regForm, checkInCorrection: value })}
                      validator={required('Check-in time')}
                      forceError={regSubmitted}
                      className="input-field"
                    />
                  </Field>
                )}

                {regForm.requestType === 'MISSING_PUNCH_OUT' && (
                  <Field label="Correct Check-Out Time" required>
                    <ValidatedInput
                      type="text"
                      placeholder="e.g. 18:30"
                      required
                      value={regForm.checkOutCorrection}
                      onChange={(value) => setRegForm({ ...regForm, checkOutCorrection: value })}
                      validator={required('Check-out time')}
                      forceError={regSubmitted}
                      className="input-field"
                    />
                  </Field>
                )}

                <Select
                  label="Target Status Correction"
                  value={regForm.statusCorrection}
                  onChange={(v) => setRegForm({ ...regForm, statusCorrection: v })}
                  options={[
                    { value: 'PRESENT', label: 'Present' },
                    { value: 'HALF_DAY', label: 'Half Day' },
                    { value: 'ON_LEAVE', label: 'On Leave' },
                  ]}
                />

                <Textarea
                  label="Reason & Justification"
                  required
                  value={regForm.reason}
                  onChange={(value) => setRegForm({ ...regForm, reason: value })}
                  validator={required('Reason')}
                  forceError={regSubmitted}
                  placeholder="e.g. Client meeting in morning, biometric machine down..."
                />

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <Button type="button" variant="ghost" onClick={() => setShowRegModal(false)}>Cancel</Button>
                  <Button type="submit" variant="primary">Submit Request</Button>
                </div>
              </form>
            </Modal>

            {/* Submission Modal for Failsafe GPS regularization */}
            <Modal
              open={showFailsafeModal}
              onClose={() => setShowFailsafeModal(false)}
              title="Failsafe GPS Clock-In Regularization"
              width={460}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Clock-in blocked by Corporate Wi-Fi geofencing constraint. You can bypass this block by submitting a regularization request tagged with your captured physical GPS coordinates for manager verification.
                </p>
                <div style={{ padding: '0.6rem', backgroundColor: '#1d1d22', border: '1px solid #333', borderRadius: '6px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Captured Location Coordinates: <strong>{gpsCoords}</strong>
                </div>
                <Field label="Regularization Justification / Reason" required>
                  <textarea
                    placeholder="Enter justification (e.g., Office router down, working from remote branch, router SSID modified)..."
                    value={failsafeReason}
                    onChange={(e) => setFailsafeReason(e.target.value)}
                    style={{ width: '100%', minHeight: '80px', padding: '8px', backgroundColor: '#1d1d22', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '0.8rem', resize: 'vertical' }}
                  />
                </Field>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <Button type="button" variant="ghost" onClick={() => setShowFailsafeModal(false)}>Cancel</Button>
                  <Button type="button" variant="primary" loading={clockLoading} onClick={handleSaveFailsafe}>Submit GPS Bypass</Button>
                </div>
              </div>
            </Modal>

            {/* Approve / Reject confirmation with required remarks */}
            <ConfirmDialog
              open={!!regAction}
              title={regAction?.status === 'APPROVED' ? 'Approve Correction Request' : 'Reject Correction Request'}
              message="Enter remarks / auditing notes for this correction."
              tone={regAction?.status === 'REJECTED' ? 'danger' : 'primary'}
              confirmLabel={regAction?.status === 'APPROVED' ? 'Approve' : 'Reject'}
              requireReason
              reasonLabel="Remarks / Auditing Notes"
              loading={regActionLoading}
              onConfirm={(reason) => handleActionRegularization(reason)}
              onCancel={() => setRegAction(null)}
            />
          </div>
        )}

        {/* Today view — available to all */}
        {view === 'today' && (
          <>
            {Boolean(employeeId) && (
              <Card style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                      Time Clock
                    </h2>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {!hasCheckedIn && 'You have not clocked in today.'}
                      {hasCheckedIn && !hasCheckedOut && `Clocked in at ${new Date(todayAttendance!.checkIn!).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}.`}
                      {hasCheckedIn && hasCheckedOut && `Shift completed. Clocked out at ${new Date(todayAttendance!.checkOut!).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}.`}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {!hasCheckedIn && (
                      <Button variant="success" onClick={handleClockIn} loading={clockLoading}>
                        Clock In
                      </Button>
                    )}
                    {hasCheckedIn && !hasCheckedOut && (
                      <Button variant="danger" onClick={handleClockOut} loading={clockLoading}>
                        Clock Out
                      </Button>
                    )}
                    {hasCheckedIn && hasCheckedOut && (
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <Badge tone="success" dot>Completed Today</Badge>
                        <Button variant="success" onClick={handleClockIn} loading={clockLoading}>
                          Clock In Again
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}

            <div style={{ marginBottom: '1.5rem' }}>
              <Banner tone="info" title="Team Attendance Overview">
                Employees record their own attendance from the mobile app or web. To fix a missed or
                wrong punch, use the <strong>Correction Requests</strong> tab — corrections are logged
                and auditable. Admins don’t punch staff in or out manually.
              </Banner>
            </div>

            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
              {Object.keys(ATTENDANCE_TONE).filter((s) => ['PRESENT', 'LATE', 'ABSENT', 'HALF_DAY', 'ON_LEAVE', 'WEEKLY_OFF', 'OVERTIME'].includes(s)).map((status) => (
                <StatCard key={status} label={status.replace('_', ' ')} value={getStatusCount(status)} />
              ))}
            </div>

            <DataTable
              columns={todayColumns}
              rows={attendance}
              loading={loading}
              rowKey={(_, i) => i}
              emptyTitle="No attendance today"
              emptyMessage="No attendance records have been logged for today yet."
            />
          </>
        )}

        {/* Report view */}
        {view === 'report' && (
          <>
            <Card style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                <div style={{ width: 160 }}>
                  <Select
                    label="Month"
                    value={String(dateFilter.month)}
                    onChange={(v) => setDateFilter({ ...dateFilter, month: parseInt(v) })}
                    options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: new Date(0, i).toLocaleString('en', { month: 'long' }) }))}
                  />
                </div>
                <div style={{ width: 120 }}>
                  <Select
                    label="Year"
                    value={String(dateFilter.year)}
                    onChange={(v) => setDateFilter({ ...dateFilter, year: parseInt(v) })}
                    options={[dateFilter.year - 1, dateFilter.year, dateFilter.year + 1].map((y) => ({ value: String(y), label: String(y) }))}
                  />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <Button variant="primary" onClick={loadMonthlyReport}>Generate</Button>
                </div>
              </div>
            </Card>
            <DataTable
              columns={reportColumns}
              rows={monthlyData?.summary || []}
              loading={loading}
              rowKey={(_, i) => i}
              emptyTitle="No report data"
              emptyMessage="Select a month and year, then generate to view the summary."
            />
          </>
        )}

        {/* Settings view */}
        {view === 'settings' && (
          <Card style={{ maxWidth: '500px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.5rem' }}>Attendance Settings</h2>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <TimeField label="Check-in Start Time" value={settings?.checkInStartTime || '09:00'} onChange={(v) => setSettings({ ...settings, checkInStartTime: v })} />
              <TimeField label="Check-in End Time" value={settings?.checkInEndTime || '10:00'} onChange={(v) => setSettings({ ...settings, checkInEndTime: v })} />
              <TimeField label="Check-out Time" value={settings?.checkOutTime || '18:00'} onChange={(v) => setSettings({ ...settings, checkOutTime: v })} />
              <Field label="Late Threshold (minutes)">
                <input type="number" value={settings?.lateThreshold || 15} onChange={(e) => setSettings({ ...settings, lateThreshold: parseInt(e.target.value) })} className="input-field" />
              </Field>
              <Field label="Half Day Threshold (hours)">
                <input type="number" value={settings?.halfDayThreshold || 4} onChange={(e) => setSettings({ ...settings, halfDayThreshold: parseInt(e.target.value) })} className="input-field" />
              </Field>
              <div style={{ marginTop: '0.5rem' }}>
                <Button variant="primary" onClick={handleSaveSettings}>Save Settings</Button>
              </div>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
