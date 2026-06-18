'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import {
  getTodayAttendance,
  checkIn,
  checkOut,
  getMonthlyReport,
  markAttendance,
  getEmployees,
  getAttendanceSettings,
  updateAttendanceSettings,
  getMyAttendanceHistory,
  getProfile,
  getRegularizations,
  submitRegularization,
  actionRegularization,
} from '@/lib/api';
import { CanView, CanCreate, CanEdit } from '@/components/PermissionGuard';
import Sidebar from '@/components/Sidebar';

interface AttendanceRec { id?: string; employee?: { id: string; firstName: string; lastName: string; jobTitle: string; department: { name: string } }; employeeId?: string; date: string; checkIn?: string; checkOut?: string; status: string; lateMinutes?: number; workHours?: number; }

const STATUS_MAP: Record<string, { cls: string; label: string }> = {
  PRESENT: { cls: 'badge-success', label: 'Present' },
  LATE: { cls: 'badge-warning', label: 'Late' },
  ABSENT: { cls: 'badge-danger', label: 'Absent' },
  HALF_DAY: { cls: 'badge-purple', label: 'Half Day' },
  ON_LEAVE: { cls: 'badge-neutral', label: 'On Leave' },
  WEEKLY_OFF: { cls: 'badge-info', label: 'Weekly Off' },
  OVERTIME: { cls: 'badge-success', label: 'Overtime' },
};

export default function AttendancePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [attendance, setAttendance] = useState<AttendanceRec[]>([]);
  const [myAttendance, setMyAttendance] = useState<AttendanceRec[]>([]);
  const [regularizations, setRegularizations] = useState<any[]>([]);
  const [showRegModal, setShowRegModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'today' | 'report' | 'settings' | 'my' | 'regularization'>('today');
  const [monthlyData, setMonthlyData] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [employees, setEmployees] = useState<any[]>([]);
  const [dateFilter, setDateFilter] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });
  const [employeeId, setEmployeeId] = useState('');

  const [regForm, setRegForm] = useState({
    date: new Date().toISOString().split('T')[0],
    requestType: 'MISSING_PUNCH_IN',
    checkInCorrection: '09:00',
    checkOutCorrection: '18:00',
    statusCorrection: 'PRESENT',
    reason: '',
  });

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
    if (user && (view === 'regularization' || view === 'my')) loadRegularizations();
  }, [user, view, employeeId]);

  useEffect(() => { if (!isEmployee) loadEmployees(); }, []);

  const loadProfile = async () => {
    try {
      const profile = await getProfile();
      setEmployeeId(profile.id);
    } catch (err) { console.error(err); }
  };

  const loadRegularizations = async () => {
    try {
      const data = await getRegularizations();
      setRegularizations(data || []);
    } catch (err) {
      console.error(err);
    }
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

  const handleSubmitRegularization = async (e: React.FormEvent) => {
    e.preventDefault();
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
      loadRegularizations();
      alert('Correction request submitted for approval!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to submit correction request');
    }
  };

  const handleActionRegularization = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    const managerRemarks = prompt('Enter remarks / auditing notes for this correction:');
    if (managerRemarks === null) return;
    try {
      await actionRegularization(id, { status, managerRemarks });
      loadRegularizations();
      if (view === 'today') loadTodayAttendance();
      alert(`Request ${status.toLowerCase()} successfully!`);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Action failed');
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

  if (authLoading || !user) return <div className="loading-container"><div className="loading-spinner" />Loading...</div>;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div className="page-header-left">
            <div className="page-header-icon" style={{ background: 'linear-gradient(135deg, #10b981, #00A7B5)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div><h1 className="page-title">Attendance</h1><p className="page-subtitle">{isEmployee ? 'View your attendance records' : 'Track daily attendance'}</p></div>
          </div>
          <div className="page-header-actions">
            <div className="tab-group">
              {isEmployee ? (
                <>
                  <button className={`tab-btn ${view === 'my' ? 'active' : ''}`} onClick={() => setView('my')}>My Attendance</button>
                  <button className={`tab-btn ${view === 'regularization' ? 'active' : ''}`} onClick={() => setView('regularization')}>Correction Requests</button>
                </>
              ) : (
                <>
                  <button className={`tab-btn ${view === 'today' ? 'active' : ''}`} onClick={() => setView('today')}>Today</button>
                  <button className={`tab-btn ${view === 'report' ? 'active' : ''}`} onClick={() => setView('report')}>Report</button>
                  <button className={`tab-btn ${view === 'regularization' ? 'active' : ''}`} onClick={() => setView('regularization')}>
                    Corrections {regularizations.filter(r => r.status === 'PENDING').length > 0 && (
                      <span className="badge badge-danger" style={{ marginLeft: '0.25rem', padding: '0.15rem 0.35rem', fontSize: '0.65rem' }}>
                        {regularizations.filter(r => r.status === 'PENDING').length}
                      </span>
                    )}
                  </button>
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

        {/* Regularization (Correction Requests) Portal */}
        {view === 'regularization' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>
                  {isEmployee ? 'My Attendance Correction Logs' : 'Auditing Correction Requests'}
                </h2>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {isEmployee 
                    ? 'Submit regularization requests for missing check-in/out stamps or status overrides' 
                    : 'Process and recalculate daily punches to resolve late minutes or weekly-off anomalies'}
                </p>
              </div>
              {isEmployee && (
                <button 
                  onClick={() => setShowRegModal(true)} 
                  className="btn btn-primary" 
                  style={{ background: 'linear-gradient(135deg, #10b981, #00A7B5)', border: 'none', fontWeight: 600 }}
                >
                  ➕ Request Punch Correction
                </button>
              )}
            </div>

            <div className="glass-card" style={{ overflow: 'hidden' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    {!isEmployee && <th>Employee</th>}
                    <th>Date</th>
                    <th>Correction Type</th>
                    <th>Correction Value</th>
                    <th>Status To Be</th>
                    <th>Reason / Justification</th>
                    <th>Auditing Status</th>
                    <th>Actions / Audit Trails</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={isEmployee ? 7 : 8} className="loading-container">
                        <div className="loading-spinner" />Loading...
                      </td>
                    </tr>
                  ) : regularizations.length === 0 ? (
                    <tr>
                      <td colSpan={isEmployee ? 7 : 8} className="empty-state">
                        No regularization correction requests found.
                      </td>
                    </tr>
                  ) : (
                    regularizations.map((reg) => (
                      <tr key={reg.id}>
                        {!isEmployee && (
                          <td>
                            <div style={{ fontWeight: 600, color: 'white' }}>
                              {reg.employee?.firstName} {reg.employee?.lastName}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {reg.employee?.jobTitle || 'Staff Member'}
                            </div>
                          </td>
                        )}
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {new Date(reg.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td>
                          <span className="badge badge-secondary" style={{ fontSize: '0.68rem' }}>
                            {reg.requestType.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.78rem', color: 'white' }}>
                          {reg.requestType === 'MISSING_PUNCH_IN' && reg.checkInCorrection && `Check-In: ${reg.checkInCorrection}`}
                          {reg.requestType === 'MISSING_PUNCH_OUT' && reg.checkOutCorrection && `Check-Out: ${reg.checkOutCorrection}`}
                          {reg.requestType === 'STATUS_OVERRIDE' && 'Status Override'}
                          {reg.requestType === 'LATE_JUSTIFICATION' && 'Late Justification'}
                        </td>
                        <td>
                          <span className={`badge ${STATUS_MAP[reg.statusCorrection]?.cls || 'badge-neutral'}`}>
                            {reg.statusCorrection}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: '200px', wordBreak: 'break-word' }}>
                          {reg.reason || '—'}
                        </td>
                        <td>
                          <span className={`badge ${
                            reg.status === 'APPROVED' ? 'badge-success' :
                            reg.status === 'REJECTED' ? 'badge-danger' : 'badge-warning'
                          }`} style={{ fontSize: '0.7rem', fontWeight: 700 }}>
                            {reg.status}
                          </span>
                        </td>
                        <td>
                          {reg.status === 'PENDING' && !isEmployee ? (
                            <div style={{ display: 'flex', gap: '0.35rem' }}>
                              <button 
                                onClick={() => handleActionRegularization(reg.id, 'APPROVED')} 
                                className="btn btn-success" 
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.68rem', fontWeight: 600 }}
                              >
                                Approve
                              </button>
                              <button 
                                onClick={() => handleActionRegularization(reg.id, 'REJECTED')} 
                                className="btn btn-danger" 
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.68rem', fontWeight: 600 }}
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                              {reg.managerRemarks && (
                                <div style={{ fontStyle: 'italic' }}>
                                  Remarks: "{reg.managerRemarks}"
                                </div>
                              )}
                              {reg.actionedBy && (
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                  By: {reg.actionedBy}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Submission Modal for Employee Correction Requests */}
            {showRegModal && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                <div className="glass-card" style={{ width: '100%', maxWidth: '460px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'white' }}>Request Punch Correction</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Submit correction stamps for manager auditing</p>
                  </div>

                  <form onSubmit={handleSubmitRegularization} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Date of Punch</label>
                      <input 
                        type="date" 
                        required 
                        value={regForm.date} 
                        onChange={(e) => setRegForm({ ...regForm, date: e.target.value })} 
                        className="input-field" 
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Correction Request Type</label>
                      <select 
                        value={regForm.requestType} 
                        onChange={(e) => setRegForm({ ...regForm, requestType: e.target.value })} 
                        className="select-field"
                      >
                        <option value="MISSING_PUNCH_IN">Missing Check-In Stamp</option>
                        <option value="MISSING_PUNCH_OUT">Missing Check-Out Stamp</option>
                        <option value="STATUS_OVERRIDE">Correction Status Override</option>
                        <option value="LATE_JUSTIFICATION">Late / Grace Justification</option>
                      </select>
                    </div>

                    {regForm.requestType === 'MISSING_PUNCH_IN' && (
                      <div>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Correct Check-In Time</label>
                        <input 
                          type="text" 
                          placeholder="e.g. 09:15" 
                          required 
                          value={regForm.checkInCorrection} 
                          onChange={(e) => setRegForm({ ...regForm, checkInCorrection: e.target.value })} 
                          className="input-field" 
                        />
                      </div>
                    )}

                    {regForm.requestType === 'MISSING_PUNCH_OUT' && (
                      <div>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Correct Check-Out Time</label>
                        <input 
                          type="text" 
                          placeholder="e.g. 18:30" 
                          required 
                          value={regForm.checkOutCorrection} 
                          onChange={(e) => setRegForm({ ...regForm, checkOutCorrection: e.target.value })} 
                          className="input-field" 
                        />
                      </div>
                    )}

                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Target Status Correction</label>
                      <select 
                        value={regForm.statusCorrection} 
                        onChange={(e) => setRegForm({ ...regForm, statusCorrection: e.target.value })} 
                        className="select-field"
                      >
                        <option value="PRESENT">Present</option>
                        <option value="HALF_DAY">Half Day</option>
                        <option value="ON_LEAVE">On Leave</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Reason & Justification</label>
                      <textarea 
                        rows={3} 
                        placeholder="e.g. Client meeting in morning, biometric machine down..." 
                        required 
                        value={regForm.reason} 
                        onChange={(e) => setRegForm({ ...regForm, reason: e.target.value })} 
                        className="input-field" 
                        style={{ resize: 'none', fontFamily: 'inherit' }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                      <button 
                        type="button" 
                        onClick={() => setShowRegModal(false)} 
                        className="btn btn-secondary"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit" 
                        className="btn btn-primary" 
                        style={{ background: 'linear-gradient(135deg, #10b981, #00A7B5)', border: 'none' }}
                      >
                        Submit Request
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
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