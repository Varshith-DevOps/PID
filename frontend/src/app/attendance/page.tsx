'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { getTodayAttendance, checkIn, checkOut, getMonthlyReport, markAttendance, getEmployees, getAttendanceSettings, updateAttendanceSettings, getMyAttendanceHistory, getProfile } from '@/lib/api';
import { CanView, CanCreate, CanEdit } from '@/components/PermissionGuard';
import Sidebar from '@/components/Sidebar';

interface AttendanceRec { id?: string; employee?: { id: string; firstName: string; lastName: string; jobTitle: string; department: { name: string } }; employeeId?: string; date: string; checkIn?: string; checkOut?: string; status: string; lateMinutes?: number; workHours?: number; }

const STATUS_MAP: Record<string, { cls: string; label: string }> = {
  PRESENT: { cls: 'badge-success', label: 'Present' },
  LATE: { cls: 'badge-warning', label: 'Late' },
  ABSENT: { cls: 'badge-danger', label: 'Absent' },
  HALF_DAY: { cls: 'badge-purple', label: 'Half Day' },
  ON_LEAVE: { cls: 'badge-neutral', label: 'On Leave' },
};

export default function AttendancePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [attendance, setAttendance] = useState<AttendanceRec[]>([]);
  const [myAttendance, setMyAttendance] = useState<AttendanceRec[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'today' | 'report' | 'settings' | 'my'>('today');
  const [monthlyData, setMonthlyData] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [employees, setEmployees] = useState<any[]>([]);
  const [dateFilter, setDateFilter] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });
  const [employeeId, setEmployeeId] = useState('');

  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
  const isEmployee = user?.role === 'EMPLOYEE';

  useEffect(() => { if (!authLoading && !user) router.push('/'); }, [user, authLoading]);

  // Set default view based on role
  useEffect(() => {
    if (user) {
      if (isEmployee) {
        setView('my');
        loadProfile();
      } else {
        setView('today');
      }
    }
  }, [user]);

  useEffect(() => {
    if (user && view === 'today' && !isEmployee) loadTodayAttendance();
    if (user && view === 'report' && !isEmployee) loadMonthlyReport();
    if (user && view === 'settings' && isAdmin) loadSettings();
    if (user && view === 'my' && employeeId) loadMyAttendance();
  }, [user, view, employeeId]);

  useEffect(() => { if (!isEmployee) loadEmployees(); }, []);

  const loadProfile = async () => {
    try {
      const profile = await getProfile();
      setEmployeeId(profile.id);
    } catch (err) { console.error(err); }
  };

  const loadTodayAttendance = async () => { setLoading(true); try { const data = await getTodayAttendance(); setAttendance(data); } catch (err) { console.error(err); } finally { setLoading(false); } };
  const loadMonthlyReport = async () => { setLoading(true); try { const data = await getMonthlyReport(dateFilter); setMonthlyData(data); } catch (err) { console.error(err); } finally { setLoading(false); } };
  const loadSettings = async () => { try { const data = await getAttendanceSettings(); setSettings(data); } catch (err) { console.error(err); } };
  const loadEmployees = async () => { try { const data = await getEmployees({ limit: 100 }); setEmployees(data.employees); } catch (err) { console.error(err); } };

  const loadMyAttendance = async () => {
    setLoading(true);
    try {
      const data = await getMyAttendanceHistory(employeeId, {});
      setMyAttendance(data.attendances || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleCheckIn = async () => { if (!selectedEmployee) return alert('Select an employee'); try { await checkIn(selectedEmployee); loadTodayAttendance(); alert('Checked in successfully'); } catch (err: any) { alert(err?.response?.data?.error || 'Check-in failed'); } };
  const handleCheckOut = async () => { if (!selectedEmployee) return alert('Select an employee'); try { await checkOut(selectedEmployee); loadTodayAttendance(); alert('Checked out successfully'); } catch (err: any) { alert(err?.response?.data?.error || 'Check-out failed'); } };
  const handleSaveSettings = async () => { try { await updateAttendanceSettings(settings); alert('Settings updated'); } catch (err) { alert('Failed to update settings'); } };

  const getStatusCount = (status: string) => attendance.filter((a) => a.status === status).length;

  // Stats for employee's own attendance
  const myStats = {
    present: myAttendance.filter(a => a.status === 'PRESENT').length,
    late: myAttendance.filter(a => a.status === 'LATE').length,
    halfDay: myAttendance.filter(a => a.status === 'HALF_DAY').length,
    absent: myAttendance.filter(a => a.status === 'ABSENT').length,
    totalHours: myAttendance.reduce((sum, a) => sum + (a.workHours || 0), 0),
  };

  if (authLoading || !user) return <div className="loading-container"><div className="loading-spinner" />Loading...</div>;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div className="page-header-left">
            <div className="page-header-icon" style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div><h1 className="page-title">Attendance</h1><p className="page-subtitle">{isEmployee ? 'View your attendance records' : 'Track daily attendance'}</p></div>
          </div>
          <div className="page-header-actions">
            <div className="tab-group">
              {isEmployee ? (
                <button className="tab-btn active">My Attendance</button>
              ) : (
                <>
                  <button className={`tab-btn ${view === 'today' ? 'active' : ''}`} onClick={() => setView('today')}>Today</button>
                  <button className={`tab-btn ${view === 'report' ? 'active' : ''}`} onClick={() => setView('report')}>Report</button>
                  {isAdmin && <button className={`tab-btn ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}>Settings</button>}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Employee's own attendance view */}
        {view === 'my' && isEmployee && (
          <>
            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
              <div className="stat-card"><div className="stat-card-value text-success">{myStats.present}</div><div className="stat-card-label">Present</div></div>
              <div className="stat-card"><div className="stat-card-value text-warning">{myStats.late}</div><div className="stat-card-label">Late</div></div>
              <div className="stat-card"><div className="stat-card-value text-violet">{myStats.halfDay}</div><div className="stat-card-label">Half Day</div></div>
              <div className="stat-card"><div className="stat-card-value text-danger">{myStats.absent}</div><div className="stat-card-label">Absent</div></div>
              <div className="stat-card"><div className="stat-card-value text-blue">{myStats.totalHours.toFixed(1)}h</div><div className="stat-card-label">Total Hours</div></div>
            </div>

            <div className="glass-card" style={{ overflow: 'hidden' }}>
              <table className="data-table">
                <thead><tr><th>Date</th><th>Check In</th><th>Check Out</th><th style={{ textAlign: 'center' }}>Hours</th><th>Status</th></tr></thead>
                <tbody>
                  {loading ? <tr><td colSpan={5} className="loading-container"><div className="loading-spinner" />Loading...</td></tr> :
                    myAttendance.length === 0 ? <tr><td colSpan={5} className="empty-state">No attendance records</td></tr> :
                    myAttendance.map((att, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{new Date(att.date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}</td>
                        <td>{att.checkIn ? new Date(att.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                        <td>{att.checkOut ? new Date(att.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{att.workHours?.toFixed(1) || '—'}</td>
                        <td><span className={`badge ${STATUS_MAP[att.status]?.cls || 'badge-neutral'}`}>{att.status}</span></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Admin: Today view */}
        {view === 'today' && !isEmployee && (
          <>
            <CanEdit module="ATTENDANCE">
              <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <select value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)} className="select-field" style={{ flex: 1 }}>
                  <option value="">Select Employee</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
                </select>
                <button onClick={handleCheckIn} className="btn btn-success">Check In</button>
                <button onClick={handleCheckOut} className="btn btn-warning">Check Out</button>
              </div>
            </CanEdit>

            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
              {Object.entries(STATUS_MAP).map(([status, { cls }]) => (
                <div key={status} className="stat-card">
                  <div className={`stat-card-value ${cls.replace('badge-', 'text-')}`}>{getStatusCount(status)}</div>
                  <div className="stat-card-label">{status.replace('_', ' ')}</div>
                </div>
              ))}
            </div>

            <div className="glass-card" style={{ overflow: 'hidden' }}>
              <table className="data-table">
                <thead><tr><th>Employee</th><th>Department</th><th>Check In</th><th>Check Out</th><th style={{ textAlign: 'center' }}>Hours</th><th>Status</th></tr></thead>
                <tbody>
                  {loading ? <tr><td colSpan={6} className="loading-container"><div className="loading-spinner" />Loading...</td></tr> :
                    attendance.map((att, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{att.employee?.firstName} {att.employee?.lastName}</td>
                        <td>{att.employee?.department?.name}</td>
                        <td>{att.checkIn ? new Date(att.checkIn).toLocaleTimeString() : '—'}</td>
                        <td>{att.checkOut ? new Date(att.checkOut).toLocaleTimeString() : '—'}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{att.workHours || '—'}</td>
                        <td><span className={`badge ${STATUS_MAP[att.status]?.cls || 'badge-neutral'}`}>{att.status}</span></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Report view */}
        {view === 'report' && !isEmployee && (
          <>
            <div className="glass-card" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <select value={dateFilter.month} onChange={(e) => setDateFilter({ ...dateFilter, month: parseInt(e.target.value) })} className="select-field" style={{ width: '160px' }}>
                {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('en', { month: 'long' })}</option>)}
              </select>
              <select value={dateFilter.year} onChange={(e) => setDateFilter({ ...dateFilter, year: parseInt(e.target.value) })} className="select-field" style={{ width: '120px' }}>
                {[dateFilter.year - 1, dateFilter.year, dateFilter.year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <button onClick={loadMonthlyReport} className="btn btn-primary">Generate</button>
            </div>
            <div className="glass-card" style={{ overflow: 'hidden' }}>
              <table className="data-table">
                <thead><tr><th>Employee</th><th style={{ textAlign: 'center' }}>Present</th><th style={{ textAlign: 'center' }}>Late</th><th style={{ textAlign: 'center' }}>Half Day</th><th style={{ textAlign: 'center' }}>Absent</th><th style={{ textAlign: 'center' }}>Work Hours</th></tr></thead>
                <tbody>
                  {loading ? <tr><td colSpan={6} className="loading-container"><div className="loading-spinner" />Loading...</td></tr> :
                    monthlyData?.summary?.map((rec: any, idx: number) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{rec.employee?.firstName} {rec.employee?.lastName}</td>
                        <td className="text-center text-success" style={{ fontWeight: 600 }}>{rec.present}</td>
                        <td className="text-center text-warning" style={{ fontWeight: 600 }}>{rec.late}</td>
                        <td className="text-center text-violet" style={{ fontWeight: 600 }}>{rec.halfDay}</td>
                        <td className="text-center text-danger" style={{ fontWeight: 600 }}>{rec.absent}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{rec.workHours.toFixed(1)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Settings view */}
        {view === 'settings' && settings && isAdmin && (
          <div className="glass-card" style={{ padding: '2rem', maxWidth: '500px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.5rem' }}>Attendance Settings</h2>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div className="form-group"><label className="form-label">Check-in Start Time</label><input type="time" value={settings.checkInStartTime} onChange={(e) => setSettings({ ...settings, checkInStartTime: e.target.value })} className="input-field" /></div>
              <div className="form-group"><label className="form-label">Check-in End Time</label><input type="time" value={settings.checkInEndTime} onChange={(e) => setSettings({ ...settings, checkInEndTime: e.target.value })} className="input-field" /></div>
              <div className="form-group"><label className="form-label">Check-out Time</label><input type="time" value={settings.checkOutTime} onChange={(e) => setSettings({ ...settings, checkOutTime: e.target.value })} className="input-field" /></div>
              <div className="form-group"><label className="form-label">Late Threshold (minutes)</label><input type="number" value={settings.lateThreshold} onChange={(e) => setSettings({ ...settings, lateThreshold: parseInt(e.target.value) })} className="input-field" /></div>
              <div className="form-group"><label className="form-label">Half Day Threshold (hours)</label><input type="number" value={settings.halfDayThreshold} onChange={(e) => setSettings({ ...settings, halfDayThreshold: parseInt(e.target.value) })} className="input-field" /></div>
              <button onClick={handleSaveSettings} className="btn btn-primary" style={{ marginTop: '0.5rem' }}>Save Settings</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}