'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { getDashboardStats, getAllUtilization, getResourceAllocation } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import Sidebar from '@/components/Sidebar';

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

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6'];
const RESOURCE_COLORS = ['#3b82f6', '#ef4444'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: 'rgba(17,24,39,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0.75rem 1rem', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>{label}</p>
        {payload.map((entry: any, idx: number) => (
          <p key={idx} style={{ color: entry.color || '#3b82f6', fontWeight: 700, fontSize: '0.9rem' }}>{entry.name}: {entry.value}</p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [utilization, setUtilization] = useState<Utilization | null>(null);
  const [resources, setResources] = useState<ResourceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN'))) router.push('/');
  }, [user, authLoading]);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    try {
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
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !user) return <div className="loading-container"><div className="loading-spinner" />Loading...</div>;

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

  const topUtilized = utilization?.utilization.slice(0, 5) || [];

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div className="page-header-left">
            <div className="page-header-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
            </div>
            <div><h1 className="page-title">Admin Dashboard</h1><p className="page-subtitle">Overview & analytics</p></div>
          </div>
        </div>

        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="stat-card"><div className="stat-card-value text-blue">{stats?.employees || 0}</div><div className="stat-card-label">Total Employees</div></div>
          <div className="stat-card"><div className="stat-card-value text-success">{stats?.projects || 0}</div><div className="stat-card-label">Active Projects</div></div>
          <div className="stat-card"><div className="stat-card-value text-warning">{stats?.tasks || 0}</div><div className="stat-card-label">Pending Tasks</div></div>
          <div className="stat-card"><div className="stat-card-value text-danger">{stats?.overtime || 0}</div><div className="stat-card-label">Pending Overtime</div></div>
        </div>

        {/* Resource Allocation Card */}
        {resources && (
          <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Resource Allocation
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '1.5rem', alignItems: 'start' }}>
              {/* Pie Chart */}
              <div style={{ textAlign: 'center' }}>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={resourcePieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" stroke="none"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {resourcePieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={RESOURCE_COLORS[index]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '0.5rem' }}>
                  <div>
                    <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#3b82f6' }}>{resources.occupiedCount}</span>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Occupied</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ef4444' }}>{resources.benchCount}</span>
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
                      <div key={emp.id} className="glass-card" style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{emp.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{emp.jobTitle}</div>
                        </div>
                        <span className="badge badge-neutral">{emp.department}</span>
                      </div>
                    ))}
                  </div>
                )}

                <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '1rem', marginBottom: '0.75rem' }}>
                  Top Occupied Resources
                </h3>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {resources.occupied.slice(0, 5).map((emp) => (
                    <div key={emp.id} className="glass-card" style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{emp.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{emp.jobTitle}</div>
                      </div>
                      <span className="badge badge-info">{emp.activeTasks} tasks</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Attendance Overview</h2>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={attendanceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  dataKey="value"
                  stroke="none"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {attendanceData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Top Utilized Employees</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topUtilized}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="employee.name" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.5)' }} axisLine={{ stroke: 'rgba(255,255,255,0.08)' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.5)' }} axisLine={{ stroke: 'rgba(255,255,255,0.08)' }} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="utilization" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>Average Utilization</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '200px', height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${utilization?.avgUtilization || 0}%`, height: '100%', background: 'var(--gradient-primary)', borderRadius: '4px', transition: 'width 1s ease' }} />
              </div>
              <span style={{ fontSize: '1.75rem', fontWeight: 800, background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{utilization?.avgUtilization || 0}%</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}