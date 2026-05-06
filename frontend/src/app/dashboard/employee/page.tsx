'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { getEmployeeDashboard, getProfile, checkIn, checkOut, getMyAttendanceHistory } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Sidebar from '@/components/Sidebar';

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

const TASK_STATUS_MAP: Record<string, string> = {
  TODO: 'badge-neutral',
  IN_PROGRESS: 'badge-info',
  AWAITING_APPROVAL: 'badge-warning',
  REWORK: 'badge-danger',
  COMPLETED: 'badge-success',
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: 'rgba(17,24,39,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0.75rem 1rem', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>{label}</p>
        {payload.map((entry: any, idx: number) => (
          <p key={idx} style={{ color: entry.color || '#8b5cf6', fontWeight: 700, fontSize: '0.9rem' }}>{entry.value}h</p>
        ))}
      </div>
    );
  }
  return null;
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
    try {
      const data = await getMyAttendanceHistory(employeeId, {});
      setAttendanceHistory(data.attendances || []);
    } catch (err) {
      console.error(err);
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

  if (authLoading || !user) return <div className="loading-container"><div className="loading-spinner" />Loading...</div>;

  const timesheetData = dashboard?.recentTimesheets.map((t) => ({
    date: new Date(t.date).toLocaleDateString('en-US', { weekday: 'short' }),
    hours: t.hoursWorked,
  })) || [];

  const todayStatusCls = dashboard?.todayStatus === 'PRESENT' ? 'text-success' :
    dashboard?.todayStatus === 'LATE' ? 'text-warning' :
    dashboard?.todayStatus === 'ABSENT' ? 'text-danger' : '';

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div className="page-header-left">
            <div className="page-header-icon" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div><h1 className="page-title">My Dashboard</h1><p className="page-subtitle">Your tasks, hours & attendance</p></div>
          </div>
          <div className="page-header-actions">
            <div className="tab-group">
              <button className={`tab-btn ${view === 'dashboard' ? 'active' : ''}`} onClick={() => setView('dashboard')}>Dashboard</button>
              <button className={`tab-btn ${view === 'attendance' ? 'active' : ''}`} onClick={() => setView('attendance')}>My Attendance</button>
            </div>
          </div>
        </div>

        {view === 'dashboard' && (
          <>
            {/* Time Clock Card */}
            <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem', background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(99,102,241,0.08))', border: '1px solid rgba(139,92,246,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                      <div style={{ fontFamily: 'monospace', fontSize: '2rem', fontWeight: 800, color: breakActive ? 'var(--warning)' : 'var(--success)', letterSpacing: '2px' }}>
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
                      <button onClick={handleClockIn} disabled={clockLoading} className="btn btn-success" style={{ minWidth: '120px' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                        {clockLoading ? 'Logging in...' : 'Login'}
                      </button>
                    )}
                    {clockState === 'working' && (
                      <>
                        <button onClick={toggleBreak} className={`btn ${breakActive ? 'btn-warning' : 'btn-ghost'}`} style={{ minWidth: '100px' }}>
                          {breakActive ? '▶ Resume' : '☕ Break'}
                        </button>
                        <button onClick={handleClockOut} disabled={clockLoading} className="btn btn-danger" style={{ minWidth: '120px' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                          {clockLoading ? 'Logging out...' : 'Logout'}
                        </button>
                      </>
                    )}
                    {clockState === 'done' && (
                      <span className="badge badge-success" style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}>Shift Complete</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Stat Cards */}
            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              <div className="stat-card">
                <div className={`stat-card-value ${todayStatusCls}`}>{dashboard?.todayStatus || '—'}</div>
                <div className="stat-card-label">Today Status</div>
              </div>
              <div className="stat-card"><div className="stat-card-value text-blue">{dashboard?.thisWeekHours || 0}h</div><div className="stat-card-label">This Week Hours</div></div>
              <div className="stat-card"><div className="stat-card-value text-violet">{dashboard?.assignedTasks?.length || 0}</div><div className="stat-card-label">Assigned Tasks</div></div>
              <div className="stat-card"><div className="stat-card-value text-warning">{dashboard?.pendingOvertime || 0}</div><div className="stat-card-label">Pending Overtime</div></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div className="glass-card" style={{ padding: '1.5rem' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Weekly Hours</h2>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={timesheetData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.5)' }} axisLine={{ stroke: 'rgba(255,255,255,0.08)' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.5)' }} axisLine={{ stroke: 'rgba(255,255,255,0.08)' }} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="hours" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="glass-card" style={{ padding: '1.5rem' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Assigned Tasks</h2>
                <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                  {dashboard?.assignedTasks.map((task) => (
                    <div key={task.id} className="glass-card" style={{ padding: '0.85rem 1rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{task.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{task.project?.name}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span className={`badge ${TASK_STATUS_MAP[task.status] || 'badge-neutral'}`} style={{ marginBottom: '0.25rem', display: 'inline-block' }}>{task.status.replace('_', ' ')}</span>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Due: {new Date(task.deadline).toLocaleDateString()}</div>
                      </div>
                    </div>
                  ))}
                  {(!dashboard?.assignedTasks?.length) && (
                    <div className="empty-state">No tasks assigned</div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {view === 'attendance' && (
          <div className="glass-card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>My Attendance History</h2>
            </div>
            <table className="data-table">
              <thead><tr><th>Date</th><th>Check In</th><th>Check Out</th><th style={{ textAlign: 'center' }}>Hours</th><th>Status</th></tr></thead>
              <tbody>
                {attendanceHistory.length === 0 ? (
                  <tr><td colSpan={5} className="empty-state">No attendance records found</td></tr>
                ) : attendanceHistory.map((att) => (
                  <tr key={att.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{new Date(att.date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td>{att.checkIn ? new Date(att.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td>{att.checkOut ? new Date(att.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{att.workHours?.toFixed(1) || '—'}</td>
                    <td>
                      <span className={`badge ${att.status === 'PRESENT' ? 'badge-success' : att.status === 'LATE' ? 'badge-warning' : att.status === 'HALF_DAY' ? 'badge-purple' : 'badge-danger'}`}>
                        {att.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}