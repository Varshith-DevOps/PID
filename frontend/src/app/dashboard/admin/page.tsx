'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { getDashboardStats, getAllUtilization, getResourceAllocation } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import {
  PageHeader, Card, StatCard, Badge, ProgressBar, KpiBar, KpiPie,
  EmptyState, ErrorState, Skeleton,
} from '@/components/ui';

interface Stats {
  employees: number;
  projects: number;
  tasks: number;
  overtime: number;
  attendance: { today: number; monthly: { present: number; absent: number; late: number; total: number } };
}

interface Utilization {
  utilization: Array<{ employee: { name: string; department: string }; utilization: number }>;
  avgUtilization: number;
}

interface ResourceData {
  total: number;
  occupiedCount: number;
  benchCount: number;
  occupied: Array<{ id: string; name: string; department: string; jobTitle: string; activeTasks: number }>;
  bench: Array<{ id: string; name: string; department: string; jobTitle: string; activeTasks: number }>;
}

const ATTENDANCE_COLORS = ['#10b981', '#f59e0b', '#ef4444'];
const RESOURCE_COLORS = ['#00A7B5', '#ef4444'];

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [utilization, setUtilization] = useState<Utilization | null>(null);
  const [resources, setResources] = useState<ResourceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN'))) router.push('/');
  }, [user, authLoading]);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(false);
      const [statsData, utilData, resourceData] = await Promise.all([
        getDashboardStats(),
        getAllUtilization(),
        getResourceAllocation(),
      ]);
      setStats(statsData);
      setUtilization(utilData);
      setResources(resourceData);
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="app-layout">
        <Sidebar activePath="/dashboard/admin" />
        <main className="main-content">
          <Skeleton height={28} width="30%" />
          <Skeleton height={14} width="55%" style={{ marginTop: '0.75rem' }} />
        </main>
      </div>
    );
  }

  const attendanceData = stats
    ? [
        { name: 'Present', value: stats.attendance.monthly.present },
        { name: 'Late', value: stats.attendance.monthly.late },
        { name: 'Absent', value: stats.attendance.monthly.absent },
      ]
    : [];

  const resourcePieData = resources
    ? [
        { name: 'Occupied', value: resources.occupiedCount },
        { name: 'Bench', value: resources.benchCount },
      ]
    : [];

  const topUtilized = utilization?.utilization.slice(0, 5).map((u) => ({
    name: u.employee.name,
    utilization: u.utilization,
  })) || [];

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <PageHeader
          title="Admin Dashboard"
          subtitle="Overview & analytics"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>}
        />

        {loading ? (
          <>
            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}><Skeleton height={28} width="40%" /><Skeleton height={14} width="70%" style={{ marginTop: '0.5rem' }} /></Card>
              ))}
            </div>
            <Card style={{ marginTop: '1.5rem' }}><Skeleton height={200} /></Card>
          </>
        ) : error ? (
          <Card>
            <ErrorState message="We couldn't load admin analytics. Please try again." onRetry={loadData} />
          </Card>
        ) : (
          <>
            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              <StatCard label="Total Employees" value={stats?.employees || 0} />
              <StatCard label="Active Projects" value={<span style={{ color: 'var(--success-fg)' }}>{stats?.projects || 0}</span>} />
              <StatCard label="Pending Tasks" value={<span style={{ color: 'var(--warning-fg)' }}>{stats?.tasks || 0}</span>} />
              <StatCard label="Pending Overtime" value={<span style={{ color: 'var(--danger-fg)' }}>{stats?.overtime || 0}</span>} />
            </div>

            {/* Resource Allocation Card */}
            {resources && (
              <Card
                title={(
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    Resource Allocation
                  </span>
                )}
                style={{ marginBottom: '1.5rem' }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '1.5rem', alignItems: 'start' }}>
                  {/* Pie Chart */}
                  <div style={{ textAlign: 'center' }}>
                    <KpiPie data={resourcePieData} dataKey="value" nameKey="name" height={180} colors={RESOURCE_COLORS} />
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '0.5rem' }}>
                      <div>
                        <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent)' }}>{resources.occupiedCount}</span>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Occupied</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--danger-fg)' }}>{resources.benchCount}</span>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Bench</div>
                      </div>
                    </div>
                  </div>

                  {/* Bench Employee List */}
                  <div>
                    <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                      Bench Resources ({resources.benchCount})
                    </h3>
                    {resources.bench.length === 0 ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>All employees are assigned to tasks</div>
                    ) : (
                      <div style={{ display: 'grid', gap: '0.5rem' }}>
                        {resources.bench.map((emp) => (
                          <Card key={emp.id} style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{emp.name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{emp.jobTitle}</div>
                            </div>
                            <Badge tone="neutral">{emp.department}</Badge>
                          </Card>
                        ))}
                      </div>
                    )}

                    <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '1rem', marginBottom: '0.75rem' }}>
                      Top Occupied Resources
                    </h3>
                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                      {resources.occupied.slice(0, 5).map((emp) => (
                        <Card key={emp.id} style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{emp.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{emp.jobTitle}</div>
                          </div>
                          <Badge tone="info">{emp.activeTasks} tasks</Badge>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <Card title="Attendance Overview">
                {attendanceData.some((d) => d.value > 0) ? (
                  <KpiPie data={attendanceData} dataKey="value" nameKey="name" height={250} colors={ATTENDANCE_COLORS} />
                ) : (
                  <EmptyState title="No attendance data" />
                )}
              </Card>

              <Card title="Top Utilized Employees">
                {topUtilized.length ? (
                  <KpiBar data={topUtilized} xKey="name" bars={[{ key: 'utilization', name: 'Utilization', color: '#00A7B5' }]} height={250} />
                ) : (
                  <EmptyState title="No utilization data" />
                )}
              </Card>
            </div>

            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Average Utilization</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '200px' }}>
                    <ProgressBar value={utilization?.avgUtilization || 0} tone="accent" />
                  </div>
                  <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent)' }}>{utilization?.avgUtilization || 0}%</span>
                </div>
              </div>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
