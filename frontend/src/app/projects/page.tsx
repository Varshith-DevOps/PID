'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { getProjects, getProjectById, createProject, updateProject, deleteProject, addProjectExpense, getTasks, createTask, updateTask, deleteTask, getEmployees } from '@/lib/api';
import { CanCreate, CanEdit, CanDelete } from '@/components/PermissionGuard';
import Sidebar from '@/components/Sidebar';
import { validateForm, required, amount, nonNegative, date as vDate } from '@/lib/validators';
import {
  Badge, Banner, Button, ConfirmDialog, DataTable, Field, Modal,
  NumberField, PageHeader, ProgressBar, SegmentedTabs, Select, StatCard, StatusChip,
  Textarea, TextField,
} from '@/components/ui';
import type { Column, Tone } from '@/components/ui';

interface Project extends Record<string, unknown> {
  id: string;
  name: string;
  description: string;
  startDate: string;
  deadline: string;
  budget: number;
  status: string;
  manager: { id: string; firstName: string; lastName: string };
  resources: { employee: { id: string; firstName: string; lastName: string } }[];
  metrics: { totalCost: number; totalExpense: number; completionPercent: number };
}

interface Task extends Record<string, unknown> {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  deadline: string;
  estimatedHours: number;
  actualHours: number;
  project: { id: string; name: string };
  assignee: { id: string; firstName: string; lastName: string };
}

const STATUS_TONE: Record<string, Tone> = {
  PLANNING: 'neutral',
  ACTIVE: 'success',
  ON_HOLD: 'warning',
  COMPLETED: 'info',
  CANCELLED: 'danger',
};

const PRIORITY_TONE: Record<string, Tone> = {
  LOW: 'neutral',
  MEDIUM: 'info',
  HIGH: 'warning',
  URGENT: 'danger',
};

const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'AWAITING_APPROVAL', 'REWORK', 'COMPLETED'];
const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const PROJECT_STATUSES = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];

const PROJECTS_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
);

export default function ProjectsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'projects' | 'tasks' | 'detail' | 'createProject' | 'editProject' | 'createTask'>('projects');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [form, setForm] = useState({ name: '', description: '', startDate: '', deadline: '', budget: 0, managerId: '', status: 'PLANNING' });
  const [taskForm, setTaskForm] = useState({ title: '', description: '', projectId: '', assigneeId: '', estimatedHours: 0, deadline: '', priority: 'MEDIUM' });
  const [expenseForm, setExpenseForm] = useState({ description: '', amount: 0 });
  const [projectSubmitted, setProjectSubmitted] = useState(false);
  const [taskSubmitted, setTaskSubmitted] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading]);

  useEffect(() => {
    if (user && view === 'projects') loadProjects();
    if (user && view === 'tasks') loadTasks();
    if (user && view === 'createTask' && projects.length === 0) loadProjects();
  }, [user, view]);

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const data = await getProjects({ limit: 50 });
      setProjects(data.projects);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadTasks = async () => {
    setLoading(true);
    try {
      const data = await getTasks();
      setTasks(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadEmployees = async () => {
    try {
      const data = await getEmployees({ limit: 100 });
      setEmployees(data.employees);
    } catch (err) { console.error(err); }
  };

  const loadProjectDetail = async (id: string) => {
    try {
      const data = await getProjectById(id);
      setSelectedProject(data);
      setView('detail');
    } catch (err) { console.error(err); }
  };

  const resetProjectForm = () => {
    setEditingProject(null);
    setForm({ name: '', description: '', startDate: '', deadline: '', budget: 0, managerId: '', status: 'PLANNING' });
    setProjectSubmitted(false);
    setFormError('');
  };

  const handleSaveProject = async () => {
    setProjectSubmitted(true);
    const { isValid, firstError } = validateForm(
      { name: form.name, budget: String(form.budget ?? ''), startDate: form.startDate, deadline: form.deadline },
      { name: required('Name'), budget: amount, startDate: vDate('Start date'), deadline: vDate('Deadline') }
    );
    if (!isValid) {
      setFormError(firstError || 'Please correct the highlighted fields.');
      return;
    }
    if (form.startDate && form.deadline && form.deadline < form.startDate) {
      setFormError('Deadline must be on or after the start date.');
      return;
    }
    setFormError('');
    try {
      await createProject(form);
      resetProjectForm();
      setView('projects');
      loadProjects();
      alert('Project created');
    } catch (err) { alert('Failed to create project'); }
  };

  const beginEditProject = (project: Project) => {
    setEditingProject(project);
    setForm({
      name: project.name || '',
      description: project.description || '',
      startDate: project.startDate ? project.startDate.split('T')[0] : '',
      deadline: project.deadline ? project.deadline.split('T')[0] : '',
      budget: project.budget || 0,
      managerId: project.manager?.id || '',
      status: project.status || 'PLANNING',
    });
    setProjectSubmitted(false);
    setFormError('');
    setView('editProject');
  };

  const handleUpdateProject = async () => {
    if (!editingProject) return;
    setProjectSubmitted(true);
    const { isValid, firstError } = validateForm(
      { name: form.name, budget: String(form.budget ?? ''), startDate: form.startDate, deadline: form.deadline },
      { name: required('Name'), budget: amount, startDate: vDate('Start date'), deadline: vDate('Deadline') }
    );
    if (!isValid) {
      setFormError(firstError || 'Please correct the highlighted fields.');
      return;
    }
    if (form.startDate && form.deadline && form.deadline < form.startDate) {
      setFormError('Deadline must be on or after the start date.');
      return;
    }
    setFormError('');
    try {
      await updateProject(editingProject.id, form);
      resetProjectForm();
      setView('projects');
      loadProjects();
      alert('Project updated');
    } catch (err) { alert('Failed to update project'); }
  };

  const handleDeleteProject = async (project: Project) => {
    try {
      await deleteProject(project.id);
      if (selectedProject?.id === project.id) setSelectedProject(null);
      loadProjects();
      setView('projects');
      alert('Project deactivated');
    } catch (err) { alert('Failed to deactivate project'); }
    finally { setDeleteTarget(null); }
  };

  const resetTaskForm = () => {
    setTaskForm({ title: '', description: '', projectId: '', assigneeId: '', estimatedHours: 0, deadline: '', priority: 'MEDIUM' });
    setTaskSubmitted(false);
    setFormError('');
  };

  const handleSaveTask = async () => {
    setTaskSubmitted(true);
    const { isValid, firstError } = validateForm(
      { title: taskForm.title, estimatedHours: String(taskForm.estimatedHours ?? '') },
      { title: required('Title'), estimatedHours: nonNegative('Hours') }
    );
    if (!isValid) {
      setFormError(firstError || 'Please correct the highlighted fields.');
      return;
    }
    setFormError('');
    try {
      await createTask(taskForm);
      const targetProjectId = taskForm.projectId;
      resetTaskForm();
      setView('tasks');
      loadTasks();
      if (targetProjectId) loadProjectDetail(targetProjectId);
      alert('Task created');
    } catch (err) { alert('Failed to create task'); }
  };

  const handleAddExpense = async () => {
    if (!selectedProject) return;
    try {
      await addProjectExpense(selectedProject.id, expenseForm);
      setExpenseForm({ description: '', amount: 0 });
      loadProjectDetail(selectedProject.id);
      alert('Expense added');
    } catch (err) { alert('Failed to add expense'); }
  };

  const handleTaskStatusChange = async (taskId: string, newStatus: string) => {
    try {
      await updateTask(taskId, { status: newStatus });
      loadTasks();
      if (selectedProject) loadProjectDetail(selectedProject.id);
    } catch (err) { console.error(err); }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(taskId);
      loadTasks();
      if (selectedProject) loadProjectDetail(selectedProject.id);
    } catch (err) { alert('Failed to delete task'); }
    finally { setDeleteTaskId(null); }
  };

  if (authLoading || !user) return <div className="loading-container"><div className="loading-spinner" />Loading...</div>;

  const projectColumns: Column<Project>[] = [
    {
      key: 'name',
      header: 'Project',
      render: (p) => (
        <button
          onClick={() => loadProjectDetail(p.id)}
          style={{ fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontFamily: 'inherit', fontSize: 'inherit', padding: 0, textAlign: 'left' }}
        >
          {p.name}
        </button>
      ),
    },
    { key: 'manager', header: 'Manager', render: (p) => <>{p.manager?.firstName} {p.manager?.lastName}</> },
    { key: 'deadline', header: 'Deadline', render: (p) => <>{p.deadline ? new Date(p.deadline).toLocaleDateString() : '—'}</> },
    { key: 'budget', header: 'Budget', align: 'right', render: (p) => <span style={{ fontWeight: 600 }}>₹{p.budget?.toLocaleString()}</span> },
    {
      key: 'progress',
      header: 'Progress',
      align: 'center',
      width: 160,
      render: (p) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
          <div style={{ width: 70 }}><ProgressBar value={p.metrics?.completionPercent || 0} tone="accent" height={6} /></div>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent)' }}>{p.metrics?.completionPercent || 0}%</span>
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (p) => <Badge tone={STATUS_TONE[p.status] || 'neutral'} dot>{p.status}</Badge> },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (p) => (
        <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
          <CanEdit module="PROJECTS">
            <Button variant="ghost" size="sm" onClick={() => beginEditProject(p)}>Edit</Button>
          </CanEdit>
          <CanDelete module="PROJECTS">
            <Button variant="danger" size="sm" onClick={() => setDeleteTarget(p)}>Deactivate</Button>
          </CanDelete>
        </div>
      ),
    },
  ];

  const taskColumns: Column<Task>[] = [
    { key: 'title', header: 'Task', render: (t) => <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.title}</span> },
    { key: 'project', header: 'Project', render: (t) => <>{t.project?.name || '—'}</> },
    { key: 'assignee', header: 'Assigned To', render: (t) => <>{t.assignee?.firstName} {t.assignee?.lastName}</> },
    { key: 'priority', header: 'Priority', align: 'center', render: (t) => <Badge tone={PRIORITY_TONE[t.priority] || 'neutral'} dot>{t.priority}</Badge> },
    {
      key: 'status',
      header: 'Status',
      render: (t) => (
        <CanEdit module="PROJECTS" fallback={<StatusChip status={t.status} />}>
          <select value={t.status} onChange={(e) => handleTaskStatusChange(t.id, e.target.value)} className="select-field" style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', width: 'auto' }}>
            {TASK_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </CanEdit>
      ),
    },
    {
      key: 'hours',
      header: 'Hours',
      align: 'center',
      render: (t) => <span style={{ fontWeight: 600 }}><span style={{ color: 'var(--success-fg)' }}>{t.actualHours || 0}</span>/{t.estimatedHours || 0}h</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (t) => (
        <CanDelete module="PROJECTS">
          <Button variant="danger" size="sm" onClick={() => setDeleteTaskId(t.id)}>Delete</Button>
        </CanDelete>
      ),
    },
  ];

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <PageHeader
          title="Projects"
          subtitle="Manage projects & tasks"
          icon={PROJECTS_ICON}
          actions={
            <>
              {(view === 'projects' || view === 'tasks') && (
                <SegmentedTabs
                  items={[{ key: 'projects', label: 'Projects' }, { key: 'tasks', label: 'Tasks' }]}
                  value={view}
                  onChange={(k) => setView(k as 'projects' | 'tasks')}
                />
              )}
              <CanCreate module="PROJECTS">
                <Button
                  variant="success"
                  size="sm"
                  leftIcon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>}
                  onClick={() => setView(view === 'tasks' ? 'createTask' : 'createProject')}
                >
                  {view === 'tasks' ? 'New Task' : 'New Project'}
                </Button>
              </CanCreate>
            </>
          }
        />

        {(view === 'createProject' || view === 'editProject') && (
          <Modal
            open
            onClose={() => { resetProjectForm(); setView('projects'); }}
            title={view === 'editProject' ? 'Edit Project' : 'Create Project'}
            width={600}
            footer={
              <>
                <Button variant="ghost" onClick={() => { resetProjectForm(); setView('projects'); }}>Cancel</Button>
                <Button variant="primary" onClick={view === 'editProject' ? handleUpdateProject : handleSaveProject}>{view === 'editProject' ? 'Update' : 'Create'}</Button>
              </>
            }
          >
            {formError && <div style={{ marginBottom: '1rem' }}><Banner tone="danger">{formError}</Banner></div>}
            <div className="form-grid">
              <TextField label="Project Name" required value={form.name} onChange={(v) => setForm({ ...form, name: v })} validator={required('Name')} forceError={projectSubmitted} />
              <NumberField label="Budget" decimal value={String(form.budget ?? '')} onChange={(v) => setForm({ ...form, budget: parseFloat(v) || 0 })} validator={amount} forceError={projectSubmitted} />
              <Select label="Manager" value={form.managerId} onChange={(v) => setForm({ ...form, managerId: v })} placeholder="Select" options={employees.map(e => ({ value: e.id, label: `${e.firstName} ${e.lastName}` }))} />
              <Select label="Status" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={PROJECT_STATUSES.map(s => ({ value: s, label: s }))} />
              <Field label="Start Date"><input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="input-field" /></Field>
              <Field label="Deadline"><input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className="input-field" /></Field>
              <div style={{ gridColumn: '1 / -1' }}>
                <Textarea label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
              </div>
            </div>
          </Modal>
        )}

        {view === 'createTask' && (
          <Modal
            open
            onClose={() => { resetTaskForm(); setView('tasks'); }}
            title="Create Task"
            width={600}
            footer={
              <>
                <Button variant="ghost" onClick={() => { resetTaskForm(); setView('tasks'); }}>Cancel</Button>
                <Button variant="primary" onClick={handleSaveTask}>Create</Button>
              </>
            }
          >
            {formError && <div style={{ marginBottom: '1rem' }}><Banner tone="danger">{formError}</Banner></div>}
            <div className="form-grid">
              <TextField label="Task Title" required value={taskForm.title} onChange={(v) => setTaskForm({ ...taskForm, title: v })} validator={required('Title')} forceError={taskSubmitted} />
              <Select label="Project" value={taskForm.projectId} onChange={(v) => setTaskForm({ ...taskForm, projectId: v })} placeholder="Select" options={projects.map(p => ({ value: p.id, label: p.name }))} />
              <Select label="Assign To" value={taskForm.assigneeId} onChange={(v) => setTaskForm({ ...taskForm, assigneeId: v })} placeholder="Select" options={employees.map(e => ({ value: e.id, label: `${e.firstName} ${e.lastName}` }))} />
              <Select label="Priority" value={taskForm.priority} onChange={(v) => setTaskForm({ ...taskForm, priority: v })} options={TASK_PRIORITIES.map(p => ({ value: p, label: p }))} />
              <NumberField label="Estimated Hours" decimal value={String(taskForm.estimatedHours ?? '')} onChange={(v) => setTaskForm({ ...taskForm, estimatedHours: parseFloat(v) || 0 })} validator={nonNegative('Hours')} forceError={taskSubmitted} />
              <Field label="Deadline"><input type="date" value={taskForm.deadline} onChange={(e) => setTaskForm({ ...taskForm, deadline: e.target.value })} className="input-field" /></Field>
            </div>
          </Modal>
        )}

        {view === 'projects' && (
          <DataTable<Project>
            columns={projectColumns}
            rows={projects}
            loading={loading}
            rowKey={(p) => p.id}
            emptyTitle="No projects found"
            emptyMessage="Create your first project to get started."
          />
        )}

        {view === 'tasks' && (
          <DataTable<Task>
            columns={taskColumns}
            rows={tasks}
            loading={loading}
            rowKey={(t) => t.id}
            emptyTitle="No tasks found"
            emptyMessage="Tasks you create will appear here."
          />
        )}

        {view === 'detail' && selectedProject && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="mb-2"
              leftIcon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>}
              onClick={() => setView('projects')}
            >
              Back to Projects
            </Button>

            <div className="card" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>{selectedProject.name}</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{selectedProject.description}</p>
                </div>
                <Badge tone={STATUS_TONE[selectedProject.status] || 'neutral'} dot>{selectedProject.status}</Badge>
              </div>

              <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                <StatCard label="Budget" value={`₹${selectedProject.budget?.toLocaleString()}`} />
                <StatCard label="Total Cost" value={<span style={{ color: 'var(--warning-fg)' }}>{`₹${selectedProject.metrics?.totalCost?.toFixed(0) || 0}`}</span>} />
                <StatCard label="Expenses" value={<span style={{ color: 'var(--danger-fg)' }}>{`₹${selectedProject.metrics?.totalExpense?.toFixed(0) || 0}`}</span>} />
                <StatCard label="Progress" value={<span style={{ color: 'var(--success-fg)' }}>{`${selectedProject.metrics?.completionPercent || 0}%`}</span>} />
              </div>

              <div style={{ display: 'flex', gap: '2rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                <div><strong style={{ color: 'var(--text-primary)' }}>Manager:</strong> {selectedProject.manager?.firstName} {selectedProject.manager?.lastName}</div>
                <div><strong style={{ color: 'var(--text-primary)' }}>Deadline:</strong> {selectedProject.deadline ? new Date(selectedProject.deadline).toLocaleDateString() : '—'}</div>
                <div><strong style={{ color: 'var(--text-primary)' }}>Resources:</strong> {selectedProject.resources?.length || 0}</div>
              </div>
            </div>

            <CanEdit module="PROJECTS">
              <div className="card" style={{ padding: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <input placeholder="Expense Description" value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} className="input-field" style={{ flex: 1 }} />
                <input type="number" placeholder="Amount" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: parseFloat(e.target.value) })} className="input-field" style={{ width: '160px' }} />
                <Button variant="primary" onClick={handleAddExpense}>Add Expense</Button>
              </div>
            </CanEdit>
          </>
        )}

        <ConfirmDialog
          open={!!deleteTarget}
          title="Deactivate project"
          message={deleteTarget ? `Deactivate project "${deleteTarget.name}"?` : ''}
          tone="danger"
          confirmLabel="Deactivate"
          onConfirm={() => deleteTarget && handleDeleteProject(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />

        <ConfirmDialog
          open={!!deleteTaskId}
          title="Delete task"
          message="Delete this task?"
          tone="danger"
          confirmLabel="Delete"
          onConfirm={() => deleteTaskId && handleDeleteTask(deleteTaskId)}
          onCancel={() => setDeleteTaskId(null)}
        />
      </main>
    </div>
  );
}
