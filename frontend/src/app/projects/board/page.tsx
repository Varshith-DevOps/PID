'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import {
  getProjects, getProjectById, getProjectBoard, moveTask, getProjectCosting,
  setResourceRate, getSprints, createSprint, getBurndown,
} from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import KanbanBoard, { BoardColumn } from '@/components/KanbanBoard';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid, Legend,
} from 'recharts';

interface Costing {
  currency: string; budget: number; laborCost: number; expenses: number; totalCost: number;
  revenue: number; margin: number; marginPct: number; budgetUsage: number; budgetRemaining: number;
  totalHours: number; billableHours: number;
}
interface Resource { id: string; employeeId: string; costRate: number; billRate: number; employee: { firstName: string; lastName: string }; }
interface Sprint { id: string; name: string; status: string; startDate: string; endDate: string; _count?: { tasks: number }; }
interface BurndownDay { date: string; ideal: number; remaining: number | null; }

export default function ProjectBoardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [projectId, setProjectId] = useState<string>('');
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [costing, setCosting] = useState<Costing | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [rateDraft, setRateDraft] = useState<Record<string, { costRate: number; billRate: number }>>({});
  const [showRates, setShowRates] = useState(false);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [sprintId, setSprintId] = useState<string>('');
  const [burndown, setBurndown] = useState<{ days: BurndownDay[]; unit: string; total: number } | null>(null);
  const [newSprint, setNewSprint] = useState({ name: '', startDate: '', endDate: '' });
  const [showNewSprint, setShowNewSprint] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (!authLoading && !user) router.push('/'); }, [authLoading, user, router]);

  useEffect(() => {
    getProjects().then((d) => {
      const list = d.projects || d || [];
      setProjects(list);
      if (list.length && !projectId) setProjectId(list[0].id);
    }).finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadBoard = useCallback(async (pid: string) => {
    if (!pid) return;
    const [board, cost, detail, sprintList] = await Promise.all([
      getProjectBoard(pid), getProjectCosting(pid).catch(() => null),
      getProjectById(pid).catch(() => null), getSprints(pid).catch(() => []),
    ]);
    setColumns(board.columns || []);
    setCosting(cost);
    setResources(detail?.resources || []);
    setSprints(sprintList || []);
    if ((sprintList || []).length) setSprintId((prev) => prev || sprintList[0].id);
  }, []);

  useEffect(() => { if (projectId) loadBoard(projectId); }, [projectId, loadBoard]);
  useEffect(() => { if (sprintId) getBurndown(sprintId).then(setBurndown).catch(() => setBurndown(null)); }, [sprintId]);

  const handleMove = async (taskId: string, newStatus: string) => {
    setColumns((cols) => {
      const moved = cols.flatMap((c) => c.tasks).find((t) => t.id === taskId);
      if (!moved) return cols;
      return cols.map((c) => ({
        ...c,
        tasks: c.status === newStatus
          ? [...c.tasks.filter((t) => t.id !== taskId), { ...moved, status: newStatus }]
          : c.tasks.filter((t) => t.id !== taskId),
      }));
    });
    try { await moveTask(taskId, { status: newStatus }); } finally { loadBoard(projectId); }
  };

  const openRates = () => {
    const draft: Record<string, { costRate: number; billRate: number }> = {};
    resources.forEach((r) => { draft[r.employeeId] = { costRate: r.costRate || 0, billRate: r.billRate || 0 }; });
    setRateDraft(draft);
    setShowRates(true);
  };
  const saveRates = async () => {
    await Promise.all(resources.map((r) =>
      setResourceRate(projectId, { employeeId: r.employeeId, costRate: rateDraft[r.employeeId]?.costRate, billRate: rateDraft[r.employeeId]?.billRate }),
    ));
    setShowRates(false);
    loadBoard(projectId);
  };
  const submitSprint = async () => {
    if (!newSprint.name || !newSprint.startDate || !newSprint.endDate) return;
    await createSprint(projectId, newSprint);
    setNewSprint({ name: '', startDate: '', endDate: '' });
    setShowNewSprint(false);
    loadBoard(projectId);
  };

  if (authLoading || !user) return <div className="loading-container"><div className="loading-spinner" />Loading...</div>;

  const cur = (n: number) => `${costing?.currency === 'INR' ? '₹' : ''}${(n || 0).toLocaleString()}`;
  const chartData = costing ? [
    { name: 'Budget', value: costing.budget, fill: '#182B6D' },
    { name: 'Cost', value: costing.totalCost, fill: '#ef4444' },
    { name: 'Revenue', value: costing.revenue, fill: '#10b981' },
  ] : [];

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div className="page-header-left">
            <div className="page-header-icon" style={{ background: 'linear-gradient(135deg, #182B6D, #00A7B5)' }}>📋</div>
            <div>
              <h1 className="page-title">Project Board</h1>
              <p className="page-subtitle">Kanban tracking, sprints, time &amp; project costing</p>
            </div>
          </div>
          <div className="page-header-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select className="select-field" value={projectId} onChange={(e) => setProjectId(e.target.value)} style={{ minWidth: 200 }}>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button className="btn btn-ghost btn-sm" onClick={openRates} disabled={!resources.length}>💰 Rates</button>
          </div>
        </div>

        {loading ? <div className="loading-container"><div className="loading-spinner" />Loading...</div> : (
          <>
            {costing && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 18 }}>
                <div className="stat-card"><div className="stat-card-label">Labor Cost</div><div className="stat-card-value">{cur(costing.laborCost)}</div></div>
                <div className="stat-card"><div className="stat-card-label">Expenses</div><div className="stat-card-value">{cur(costing.expenses)}</div></div>
                <div className="stat-card"><div className="stat-card-label">Total Cost</div><div className="stat-card-value">{cur(costing.totalCost)}</div></div>
                <div className="stat-card"><div className="stat-card-label">Revenue</div><div className="stat-card-value">{cur(costing.revenue)}</div></div>
                <div className="stat-card">
                  <div className="stat-card-label">Margin ({costing.marginPct}%)</div>
                  <div className="stat-card-value" style={{ color: costing.margin >= 0 ? '#10b981' : '#ef4444' }}>{cur(costing.margin)}</div>
                </div>
                <div className="stat-card"><div className="stat-card-label">Budget Used</div><div className="stat-card-value">{costing.budgetUsage}%</div></div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
              {costing && (costing.budget > 0 || costing.totalCost > 0) && (
                <div className="glass-card" style={{ padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#9aa6c0', marginBottom: 8 }}>Budget vs Cost vs Revenue</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartData}>
                      <XAxis dataKey="name" stroke="#9aa6c0" fontSize={12} />
                      <YAxis stroke="#9aa6c0" fontSize={12} />
                      <Tooltip formatter={(v: any) => cur(Number(v))} contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)' }} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>{chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="glass-card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#9aa6c0' }}>Sprint Burndown</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <select className="select-field" value={sprintId} onChange={(e) => setSprintId(e.target.value)} style={{ minWidth: 130, padding: '4px 8px' }}>
                      {sprints.length === 0 && <option value="">No sprints</option>}
                      {sprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowNewSprint((v) => !v)}>+ Sprint</button>
                  </div>
                </div>
                {showNewSprint && (
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                    <input className="input-field" placeholder="Sprint name" value={newSprint.name} onChange={(e) => setNewSprint({ ...newSprint, name: e.target.value })} style={{ flex: 1, minWidth: 120 }} />
                    <input className="input-field" type="date" value={newSprint.startDate} onChange={(e) => setNewSprint({ ...newSprint, startDate: e.target.value })} />
                    <input className="input-field" type="date" value={newSprint.endDate} onChange={(e) => setNewSprint({ ...newSprint, endDate: e.target.value })} />
                    <button className="btn btn-primary btn-sm" onClick={submitSprint}>Create</button>
                  </div>
                )}
                {burndown && burndown.days?.length ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={burndown.days}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="date" stroke="#9aa6c0" fontSize={10} />
                      <YAxis stroke="#9aa6c0" fontSize={11} />
                      <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)' }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="ideal" name="Ideal" stroke="#6b7280" strokeDasharray="5 5" dot={false} />
                      <Line type="monotone" dataKey="remaining" name={`Remaining (${burndown.unit})`} stroke="#00A7B5" strokeWidth={2} connectNulls dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <div style={{ color: '#6b7490', fontSize: 12, padding: '20px 0' }}>No sprint data to chart yet.</div>}
              </div>
            </div>

            <div className="glass-card" style={{ padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#9aa6c0', marginBottom: 12 }}>Board — drag cards between columns to update status</div>
              {columns.length ? <KanbanBoard columns={columns} onMove={handleMove} /> : <div style={{ color: '#6b7490' }}>No tasks on this project yet.</div>}
            </div>
          </>
        )}

        {/* Resource rate editor */}
        {showRates && (
          <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(10,14,26,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: 520, padding: 22 }}>
              <h2 style={{ margin: '0 0 4px', color: '#e7ecf6', fontSize: 18 }}>Resource Rates</h2>
              <p style={{ margin: '0 0 16px', color: '#9aa6c0', fontSize: 13 }}>Cost = what the resource costs you / hour. Bill = what you charge the client / hour.</p>
              {resources.length === 0 && <div style={{ color: '#9aa6c0' }}>No resources on this project.</div>}
              {resources.map((r) => (
                <div key={r.employeeId} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ flex: 1, color: '#e7ecf6', fontSize: 13 }}>{r.employee.firstName} {r.employee.lastName}</div>
                  <input className="input-field" type="number" min={0} placeholder="Cost/hr" value={rateDraft[r.employeeId]?.costRate ?? 0}
                    onChange={(e) => setRateDraft({ ...rateDraft, [r.employeeId]: { ...rateDraft[r.employeeId], costRate: Number(e.target.value) } })} style={{ width: 110 }} />
                  <input className="input-field" type="number" min={0} placeholder="Bill/hr" value={rateDraft[r.employeeId]?.billRate ?? 0}
                    onChange={(e) => setRateDraft({ ...rateDraft, [r.employeeId]: { ...rateDraft[r.employeeId], billRate: Number(e.target.value) } })} style={{ width: 110 }} />
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button className="btn btn-ghost" onClick={() => setShowRates(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={saveRates} disabled={!resources.length}>Save rates</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
