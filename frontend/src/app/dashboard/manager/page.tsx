'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { getManagerDashboard, getProfile } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import {
  PageHeader, Card, StatCard, Badge, KpiBar,
  EmptyState, ErrorState, Skeleton,
} from '@/components/ui';

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

// Maps task status to a Badge tone (replaces legacy badge-* classes).
const TASK_STATUS_TONE: Record<string, 'neutral' | 'info' | 'warning' | 'danger' | 'success'> = {
  TODO: 'neutral',
  IN_PROGRESS: 'info',
  AWAITING_APPROVAL: 'warning',
  REWORK: 'danger',
  COMPLETED: 'success',
};

export default function ManagerDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading]);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(false);
      const profile = await getProfile();
      const data = await getManagerDashboard(profile.id);
      setDashboard(data);
    } catch (err) {
      console.error(err);
      setError(true);
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
        <PageHeader
          title="Manager Dashboard"
          subtitle="Team workload & tasks"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
        />

        {loading ? (
          <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}><Skeleton height={28} width="40%" /><Skeleton height={14} width="70%" style={{ marginTop: '0.5rem' }} /></Card>
            ))}
          </div>
        ) : error ? (
          <Card>
            <ErrorState message="We couldn't load your team dashboard. Please try again." onRetry={loadData} />
          </Card>
        ) : (
          <>
            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <StatCard label="Pending Tasks" value={<span style={{ color: 'var(--warning-fg)' }}>{dashboard?.pendingTasks || 0}</span>} />
              <StatCard label="Pending Overtime" value={<span style={{ color: 'var(--danger-fg)' }}>{dashboard?.pendingOvertime || 0}</span>} />
              <StatCard label="Team Members" value={workloadData.length} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <Card title="Team Workload (Last 7 Days)">
                {workloadData.length ? (
                  <KpiBar data={workloadData} xKey="employee" bars={[{ key: 'hours', name: 'Hours', color: '#10b981' }]} height={300} />
                ) : (
                  <EmptyState title="No workload data" message="Logged hours for your team will appear here." />
                )}
              </Card>

              <Card title="Recent Tasks">
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {dashboard?.recentTasks.map((task) => (
                    <Card key={task.id} style={{ padding: '0.85rem 1rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{task.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{task.assignee.firstName} {task.assignee.lastName} · {task.project?.name}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <Badge tone={TASK_STATUS_TONE[task.status] || 'neutral'} style={{ marginBottom: '0.25rem' }}>{task.status.replace('_', ' ')}</Badge>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Due: {new Date(task.deadline).toLocaleDateString()}</div>
                      </div>
                    </Card>
                  ))}
                  {(!dashboard?.recentTasks?.length) && (
                    <EmptyState title="No recent tasks" />
                  )}
                </div>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
