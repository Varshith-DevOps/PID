'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getProjectDashboard } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

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

const COLORS = ['#6b7280', '#3b82f6', '#10b981'];

export default function ProjectDashboardPage() {
  const params = useParams();
  const [dashboard, setDashboard] = useState<ProjectDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) loadData();
  }, [params.id]);

  const loadData = async () => {
    try {
      const data = await getProjectDashboard(params.id as string);
      setDashboard(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  const taskData = dashboard
    ? [
        { name: 'To Do', value: dashboard.taskStatus.TODO },
        { name: 'In Progress', value: dashboard.taskStatus.IN_PROGRESS },
        { name: 'Completed', value: dashboard.taskStatus.COMPLETED },
      ]
    : [];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">{dashboard?.project.name}</h1>
          <span className={`px-2 py-1 rounded text-sm ${
            dashboard?.project.status === 'ACTIVE' ? 'bg-green-100' : 'bg-gray-200'
          }`}>
            {dashboard?.project.status}
          </span>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500">Days Until Deadline</div>
          <div className="text-2xl font-bold">{dashboard?.metrics.daysUntilDeadline}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-gray-500">Completion</div>
          <div className="text-2xl font-bold">{dashboard?.metrics.completionPercent}%</div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-gray-500">Tasks</div>
          <div className="text-2xl font-bold">{dashboard?.metrics.completedTasks}/{dashboard?.metrics.totalTasks}</div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-gray-500">Budget Used</div>
          <div className="text-2xl font-bold">{dashboard?.metrics.budgetUsage}%</div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-gray-500">Resources</div>
          <div className="text-2xl font-bold">{dashboard?.metrics.resources}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-4">Task Status</h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={taskData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {taskData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-4">Cost Breakdown</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={[
                { name: 'Labor Cost', value: dashboard?.metrics.laborCost || 0 },
                { name: 'Expenses', value: dashboard?.metrics.totalExpense || 0 },
                { name: 'Total Cost', value: dashboard?.metrics.totalCost || 0 },
              ]}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}