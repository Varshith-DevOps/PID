'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { logTimesheet, getEmployeeTimesheets, getAllTimesheets, getDailySummary, generateAttendanceFromTimesheet, getTasks, getEmployees } from '@/lib/api';
import Sidebar from '@/components/Sidebar';

interface TimesheetEntry {
  id: string;
  task: { id: string; title: string; project: { name: string } };
  date: string;
  hoursWorked: number;
  description: string;
}

export default function TimesheetPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [myTimesheets, setMyTimesheets] = useState<TimesheetEntry[]>([]);
  const [allTimesheets, setAllTimesheets] = useState<any[]>([]);
  const [dailySummary, setDailySummary] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'my' | 'all' | 'summary'>('my');
  const [form, setForm] = useState({ taskId: '', date: new Date().toISOString().split('T')[0], hoursWorked: 8, description: '' });
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading]);

  useEffect(() => {
    if (user && view === 'my') loadMyTimesheets();
    if (user && view === 'all' && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN')) loadAllTimesheets();
    if (user && view === 'summary') loadSummary();
  }, [user, view]);

  useEffect(() => {
    loadTasks();
    loadEmployees();
  }, []);

  const loadMyTimesheets = async () => {
    setLoading(true);
    try {
      const data = await getEmployeeTimesheets(user?.employeeId || user?.id || '', {});
      setMyTimesheets(data.timesheets);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadAllTimesheets = async () => {
    setLoading(true);
    try {
      const data = await getAllTimesheets({});
      setAllTimesheets(Object.values(data.aggregated));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadSummary = async () => {
    setLoading(true);
    try {
      const data = await getDailySummary();
      setDailySummary(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadTasks = async () => {
    try {
      const data = await getTasks({});
      setTasks(data);
    } catch (err) { console.error(err); }
  };

  const loadEmployees = async () => {
    try {
      const data = await getEmployees({ limit: 100 });
      setEmployees(data.employees);
    } catch (err) { console.error(err); }
  };

  const handleLogHours = async () => {
    try {
      const payload = {
        employeeId: user?.employeeId || user?.id || '',
        taskId: form.taskId || undefined,
        date: form.date,
        hoursWorked: form.hoursWorked,
        description: form.description,
      };
      await logTimesheet(payload);
      setForm({ taskId: '', date: new Date().toISOString().split('T')[0], hoursWorked: 8, description: '' });
      loadMyTimesheets();
      alert('Hours logged successfully');
    } catch (err) { alert('Failed to log hours'); }
  };

  const handleGenerateAttendance = async () => {
    if (!confirm('Generate attendance records from timesheet data?')) return;
    setGenerating(true);
    try {
      await generateAttendanceFromTimesheet();
      alert('Attendance generated successfully');
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to generate');
    } finally {
      setGenerating(false);
    }
  };

  if (authLoading || !user) return <div className="loading-container"><div className="loading-spinner" />Loading...</div>;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div className="page-header-left">
            <div className="page-header-icon" style={{ background: 'linear-gradient(135deg, #14b8a6, #10b981)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </div>
            <div><h1 className="page-title">Timesheet</h1><p className="page-subtitle">Log daily work hours</p></div>
          </div>
          <div className="page-header-actions">
            <div className="tab-group">
              <button className={`tab-btn ${view === 'my' ? 'active' : ''}`} onClick={() => setView('my')}>My Timesheet</button>
              {(user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') && (
                <>
                  <button className={`tab-btn ${view === 'all' ? 'active' : ''}`} onClick={() => setView('all')}>All Entries</button>
                  <button className={`tab-btn ${view === 'summary' ? 'active' : ''}`} onClick={() => setView('summary')}>Summary</button>
                </>
              )}
            </div>
          </div>
        </div>

        {view === 'my' && (
          <>
            <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 1fr auto', gap: '1rem', alignItems: 'end' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Task</label>
                  <select value={form.taskId} onChange={(e) => setForm({ ...form, taskId: e.target.value })} className="select-field">
                    <option value="">Select Task (optional)</option>
                    {tasks.filter((t) => t.assignee?.id === user?.id).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Date</label>
                  <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input-field" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Hours</label>
                  <input type="number" value={form.hoursWorked} onChange={(e) => setForm({ ...form, hoursWorked: parseFloat(e.target.value) })} className="input-field" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Description</label>
                  <input placeholder="What did you work on?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field" />
                </div>
                <button onClick={handleLogHours} className="btn btn-success">Log Hours</button>
              </div>
            </div>

            <div className="glass-card" style={{ overflow: 'hidden' }}>
              <table className="data-table">
                <thead><tr><th>Date</th><th>Task</th><th style={{ textAlign: 'center' }}>Hours</th><th>Description</th></tr></thead>
                <tbody>
                  {loading ? <tr><td colSpan={4} className="loading-container"><div className="loading-spinner" />Loading...</td></tr> :
                    myTimesheets.map((t) => (
                      <tr key={t.id}>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{new Date(t.date).toLocaleDateString()}</td>
                        <td>{t.task?.title || '—'}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--accent-blue)' }}>{t.hoursWorked}h</td>
                        <td>{t.description || '—'}</td>
                      </tr>
                    ))}
                  {myTimesheets.length === 0 && !loading && <tr><td colSpan={4} className="empty-state">No timesheet entries</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}

        {view === 'all' && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') && (
          <div className="glass-card" style={{ overflow: 'hidden' }}>
            <table className="data-table">
              <thead><tr><th>Employee</th><th style={{ textAlign: 'center' }}>Total Hours</th><th style={{ textAlign: 'center' }}>Status</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={3} className="loading-container"><div className="loading-spinner" />Loading...</td></tr> :
                  allTimesheets.map((emp, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{emp.employee?.firstName} {emp.employee?.lastName}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--accent-blue)' }}>{emp.totalHours.toFixed(1)}h</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${emp.totalHours >= 8 ? 'badge-success' : emp.totalHours > 0 ? 'badge-warning' : 'badge-danger'}`}>
                          {emp.totalHours >= 8 ? 'Full Day' : emp.totalHours > 0 ? 'Partial' : 'Absent'}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {view === 'summary' && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') && (
          <>
            <div style={{ marginBottom: '1.5rem' }}>
              <button onClick={handleGenerateAttendance} disabled={generating} className="btn btn-primary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                {generating ? 'Generating...' : 'Generate Attendance'}
              </button>
            </div>

            {dailySummary && (
              <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                <div className="stat-card"><div className="stat-card-value text-success">{dailySummary.totalHours?.toFixed(1)}h</div><div className="stat-card-label">Total Hours</div></div>
                <div className="stat-card"><div className="stat-card-value text-success">{dailySummary.present}</div><div className="stat-card-label">Full Day</div></div>
                <div className="stat-card"><div className="stat-card-value text-warning">{dailySummary.partial}</div><div className="stat-card-label">Partial Day</div></div>
                <div className="stat-card"><div className="stat-card-value text-danger">{dailySummary.absent}</div><div className="stat-card-label">Absent</div></div>
              </div>
            )}

            {dailySummary?.breakdown && (
              <div className="glass-card" style={{ padding: '1.5rem' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Employee Hours Breakdown</h4>
                {Object.entries(dailySummary.breakdown).map(([name, hours]: any) => (
                  <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid var(--border-color)' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '100px', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min((hours / 8) * 100, 100)}%`, height: '100%', background: hours >= 8 ? 'var(--success)' : hours > 0 ? 'var(--warning)' : 'var(--danger)', borderRadius: '3px', transition: 'width 0.5s ease' }} />
                      </div>
                      <span style={{ fontWeight: 700, color: hours >= 8 ? 'var(--success)' : hours > 0 ? 'var(--warning)' : 'var(--danger)', minWidth: '45px', textAlign: 'right' }}>{hours.toFixed(1)}h</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
