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
  Button, Card, EmptyState, KpiBar, KpiLine, LoadingBlock,
  Modal, PageHeader, StatCard,
} from '@/components/ui';

interface Costing {
  currency: string; budget: number; laborCost: number; expenses: number; totalCost: number;
  revenue: number; margin: number; marginPct: number; budgetUsage: number; budgetRemaining: number;
  totalHours: number; billableHours: number;
}
interface Resource { id: string; employeeId: string; costRate: number; billRate: number; employee: { firstName: string; lastName: string }; }
interface Sprint { id: string; name: string; status: string; startDate: string; endDate: string; _count?: { tasks: number }; }
interface BurndownDay { date: string; ideal: number; remaining: number | null; }

const BOARD_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="11" rx="1"/></svg>
);

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
    { name: 'Budget', value: costing.budget },
    { name: 'Cost', value: costing.totalCost },
    { name: 'Revenue', value: costing.revenue },
  ] : [];

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <PageHeader
          title="Project Board"
          subtitle="Kanban tracking, sprints, time & project costing"
          icon={BOARD_ICON}
          actions={
            <>
              <select className="select-field" value={projectId} onChange={(e) => setProjectId(e.target.value)} style={{ minWidth: 200 }}>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <Button variant="ghost" size="sm" onClick={openRates} disabled={!resources.length}>Rates</Button>
            </>
          }
        />

        {loading ? <LoadingBlock /> : (
          <>
            {costing && (
              <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: 18 }}>
                <StatCard label="Labor Cost" value={cur(costing.laborCost)} />
                <StatCard label="Expenses" value={cur(costing.expenses)} />
                <StatCard label="Total Cost" value={cur(costing.totalCost)} />
                <StatCard label="Revenue" value={cur(costing.revenue)} />
                <StatCard
                  label={`Margin (${costing.marginPct}%)`}
                  value={<span style={{ color: costing.margin >= 0 ? 'var(--success-fg)' : 'var(--danger-fg)' }}>{cur(costing.margin)}</span>}
                />
                <StatCard label="Budget Used" value={`${costing.budgetUsage}%`} />
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
              {costing && (costing.budget > 0 || costing.totalCost > 0) && (
                <Card title="Budget vs Cost vs Revenue">
                  <KpiBar
                    data={chartData}
                    xKey="name"
                    bars={[{ key: 'value', name: 'Amount' }]}
                    height={200}
                  />
                </Card>
              )}

              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Sprint Burndown</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <select className="select-field" value={sprintId} onChange={(e) => setSprintId(e.target.value)} style={{ minWidth: 130, padding: '4px 8px' }}>
                      {sprints.length === 0 && <option value="">No sprints</option>}
                      {sprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <Button variant="ghost" size="sm" onClick={() => setShowNewSprint((v) => !v)}>+ Sprint</Button>
                  </div>
                </div>
                {showNewSprint && (
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                    <input className="input-field" placeholder="Sprint name" value={newSprint.name} onChange={(e) => setNewSprint({ ...newSprint, name: e.target.value })} style={{ flex: 1, minWidth: 120 }} />
                    <input className="input-field" type="date" value={newSprint.startDate} onChange={(e) => setNewSprint({ ...newSprint, startDate: e.target.value })} />
                    <input className="input-field" type="date" value={newSprint.endDate} onChange={(e) => setNewSprint({ ...newSprint, endDate: e.target.value })} />
                    <Button variant="primary" size="sm" onClick={submitSprint}>Create</Button>
                  </div>
                )}
                {burndown && burndown.days?.length ? (
                  <KpiLine
                    data={burndown.days}
                    xKey="date"
                    lines={[
                      { key: 'ideal', name: 'Ideal', color: 'var(--text-muted)' },
                      { key: 'remaining', name: `Remaining (${burndown.unit})`, color: '#00A7B5' },
                    ]}
                    height={200}
                  />
                ) : <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '20px 0' }}>No sprint data to chart yet.</div>}
              </Card>
            </div>

            <Card title="Board — drag cards between columns to update status">
              {columns.length
                ? <KanbanBoard columns={columns} onMove={handleMove} />
                : <EmptyState title="No tasks yet" message="This project has no tasks on the board." />}
            </Card>
          </>
        )}

        {/* Resource rate editor */}
        <Modal
          open={showRates}
          onClose={() => setShowRates(false)}
          title="Resource Rates"
          width={520}
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowRates(false)}>Cancel</Button>
              <Button variant="primary" onClick={saveRates} disabled={!resources.length}>Save rates</Button>
            </>
          }
        >
          <p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: 13 }}>Cost = what the resource costs you / hour. Bill = what you charge the client / hour.</p>
          {resources.length === 0 && <div style={{ color: 'var(--text-muted)' }}>No resources on this project.</div>}
          {resources.map((r) => (
            <div key={r.employeeId} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <div style={{ flex: 1, color: 'var(--text-primary)', fontSize: 13 }}>{r.employee.firstName} {r.employee.lastName}</div>
              <input className="input-field" type="number" min={0} placeholder="Cost/hr" value={rateDraft[r.employeeId]?.costRate ?? 0}
                onChange={(e) => setRateDraft({ ...rateDraft, [r.employeeId]: { ...rateDraft[r.employeeId], costRate: Number(e.target.value) } })} style={{ width: 110 }} />
              <input className="input-field" type="number" min={0} placeholder="Bill/hr" value={rateDraft[r.employeeId]?.billRate ?? 0}
                onChange={(e) => setRateDraft({ ...rateDraft, [r.employeeId]: { ...rateDraft[r.employeeId], billRate: Number(e.target.value) } })} style={{ width: 110 }} />
            </div>
          ))}
        </Modal>
      </main>
    </div>
  );
}
