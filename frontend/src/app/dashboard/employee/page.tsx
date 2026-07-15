'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { getEmployeeDashboard, getProfile, checkIn, checkOut, getMyAttendanceHistory } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import {
  PageHeader, Tabs, Card, StatCard, Button, Badge, StatusChip,
  KpiBar, DataTable, EmptyState, Skeleton,
} from '@/components/ui';
import type { Column } from '@/components/ui';

interface Task {
  id: string;
  title: string;
  status: string;
  deadline: string;
  project: { name: string };
}

interface Timesheet {
  id: string;
  date: string;
  hoursWorked: number;
}

interface Dashboard {
  assignedTasks: Task[];
  recentTimesheets: Timesheet[];
  thisWeekHours: number;
  todayStatus: string;
  pendingOvertime: number;
}

interface AttendanceRec {
  id: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  status: string;
  workHours?: number;
}

// Maps task status to a Badge tone (replaces legacy badge-* classes).
const TASK_STATUS_TONE: Record<string, 'neutral' | 'info' | 'warning' | 'danger' | 'success'> = {
  TODO: 'neutral',
  IN_PROGRESS: 'info',
  AWAITING_APPROVAL: 'warning',
  REWORK: 'danger',
  COMPLETED: 'success',
};

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function EmployeeDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [employeeId, setEmployeeId] = useState('');
  const [clockState, setClockState] = useState<'idle' | 'working' | 'break' | 'done'>('idle');
  const [checkInTime, setCheckInTime] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [breakActive, setBreakActive] = useState(false);
  const [breakElapsed, setBreakElapsed] = useState(0);
  const [clockLoading, setClockLoading] = useState(false);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRec[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [view, setView] = useState<'dashboard' | 'attendance'>('dashboard');
  const timerRef = useRef<any>(null);
  const breakTimerRef = useRef<any>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading]);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  // Session timer
  useEffect(() => {
    if (clockState === 'working' && !breakActive && checkInTime) {
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - checkInTime.getTime()) / 1000) - breakElapsed);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [clockState, breakActive, checkInTime, breakElapsed]);

  // Break timer
  useEffect(() => {
    if (breakActive) {
      const breakStart = Date.now();
      breakTimerRef.current = setInterval(() => {
        setBreakElapsed(prev => prev + 1);
      }, 1000);
    } else {
      if (breakTimerRef.current) clearInterval(breakTimerRef.current);
    }
    return () => { if (breakTimerRef.current) clearInterval(breakTimerRef.current); };
  }, [breakActive]);

  const loadData = async () => {
    try {
      const profile = await getProfile();
      setEmployeeId(profile.id);
      const data = await getEmployeeDashboard(profile.id);
      setDashboard(data);

      // Check today's status to set clock state
      if (data.todayStatus === 'PRESENT' || data.todayStatus === 'LATE') {
        // Already checked in today — check if also checked out
        // We don't have checkout info in dashboard, set as working
        setClockState('working');
        setCheckInTime(new Date()); // approximate
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadAttendanceHistory = async () => {
    if (!employeeId) return;
    setAttendanceLoading(true);
    try {
      const data = await getMyAttendanceHistory(employeeId, {});
      setAttendanceHistory(data.attendances || []);
    } catch (err) {
      console.error(err);
    } finally {
      setAttendanceLoading(false);
    }
  };

  useEffect(() => {
    if (view === 'attendance' && employeeId) loadAttendanceHistory();
  }, [view, employeeId]);

  const handleClockIn = async () => {
    if (!employeeId) return;
    setClockLoading(true);
    try {
      await checkIn(employeeId);
      setClockState('working');
      setCheckInTime(new Date());
      setElapsed(0);
      setBreakElapsed(0);
      alert('Checked in successfully');
      // Reload dashboard data
      const data = await getEmployeeDashboard(employeeId);
      setDashboard(data);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Check-in failed');
    } finally {
      setClockLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!employeeId) return;
    setClockLoading(true);
    try {
      await checkOut(employeeId);
      setClockState('done');
      setBreakActive(false);
      alert('Checked out successfully');
      const data = await getEmployeeDashboard(employeeId);
      setDashboard(data);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Check-out failed');
    } finally {
      setClockLoading(false);
    }
  };

  const toggleBreak = () => {
    setBreakActive(prev => !prev);
  };

  if (authLoading || !user) {
    return (
      <div className="app-layout">
        <Sidebar activePath="/dashboard/employee" />
        <main className="main-content">
          <Skeleton height={28} width="30%" />
          <Skeleton height={14} width="55%" style={{ marginTop: '0.75rem' }} />
        </main>
      </div>
    );
  }

  const timesheetData = dashboard?.recentTimesheets.map((t) => ({
    date: new Date(t.date).toLocaleDateString('en-US', { weekday: 'short' }),
    hours: t.hoursWorked,
  })) || [];

  const todayStatusTone =
    dashboard?.todayStatus === 'PRESENT' ? 'var(--success-fg)' :
    dashboard?.todayStatus === 'LATE' ? 'var(--warning-fg)' :
    dashboard?.todayStatus === 'ABSENT' ? 'var(--danger-fg)' : 'var(--text-primary)';

  const attendanceColumns: Column<AttendanceRec>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (att) => (
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
          {new Date(att.date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
      ),
    },
    { key: 'checkIn', header: 'Check In', render: (att) => att.checkIn ? new Date(att.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—' },
    { key: 'checkOut', header: 'Check Out', render: (att) => att.checkOut ? new Date(att.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—' },
    { key: 'workHours', header: 'Hours', align: 'center', render: (att) => <span style={{ fontWeight: 600 }}>{att.workHours?.toFixed(1) || '—'}</span> },
    { key: 'status', header: 'Status', render: (att) => <StatusChip status={att.status} /> },
  ];

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <PageHeader
          title="My Dashboard"
          subtitle="Your tasks, hours & attendance"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
          actions={(
            <Tabs
              items={[
                { key: 'dashboard', label: 'Dashboard' },
                { key: 'attendance', label: 'My Attendance' },
              ]}
              value={view}
              onChange={(k) => setView(k as 'dashboard' | 'attendance')}
            />
          )}
        />

        {view === 'dashboard' && (
          <>
            {/* Time Clock Card */}
            <Card style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    Time Clock
                  </h2>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {clockState === 'idle' && 'Not clocked in yet today'}
                    {clockState === 'working' && !breakActive && 'Currently working'}
                    {clockState === 'working' && breakActive && '☕ On break'}
                    {clockState === 'done' && '✅ Shift completed for today'}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  {/* Timer Display */}
                  {clockState === 'working' && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '2rem', fontWeight: 800, color: breakActive ? 'var(--warning-fg)' : 'var(--success-fg)', letterSpacing: '2px' }}>
                        {formatDuration(elapsed)}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        {breakActive ? 'Break time' : 'Working time'}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {clockState === 'idle' && (
                      <Button
                        onClick={handleClockIn}
                        loading={clockLoading}
                        variant="success"
                        style={{ minWidth: '120px' }}
                        leftIcon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>}
                      >
                        {clockLoading ? 'Logging in...' : 'Login'}
                      </Button>
                    )}
                    {clockState === 'working' && (
                      <>
                        <Button onClick={toggleBreak} variant={breakActive ? 'warning' : 'ghost'} style={{ minWidth: '100px' }}>
                          {breakActive ? '▶ Resume' : '☕ Break'}
                        </Button>
                        <Button
                          onClick={handleClockOut}
                          loading={clockLoading}
                          variant="danger"
                          style={{ minWidth: '120px' }}
                          leftIcon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>}
                        >
                          {clockLoading ? 'Logging out...' : 'Logout'}
                        </Button>
                      </>
                    )}
                    {clockState === 'done' && (
                      <Badge tone="success" dot style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}>Shift Complete</Badge>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* Stat Cards */}
            {loading ? (
              <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i}><Skeleton height={28} width="50%" /><Skeleton height={14} width="70%" style={{ marginTop: '0.5rem' }} /></Card>
                ))}
              </div>
            ) : (
              <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                <StatCard label="Today Status" value={<span style={{ color: todayStatusTone }}>{dashboard?.todayStatus || '—'}</span>} />
                <StatCard label="This Week Hours" value={`${dashboard?.thisWeekHours || 0}h`} />
                <StatCard label="Assigned Tasks" value={dashboard?.assignedTasks?.length || 0} />
                <StatCard label="Pending Overtime" value={dashboard?.pendingOvertime || 0} />
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <Card title="Weekly Hours">
                {timesheetData.length ? (
                  <KpiBar data={timesheetData} xKey="date" bars={[{ key: 'hours', name: 'Hours', color: '#182B6D' }]} height={250} />
                ) : (
                  <EmptyState title="No hours logged yet" message="Your weekly hours will appear here once timesheets are submitted." />
                )}
              </Card>

              <Card title="Assigned Tasks">
                <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                  {dashboard?.assignedTasks.map((task) => (
                    <Card key={task.id} style={{ padding: '0.85rem 1rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{task.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{task.project?.name}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <Badge tone={TASK_STATUS_TONE[task.status] || 'neutral'} style={{ marginBottom: '0.25rem' }}>{task.status.replace('_', ' ')}</Badge>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Due: {new Date(task.deadline).toLocaleDateString()}</div>
                      </div>
                    </Card>
                  ))}
                  {(!dashboard?.assignedTasks?.length) && (
                    <EmptyState title="No tasks assigned" />
                  )}
                </div>
              </Card>
            </div>
          </>
        )}

        {view === 'attendance' && (
          <Card title="My Attendance History" padded={false}>
            <DataTable
              columns={attendanceColumns}
              rows={attendanceHistory}
              loading={attendanceLoading}
              rowKey={(att) => att.id}
              emptyTitle="No attendance records found"
            />
          </Card>
        )}
      </main>
    </div>
  );
}
