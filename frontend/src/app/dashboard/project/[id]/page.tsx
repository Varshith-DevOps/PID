'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getProjectDashboard } from '@/lib/api';
import {
  Badge, Card, ErrorState, KpiBar, KpiPie, LoadingBlock, PageHeader, StatCard,
} from '@/components/ui';
import type { Tone } from '@/components/ui';

interface ProjectDashboard {
  project: { name: string; status: string; budget: number; deadline: string };
  metrics: {
    completionPercent: number;
    totalTasks: number;
    completedTasks: number;
    totalCost: number;
    laborCost: number;
    totalExpense: number;
    budgetUsage: number;
    resources: number;
    daysUntilDeadline: number;
  };
  taskStatus: { TODO: number; IN_PROGRESS: number; COMPLETED: number };
}

const STATUS_TONE: Record<string, Tone> = {
  ACTIVE: 'success',
  PLANNING: 'neutral',
  ON_HOLD: 'warning',
  COMPLETED: 'info',
  CANCELLED: 'danger',
};

const TASK_COLORS = ['var(--text-muted)', '#00A7B5', '#10b981'];

export default function ProjectDashboardPage() {
  const params = useParams();
  const [dashboard, setDashboard] = useState<ProjectDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (params.id) loadData();
  }, [params.id]);

  const loadData = async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await getProjectDashboard(params.id as string);
      setDashboard(data);
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: '2rem' }}><LoadingBlock /></div>;
  if (error || !dashboard) return <div style={{ padding: '2rem' }}><ErrorState message="We couldn’t load this project dashboard." onRetry={loadData} /></div>;

  const taskData = [
    { name: 'To Do', value: dashboard.taskStatus.TODO },
    { name: 'In Progress', value: dashboard.taskStatus.IN_PROGRESS },
    { name: 'Completed', value: dashboard.taskStatus.COMPLETED },
  ];

  const costData = [
    { name: 'Labor Cost', value: dashboard.metrics.laborCost || 0 },
    { name: 'Expenses', value: dashboard.metrics.totalExpense || 0 },
    { name: 'Total Cost', value: dashboard.metrics.totalCost || 0 },
  ];

  return (
    <div style={{ padding: '1.5rem' }}>
      <PageHeader
        title={dashboard.project.name}
        subtitle={<Badge tone={STATUS_TONE[dashboard.project.status] || 'neutral'} dot>{dashboard.project.status}</Badge>}
        actions={
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Days Until Deadline</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{dashboard.metrics.daysUntilDeadline}</div>
          </div>
        }
      />

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: '1.5rem' }}>
        <StatCard label="Completion" value={`${dashboard.metrics.completionPercent}%`} />
        <StatCard label="Tasks" value={`${dashboard.metrics.completedTasks}/${dashboard.metrics.totalTasks}`} />
        <StatCard label="Budget Used" value={`${dashboard.metrics.budgetUsage}%`} />
        <StatCard label="Resources" value={dashboard.metrics.resources} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        <Card title="Task Status">
          <KpiPie data={taskData} colors={TASK_COLORS} height={250} />
        </Card>

        <Card title="Cost Breakdown">
          <KpiBar data={costData} xKey="name" bars={[{ key: 'value', name: 'Amount', color: '#FFB23F' }]} height={250} />
        </Card>
      </div>
    </div>
  );
}
