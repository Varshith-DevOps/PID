'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { getManagerDashboard, getProfile } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Sidebar from '@/components/Sidebar';

interface TeamWorkload {
  employee: string;
  hours: number;
}

interface Task {
  id: string;
  title: string;
  status: string;
  deadline: string;
  assignee: { firstName: string; lastName: string };
  project: { name: string };
}

interface Dashboard {
  pendingTasks: number;
  pendingOvertime: number;
  teamWorkload: TeamWorkload[];
  recentTasks: Task[];
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
          <p key={idx} style={{ color: entry.color || '#10b981', fontWeight: 700, fontSize: '0.9rem' }}>{entry.value}h</p>
        ))}
      </div>
    );
  }
  return null;
};

export default function ManagerDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading]);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const profile = await getProfile();
      const data = await getManagerDashboard(profile.id);
      setDashboard(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !user) return <div className="loading-container"><div className="loading-spinner" />Loading...</div>;

  const workloadData = dashboard?.teamWorkload || [];

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div className="page-header-left">
            <div className="page-header-icon" style={{ background: 'linear-gradient(135deg, #10b981, #00A7B5)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div><h1 className="page-title">Manager Dashboard</h1><p className="page-subtitle">Team workload & tasks</p></div>
          </div>
        </div>

        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="stat-card"><div className="stat-card-value text-warning">{dashboard?.pendingTasks || 0}</div><div className="stat-card-label">Pending Tasks</div></div>
          <div className="stat-card"><div className="stat-card-value text-danger">{dashboard?.pendingOvertime || 0}</div><div className="stat-card-label">Pending Overtime</div></div>
          <div className="stat-card"><div className="stat-card-value text-blue">{workloadData.length}</div><div className="stat-card-label">Team Members</div></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Team Workload (Last 7 Days)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={workloadData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="employee" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.5)' }} axisLine={{ stroke: 'rgba(255,255,255,0.08)' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.5)' }} axisLine={{ stroke: 'rgba(255,255,255,0.08)' }} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="hours" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Recent Tasks</h2>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {dashboard?.recentTasks.map((task) => (
                <div key={task.id} className="glass-card" style={{ padding: '0.85rem 1rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{task.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{task.assignee.firstName} {task.assignee.lastName} · {task.project?.name}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className={`badge ${TASK_STATUS_MAP[task.status] || 'badge-neutral'}`} style={{ marginBottom: '0.25rem', display: 'inline-block' }}>{task.status.replace('_', ' ')}</span>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Due: {new Date(task.deadline).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
              {(!dashboard?.recentTasks?.length) && (
                <div className="empty-state">No recent tasks</div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}