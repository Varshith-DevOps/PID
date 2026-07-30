'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { useToast } from '@/lib/toastContext';
import { logTimesheet, getEmployeeTimesheets, getAllTimesheets, getDailySummary, generateAttendanceFromTimesheet, getTasks, getEmployees } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import {
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  DateField,
  Field,
  LoadingBlock,
  PageHeader,
  ProgressBar,
  Select,
  StatCard,
  StatusChip,
  Tabs,
  TextField,
} from '@/components/ui';
import type { Column } from '@/components/ui';

interface TimesheetEntry extends Record<string, unknown> {
  id: string;
  task: { id: string; title: string; project: { name: string } };
  date: string;
  hoursWorked: number;
  description: string;
}

const PENCIL_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
);

export default function TimesheetPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [myTimesheets, setMyTimesheets] = useState<TimesheetEntry[]>([]);
  const [allTimesheets, setAllTimesheets] = useState<any[]>([]);
  const [dailySummary, setDailySummary] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'my' | 'all' | 'summary'>('my');
  const [form, setForm] = useState({ taskId: '', date: new Date().toISOString().split('T')[0], hoursWorked: 8, description: '' });
  const [generating, setGenerating] = useState(false);
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);

  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

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
    } catch (err) {
      console.error(err);
      showToast('Failed to load your timesheets. Please try again.', 'error');
    }
    finally { setLoading(false); }
  };

  const loadAllTimesheets = async () => {
    setLoading(true);
    try {
      const data = await getAllTimesheets({});
      setAllTimesheets(Object.values(data.aggregated));
    } catch (err) {
      console.error(err);
      showToast('Failed to load administrative timesheets.', 'error');
    }
    finally { setLoading(false); }
  };

  const loadSummary = async () => {
    setLoading(true);
    try {
      const data = await getDailySummary();
      setDailySummary(data);
    } catch (err) {
      console.error(err);
      showToast('Failed to load daily attendance summary.', 'error');
    }
    finally { setLoading(false); }
  };

  const loadTasks = async () => {
    try {
      const data = await getTasks({});
      setTasks(data);
    } catch (err) {
      console.error(err);
      showToast('Failed to load tasks list.', 'error');
    }
  };

  const loadEmployees = async () => {
    try {
      const data = await getEmployees({ limit: 100 });
      setEmployees(data.employees);
    } catch (err) {
      console.error(err);
      showToast('Failed to load employee list.', 'error');
    }
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
      showToast('Hours logged successfully.', 'success');
    } catch (err) {
      showToast('Failed to log timesheet hours. Please check inputs.', 'error');
    }
  };

  const handleGenerateAttendance = async () => {
    setShowGenerateConfirm(false);
    setGenerating(true);
    try {
      await generateAttendanceFromTimesheet();
      showToast('Attendance records generated successfully.', 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to generate attendance records.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  if (authLoading || !user) return <LoadingBlock label="Loading…" />;

  const tabItems = [
    { key: 'my', label: 'My Timesheet' },
    ...(isAdmin ? [
      { key: 'all', label: 'All Entries' },
      { key: 'summary', label: 'Summary' },
    ] : []),
  ];

  const myColumns: Column<TimesheetEntry>[] = [
    { key: 'date', header: 'Date', render: (t) => <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{new Date(t.date).toLocaleDateString()}</span> },
    { key: 'task', header: 'Task', render: (t) => t.task?.title || '—' },
    { key: 'hours', header: 'Hours', align: 'center', render: (t) => <span style={{ fontWeight: 700, color: 'var(--accent-blue)' }}>{t.hoursWorked}h</span> },
    { key: 'description', header: 'Description', render: (t) => t.description || '—' },
  ];

  const allColumns: Column<any>[] = [
    { key: 'employee', header: 'Employee', render: (emp) => <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{emp.employee?.firstName} {emp.employee?.lastName}</span> },
    { key: 'totalHours', header: 'Total Hours', align: 'center', render: (emp) => <span style={{ fontWeight: 700, color: 'var(--accent-blue)' }}>{emp.totalHours.toFixed(1)}h</span> },
    { key: 'status', header: 'Status', align: 'center', render: (emp) => <StatusChip status={emp.totalHours >= 8 ? 'COMPLETED' : emp.totalHours > 0 ? 'PENDING' : 'ABSENT'} /> },
  ];

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <PageHeader
          title="Timesheet"
          subtitle="Log daily work hours"
          icon={<div className="page-header-icon" style={{ background: 'linear-gradient(135deg, #14b8a6, #10b981)' }}>{PENCIL_ICON}</div>}
          actions={<Tabs items={tabItems} value={view} onChange={(k) => setView(k as typeof view)} />}
        />

        {view === 'my' && (
          <>
            <Card style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 1fr auto', gap: '1rem', alignItems: 'flex-end' }}>
                <Select
                  label="Task"
                  value={form.taskId}
                  onChange={(v) => setForm({ ...form, taskId: v })}
                  placeholder="Select Task (optional)"
                  options={tasks.filter((t) => t.assignee?.id === user?.id).map((t) => ({ value: t.id, label: t.title }))}
                />
                <DateField label="Date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
                <Field label="Hours">
                  <input type="number" value={form.hoursWorked} onChange={(e) => setForm({ ...form, hoursWorked: parseFloat(e.target.value) })} className="input-field" />
                </Field>
                <TextField
                  label="Description"
                  value={form.description}
                  onChange={(v) => setForm({ ...form, description: v })}
                  placeholder="What did you work on?"
                />
                <div style={{ marginBottom: '1rem' }}>
                  <Button variant="success" onClick={handleLogHours}>Log Hours</Button>
                </div>
              </div>
            </Card>

            <DataTable
              columns={myColumns}
              rows={myTimesheets}
              loading={loading}
              rowKey={(t) => t.id}
              emptyTitle="No timesheet entries"
              emptyMessage="Log your daily work hours using the form above."
            />
          </>
        )}

        {view === 'all' && isAdmin && (
          <DataTable
            columns={allColumns}
            rows={allTimesheets}
            loading={loading}
            rowKey={(_, i) => i}
            emptyTitle="No entries"
            emptyMessage="No timesheet entries have been logged yet."
          />
        )}

        {view === 'summary' && isAdmin && (
          <>
            <div style={{ marginBottom: '1.5rem' }}>
              <Button
                variant="primary"
                onClick={() => setShowGenerateConfirm(true)}
                loading={generating}
                leftIcon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>}
              >
                {generating ? 'Generating...' : 'Generate Attendance'}
              </Button>
            </div>

            {dailySummary && (
              <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                <StatCard label="Total Hours" value={<span className="text-success">{dailySummary.totalHours?.toFixed(1)}h</span>} />
                <StatCard label="Full Day" value={<span className="text-success">{dailySummary.present}</span>} />
                <StatCard label="Partial Day" value={<span className="text-warning">{dailySummary.partial}</span>} />
                <StatCard label="Absent" value={<span className="text-danger">{dailySummary.absent}</span>} />
              </div>
            )}

            {dailySummary?.breakdown && (
              <Card title="Employee Hours Breakdown">
                {Object.entries(dailySummary.breakdown).map(([name, hours]: any) => (
                  <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid var(--border-subtle)', gap: '1rem' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '100px' }}>
                        <ProgressBar value={Math.min((hours / 8) * 100, 100)} tone={hours >= 8 ? 'success' : hours > 0 ? 'warning' : 'danger'} height={6} />
                      </div>
                      <span style={{ fontWeight: 700, color: hours >= 8 ? 'var(--success)' : hours > 0 ? 'var(--warning)' : 'var(--danger)', minWidth: '45px', textAlign: 'right' }}>{hours.toFixed(1)}h</span>
                    </div>
                  </div>
                ))}
              </Card>
            )}

            <ConfirmDialog
              open={showGenerateConfirm}
              title="Generate Attendance"
              message="Generate attendance records from timesheet data?"
              confirmLabel="Generate"
              loading={generating}
              onConfirm={handleGenerateAttendance}
              onCancel={() => setShowGenerateConfirm(false)}
            />
          </>
        )}
      </main>
    </div>
  );
}
