'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { getProjects, getProjectById, createProject, updateProject, deleteProject, addProjectExpense, getTasks, createTask, updateTask, deleteTask, getEmployees } from '@/lib/api';
import { CanCreate, CanEdit, CanDelete } from '@/components/PermissionGuard';
import Sidebar from '@/components/Sidebar';

interface Project {
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

interface Task {
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

const STATUS_MAP: Record<string, { cls: string; label: string }> = {
  PLANNING: { cls: 'badge-neutral', label: 'Planning' },
  ACTIVE: { cls: 'badge-success', label: 'Active' },
  ON_HOLD: { cls: 'badge-warning', label: 'On Hold' },
  COMPLETED: { cls: 'badge-info', label: 'Completed' },
  CANCELLED: { cls: 'badge-danger', label: 'Cancelled' },
};

const PRIORITY_MAP: Record<string, string> = {
  LOW: 'badge-neutral',
  MEDIUM: 'badge-info',
  HIGH: 'badge-warning',
  URGENT: 'badge-danger',
};

const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'AWAITING_APPROVAL', 'REWORK', 'COMPLETED'];
const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const PROJECT_STATUSES = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];

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

  const handleSaveProject = async () => {
    try {
      await createProject(form);
      setForm({ name: '', description: '', startDate: '', deadline: '', budget: 0, managerId: '', status: 'PLANNING' });
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
    setView('editProject');
  };

  const handleUpdateProject = async () => {
    if (!editingProject) return;
    try {
      await updateProject(editingProject.id, form);
      setEditingProject(null);
      setForm({ name: '', description: '', startDate: '', deadline: '', budget: 0, managerId: '', status: 'PLANNING' });
      setView('projects');
      loadProjects();
      alert('Project updated');
    } catch (err) { alert('Failed to update project'); }
  };

  const handleDeleteProject = async (project: Project) => {
    if (!confirm(`Deactivate project "${project.name}"?`)) return;
    try {
      await deleteProject(project.id);
      if (selectedProject?.id === project.id) setSelectedProject(null);
      loadProjects();
      setView('projects');
      alert('Project deactivated');
    } catch (err) { alert('Failed to deactivate project'); }
  };

  const handleSaveTask = async () => {
    try {
      await createTask(taskForm);
      setTaskForm({ title: '', description: '', projectId: '', assigneeId: '', estimatedHours: 0, deadline: '', priority: 'MEDIUM' });
      setView('tasks');
      loadTasks();
      if (taskForm.projectId) loadProjectDetail(taskForm.projectId);
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
    if (!confirm('Delete this task?')) return;
    try {
      await deleteTask(taskId);
      loadTasks();
      if (selectedProject) loadProjectDetail(selectedProject.id);
    } catch (err) { alert('Failed to delete task'); }
  };

  if (authLoading || !user) return <div className="loading-container"><div className="loading-spinner" />Loading...</div>;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div className="page-header-left">
            <div className="page-header-icon" style={{ background: 'linear-gradient(135deg, #ec4899, #182B6D)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div><h1 className="page-title">Projects</h1><p className="page-subtitle">Manage projects & tasks</p></div>
          </div>
          <div className="page-header-actions">
            <div className="tab-group">
              <button className={`tab-btn ${view === 'projects' ? 'active' : ''}`} onClick={() => setView('projects')}>Projects</button>
              <button className={`tab-btn ${view === 'tasks' ? 'active' : ''}`} onClick={() => setView('tasks')}>Tasks</button>
            </div>
            <CanCreate module="PROJECTS">
              <button className="btn btn-success btn-sm" onClick={() => setView(view === 'tasks' ? 'createTask' : 'createProject')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                {view === 'tasks' ? 'New Task' : 'New Project'}
              </button>
            </CanCreate>
          </div>
        </div>

        {(view === 'createProject' || view === 'editProject') && (
          <div className="glass-card" style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem' }}>{view === 'editProject' ? 'Edit Project' : 'Create Project'}</h2>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Project Name *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" /></div>
              <div className="form-group"><label className="form-label">Budget</label><input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: parseFloat(e.target.value) })} className="input-field" /></div>
              <div className="form-group"><label className="form-label">Manager</label><select value={form.managerId} onChange={(e) => setForm({ ...form, managerId: e.target.value })} className="select-field"><option value="">Select</option>{employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Status</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="select-field">{PROJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Start Date</label><input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="input-field" /></div>
              <div className="form-group"><label className="form-label">Deadline</label><input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className="input-field" /></div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}><label className="form-label">Description</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field" rows={3} /></div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button onClick={view === 'editProject' ? handleUpdateProject : handleSaveProject} className="btn btn-primary">{view === 'editProject' ? 'Update' : 'Create'}</button>
              <button onClick={() => { setEditingProject(null); setForm({ name: '', description: '', startDate: '', deadline: '', budget: 0, managerId: '', status: 'PLANNING' }); setView('projects'); }} className="btn btn-ghost">Cancel</button>
            </div>
          </div>
        )}

        {view === 'createTask' && (
          <div className="glass-card" style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem' }}>Create Task</h2>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Task Title *</label><input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} className="input-field" /></div>
              <div className="form-group"><label className="form-label">Project</label><select value={taskForm.projectId} onChange={(e) => setTaskForm({ ...taskForm, projectId: e.target.value })} className="select-field"><option value="">Select</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Assign To</label><select value={taskForm.assigneeId} onChange={(e) => setTaskForm({ ...taskForm, assigneeId: e.target.value })} className="select-field"><option value="">Select</option>{employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Priority</label><select value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })} className="select-field">{TASK_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Estimated Hours</label><input type="number" value={taskForm.estimatedHours} onChange={(e) => setTaskForm({ ...taskForm, estimatedHours: parseFloat(e.target.value) })} className="input-field" /></div>
              <div className="form-group"><label className="form-label">Deadline</label><input type="date" value={taskForm.deadline} onChange={(e) => setTaskForm({ ...taskForm, deadline: e.target.value })} className="input-field" /></div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button onClick={handleSaveTask} className="btn btn-primary">Create</button>
              <button onClick={() => setView('tasks')} className="btn btn-ghost">Cancel</button>
            </div>
          </div>
        )}

        {view === 'projects' && (
          <div className="glass-card" style={{ overflow: 'hidden' }}>
            <table className="data-table">
              <thead><tr><th>Project</th><th>Manager</th><th>Deadline</th><th style={{ textAlign: 'right' }}>Budget</th><th style={{ textAlign: 'center' }}>Progress</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={7} className="loading-container"><div className="loading-spinner" />Loading...</td></tr> :
                  projects.map((p) => (
                    <tr key={p.id}>
                      <td><button onClick={() => loadProjectDetail(p.id)} style={{ fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-blue)', fontFamily: 'inherit', fontSize: 'inherit', padding: 0 }}>{p.name}</button></td>
                      <td>{p.manager?.firstName} {p.manager?.lastName}</td>
                      <td>{p.deadline ? new Date(p.deadline).toLocaleDateString() : '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{p.budget?.toLocaleString()}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                          <div style={{ width: '60px', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${p.metrics?.completionPercent || 0}%`, height: '100%', background: 'var(--gradient-primary)', borderRadius: '3px', transition: 'width 0.5s ease' }} />
                          </div>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-blue)' }}>{p.metrics?.completionPercent || 0}%</span>
                        </div>
                      </td>
                      <td><span className={`badge ${STATUS_MAP[p.status]?.cls || 'badge-neutral'}`}>{p.status}</span></td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                          <CanEdit module="PROJECTS">
                            <button onClick={() => beginEditProject(p)} className="btn btn-ghost btn-sm">Edit</button>
                          </CanEdit>
                          <CanDelete module="PROJECTS">
                            <button onClick={() => handleDeleteProject(p)} className="btn btn-danger btn-sm">Deactivate</button>
                          </CanDelete>
                        </div>
                      </td>
                    </tr>
                  ))}
                {projects.length === 0 && !loading && <tr><td colSpan={7} className="empty-state">No projects found</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {view === 'tasks' && (
          <div className="glass-card" style={{ overflow: 'hidden' }}>
            <table className="data-table">
              <thead><tr><th>Task</th><th>Project</th><th>Assigned To</th><th style={{ textAlign: 'center' }}>Priority</th><th>Status</th><th style={{ textAlign: 'center' }}>Hours</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={7} className="loading-container"><div className="loading-spinner" />Loading...</td></tr> :
                  tasks.map((t) => (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.title}</td>
                      <td>{t.project?.name || '—'}</td>
                      <td>{t.assignee?.firstName} {t.assignee?.lastName}</td>
                      <td style={{ textAlign: 'center' }}><span className={`badge ${PRIORITY_MAP[t.priority] || 'badge-neutral'}`}>{t.priority}</span></td>
                      <td>
                        <CanEdit module="PROJECTS" fallback={<span className={`badge ${STATUS_MAP[t.status]?.cls || 'badge-neutral'}`}>{t.status.replace('_', ' ')}</span>}>
                          <select value={t.status} onChange={(e) => handleTaskStatusChange(t.id, e.target.value)} className="select-field" style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', width: 'auto' }}>
                            {TASK_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                          </select>
                        </CanEdit>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}><span style={{ color: 'var(--success)' }}>{t.actualHours || 0}</span>/{t.estimatedHours || 0}h</td>
                      <td style={{ textAlign: 'right' }}>
                        <CanDelete module="PROJECTS">
                          <button onClick={() => handleDeleteTask(t.id)} className="btn btn-danger btn-sm">Delete</button>
                        </CanDelete>
                      </td>
                    </tr>
                  ))}
                {tasks.length === 0 && !loading && <tr><td colSpan={7} className="empty-state">No tasks found</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {view === 'detail' && selectedProject && (
          <>
            <button onClick={() => setView('projects')} className="btn btn-ghost btn-sm mb-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
              Back to Projects
            </button>

            <div className="glass-card" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.25rem' }}>{selectedProject.name}</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{selectedProject.description}</p>
                </div>
                <span className={`badge ${STATUS_MAP[selectedProject.status]?.cls || 'badge-neutral'}`}>{selectedProject.status}</span>
              </div>

              <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                <div className="stat-card"><div className="stat-card-value">₹{selectedProject.budget?.toLocaleString()}</div><div className="stat-card-label">Budget</div></div>
                <div className="stat-card"><div className="stat-card-value text-warning">₹{selectedProject.metrics?.totalCost?.toFixed(0) || 0}</div><div className="stat-card-label">Total Cost</div></div>
                <div className="stat-card"><div className="stat-card-value text-danger">₹{selectedProject.metrics?.totalExpense?.toFixed(0) || 0}</div><div className="stat-card-label">Expenses</div></div>
                <div className="stat-card"><div className="stat-card-value text-success">{selectedProject.metrics?.completionPercent || 0}%</div><div className="stat-card-label">Progress</div></div>
              </div>

              <div style={{ display: 'flex', gap: '2rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                <div><strong style={{ color: 'var(--text-primary)' }}>Manager:</strong> {selectedProject.manager?.firstName} {selectedProject.manager?.lastName}</div>
                <div><strong style={{ color: 'var(--text-primary)' }}>Deadline:</strong> {selectedProject.deadline ? new Date(selectedProject.deadline).toLocaleDateString() : '—'}</div>
                <div><strong style={{ color: 'var(--text-primary)' }}>Resources:</strong> {selectedProject.resources?.length || 0}</div>
              </div>
            </div>

            <CanEdit module="PROJECTS">
              <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <input placeholder="Expense Description" value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} className="input-field" style={{ flex: 1 }} />
                <input type="number" placeholder="Amount" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: parseFloat(e.target.value) })} className="input-field" style={{ width: '160px' }} />
                <button onClick={handleAddExpense} className="btn btn-primary">Add Expense</button>
              </div>
            </CanEdit>
          </>
        )}
      </main>
    </div>
  );
}
