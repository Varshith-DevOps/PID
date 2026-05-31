'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import {
  getEmployees,
  getChecklistTemplates,
  createChecklistTemplate,
  updateChecklistTemplate,
  deleteChecklistTemplate,
  getEmployeeChecklistTasks,
  instantiateEmployeeChecklist,
  updateEmployeeChecklistTask,
  createCustomChecklistTask,
  createEmployee,
  updateEmployeeAccountStage,
  getDepartments,
  completeOnboarding as apiCompleteOnboarding,
  completeOffboarding as apiCompleteOffboarding,
} from '@/lib/api';
import Sidebar from '@/components/Sidebar';

interface ChecklistTemplateTask {
  id?: string;
  title: string;
  description?: string;
  order: number;
}

interface ChecklistTemplate {
  id: string;
  name: string;
  type: 'ONBOARDING' | 'OFFBOARDING';
  description?: string;
  tasks: ChecklistTemplateTask[];
}

interface EmployeeChecklistTask {
  id: string;
  employeeId: string;
  type: 'ONBOARDING' | 'OFFBOARDING';
  title: string;
  description?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
  dueDate?: string;
  completedAt?: string;
  remarks?: string;
}

export default function OnOffboardingDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [employees, setEmployees] = useState<any[]>([]);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Tabs & Filters
  const [activeTab, setActiveTab] = useState<'onboarding' | 'offboarding' | 'templates'>('onboarding');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterLocation, setFilterLocation] = useState('');

  // Selected Employee Detail Modal
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [employeeTasks, setEmployeeTasks] = useState<EmployeeChecklistTask[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  
  // Custom Ad-hoc Task Form State
  const [customTaskForm, setCustomTaskForm] = useState({
    title: '',
    description: '',
    dueDate: '',
  });

  // Checklist Template Builder Form State
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    type: 'ONBOARDING',
    description: '',
    tasks: [] as { title: string; description: string }[],
  });
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');

  // Start Onboarding / Offboarding States
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [onboardingForm, setOnboardingForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    gender: 'MALE',
    location: 'Pune Office',
    jobTitle: '',
    departmentId: '',
    joinDate: new Date().toISOString().split('T')[0],
    salary: '45000',
  });

  const [showOffboardingModal, setShowOffboardingModal] = useState(false);
  const [selectedOffboardEmployeeId, setSelectedOffboardEmployeeId] = useState('');
  const [departmentsList, setDepartmentsList] = useState<any[]>([]);
  const [showTerminatedHistory, setShowTerminatedHistory] = useState(false);
  const [showOnboardingHistory, setShowOnboardingHistory] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [empData, templatesData, deptsData] = await Promise.all([
        getEmployees(),
        getChecklistTemplates(),
        getDepartments(),
      ]);
      setEmployees(empData.employees || []);
      setTemplates(templatesData);
      setDepartmentsList(deptsData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEmployeeDetails = async (emp: any) => {
    setSelectedEmployee(emp);
    setSelectedTemplateId('');
    try {
      const tasks = await getEmployeeChecklistTasks(emp.id);
      setEmployeeTasks(tasks);
    } catch (err) {
      console.error(err);
    }
  };

  const handleInstantiate = async () => {
    if (!selectedEmployee || !selectedTemplateId) return;
    try {
      await instantiateEmployeeChecklist(selectedEmployee.id, selectedTemplateId);
      const tasks = await getEmployeeChecklistTasks(selectedEmployee.id);
      setEmployeeTasks(tasks);
      loadData(); // Reload progress info on cards
    } catch (err) {
      console.error(err);
      alert('Failed to assign checklist template.');
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, status: any) => {
    try {
      await updateEmployeeChecklistTask(taskId, { status });
      // Update local task array
      setEmployeeTasks(prev =>
        prev.map(t => (t.id === taskId ? { ...t, status, completedAt: status === 'COMPLETED' ? new Date().toISOString() : undefined } : t))
      );
      loadData(); // Update card percentages
    } catch (err) {
      console.error(err);
      alert('Failed to update task status.');
    }
  };

  const handleUpdateTaskRemarks = async (taskId: string, remarks: string) => {
    try {
      await updateEmployeeChecklistTask(taskId, { remarks });
      setEmployeeTasks(prev =>
        prev.map(t => (t.id === taskId ? { ...t, remarks } : t))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddCustomTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee || !customTaskForm.title) return;
    try {
      const newTask = await createCustomChecklistTask({
        employeeId: selectedEmployee.id,
        type: activeTab === 'onboarding' ? 'ONBOARDING' : 'OFFBOARDING',
        title: customTaskForm.title,
        description: customTaskForm.description,
        dueDate: customTaskForm.dueDate || undefined,
      });
      setEmployeeTasks(prev => [...prev, newTask]);
      setCustomTaskForm({ title: '', description: '', dueDate: '' });
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to create custom task');
    }
  };

  const handleAddTemplateTaskInput = () => {
    if (!newTaskTitle) return;
    setTemplateForm(prev => ({
      ...prev,
      tasks: [...prev.tasks, { title: newTaskTitle, description: newTaskDesc }],
    }));
    setNewTaskTitle('');
    setNewTaskDesc('');
  };

  const handleRemoveTemplateTaskInput = (idx: number) => {
    setTemplateForm(prev => ({
      ...prev,
      tasks: prev.tasks.filter((_, i) => i !== idx),
    }));
  };

  const handleCreateTemplateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const templateData = {
        name: templateForm.name,
        type: templateForm.type,
        description: templateForm.description,
        tasks: templateForm.tasks.map((t, idx) => ({ ...t, order: idx + 1 })),
      };

      if (editingTemplateId) {
        await updateChecklistTemplate(editingTemplateId, templateData);
      } else {
        await createChecklistTemplate(templateData);
      }

      setShowTemplateModal(false);
      setEditingTemplateId(null);
      setTemplateForm({ name: '', type: 'ONBOARDING', description: '', tasks: [] });
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to save checklist template.');
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      await deleteChecklistTemplate(id);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to delete template.');
    }
  };

  const handleEditTemplate = (tpl: ChecklistTemplate) => {
    setEditingTemplateId(tpl.id);
    setTemplateForm({
      name: tpl.name,
      type: tpl.type,
      description: tpl.description || '',
      tasks: tpl.tasks.map(t => ({ title: t.title, description: t.description || '' })),
    });
    setShowTemplateModal(true);
  };

  const handleStartOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createEmployee({
        ...onboardingForm,
        salary: parseFloat(onboardingForm.salary),
        accountStage: 'ONBOARDING',
      });
      setShowOnboardingModal(false);
      setOnboardingForm({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        gender: 'MALE',
        location: 'Pune Office',
        jobTitle: '',
        departmentId: departmentsList[0]?.id || '',
        joinDate: new Date().toISOString().split('T')[0],
        salary: '45000',
      });
      loadData();
      alert('New Joiner registered! Onboarding process initiated successfully.');
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to start onboarding for new joiner.');
    }
  };

  const handleInitiateOffboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOffboardEmployeeId) return;
    try {
      await updateEmployeeAccountStage(selectedOffboardEmployeeId, 'OFFBOARDING');
      setShowOffboardingModal(false);
      setSelectedOffboardEmployeeId('');
      loadData();
      alert('Offboarding process initiated successfully.');
    } catch (err) {
      console.error(err);
      alert('Failed to initiate offboarding.');
    }
  };

  const handleCompleteOnboarding = async (employeeId: string) => {
    try {
      const result = await apiCompleteOnboarding(employeeId, false);
      setSelectedEmployee(null);
      loadData();
      alert(result.message || 'Onboarding completed! Employee is now fully active.');
    } catch (err: any) {
      const errorData = err.response?.data;
      if (errorData?.progress?.pending > 0) {
        const proceed = confirm(
          `${errorData.error}\n\nDo you want to force-complete the onboarding anyway?`
        );
        if (proceed) {
          try {
            const result = await apiCompleteOnboarding(employeeId, true);
            setSelectedEmployee(null);
            loadData();
            alert(result.message || 'Onboarding force-completed!');
          } catch (forceErr) {
            console.error(forceErr);
            alert('Failed to force-complete onboarding.');
          }
        }
      } else {
        console.error(err);
        alert(errorData?.error || 'Failed to complete onboarding.');
      }
    }
  };

  const handleCompleteOffboarding = async (employeeId: string) => {
    try {
      const result = await apiCompleteOffboarding(employeeId, false);
      setSelectedEmployee(null);
      loadData();
      alert(result.message || 'Clearances complete! Employee has been separated.');
    } catch (err: any) {
      const errorData = err.response?.data;
      if (errorData?.progress?.pending > 0) {
        const proceed = confirm(
          `${errorData.error}\n\nDo you want to force-complete the offboarding anyway?`
        );
        if (proceed) {
          try {
            const result = await apiCompleteOffboarding(employeeId, true);
            setSelectedEmployee(null);
            loadData();
            alert(result.message || 'Offboarding force-completed!');
          } catch (forceErr) {
            console.error(forceErr);
            alert('Failed to force-complete offboarding.');
          }
        }
      } else {
        console.error(err);
        alert(errorData?.error || 'Failed to complete offboarding.');
      }
    }
  };

  if (authLoading || !user) {
    return <div className="loading-container"><div className="loading-spinner" />Loading...</div>;
  }

  // Calculate task completions helper
  const getTaskProgress = (empId: string, type: 'ONBOARDING' | 'OFFBOARDING') => {
    return { completed: 0, total: 0, percent: 0 };
  };

  const filteredEmployees = employees.filter(emp => {
    if (activeTab === 'onboarding') {
      if (showOnboardingHistory) {
        if (emp.accountStage !== 'EMPLOYEE' && emp.accountStage !== 'MANAGER' && emp.accountStage !== 'ADMIN') return false;
      } else {
        if (emp.accountStage !== 'ONBOARDING') return false;
      }
    } else if (activeTab === 'offboarding') {
      if (showTerminatedHistory) {
        if (emp.accountStage !== 'TERMINATED') return false;
      } else {
        if (emp.accountStage !== 'OFFBOARDING') return false;
      }
    }

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      const nameMatch = `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(s);
      const roleMatch = emp.jobTitle?.toLowerCase().includes(s);
      const idMatch = emp.employeeId?.toLowerCase().includes(s);
      if (!nameMatch && !roleMatch && !idMatch) return false;
    }
    if (filterDepartment && emp.department?.name !== filterDepartment) {
      return false;
    }
    if (filterLocation && emp.location !== filterLocation) {
      return false;
    }
    return true;
  });

  return (
    <div className="app-layout">
      <Sidebar activePath="/checklists" />
      <main className="main-content">
        
        {/* Header */}
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="page-header-left">
            <div className="page-header-icon" style={{ background: 'linear-gradient(135deg, #a855f7, #c084fc)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))' }}>
                <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
            </div>
            <div>
              <h1 className="page-title">Onboarding & Offboarding Board</h1>
              <p className="page-subtitle">Track new hire integration pathways and exit clearance clearances seamlessly</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {activeTab === 'onboarding' && (
              <button 
                onClick={() => {
                  if (departmentsList.length > 0) {
                    setOnboardingForm(prev => ({ ...prev, departmentId: departmentsList[0].id }));
                  }
                  setShowOnboardingModal(true);
                }} 
                className="btn btn-primary" 
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', cursor: 'pointer', fontWeight: 600 }}
              >
                🚀 Start Onboarding
              </button>
            )}
            {activeTab === 'offboarding' && (
              <button 
                onClick={() => {
                  setSelectedOffboardEmployeeId('');
                  setShowOffboardingModal(true);
                }} 
                className="btn btn-primary" 
                style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', border: 'none', cursor: 'pointer', fontWeight: 600 }}
              >
                🚪 Initiate Offboarding
              </button>
            )}
            <button onClick={() => { setEditingTemplateId(null); setTemplateForm({ name: '', type: 'ONBOARDING', description: '', tasks: [] }); setShowTemplateModal(true); }} className="btn btn-secondary" style={{ border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>
              Build Custom Template
            </button>
          </div>
        </div>

        {/* Tab Selectors */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
          <button 
            onClick={() => setActiveTab('onboarding')} 
            className="btn" 
            style={{ 
              background: activeTab === 'onboarding' ? 'linear-gradient(135deg, #a855f7, #c084fc)' : 'rgba(255,255,255,0.04)',
              color: 'white',
              border: 'none',
              padding: '0.6rem 1.25rem',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: activeTab === 'onboarding' ? '0 4px 15px rgba(168,85,247,0.3)' : 'none'
            }}
          >
            🚀 Onboarding Path
          </button>
          
          <button 
            onClick={() => setActiveTab('offboarding')} 
            className="btn" 
            style={{ 
              background: activeTab === 'offboarding' ? 'linear-gradient(135deg, #a855f7, #c084fc)' : 'rgba(255,255,255,0.04)',
              color: 'white',
              border: 'none',
              padding: '0.6rem 1.25rem',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: activeTab === 'offboarding' ? '0 4px 15px rgba(168,85,247,0.3)' : 'none'
            }}
          >
            🚪 Offboarding Clearances
          </button>

          <button 
            onClick={() => setActiveTab('templates')} 
            className="btn" 
            style={{ 
              background: activeTab === 'templates' ? 'linear-gradient(135deg, #a855f7, #c084fc)' : 'rgba(255,255,255,0.04)',
              color: 'white',
              border: 'none',
              padding: '0.6rem 1.25rem',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: activeTab === 'templates' ? '0 4px 15px rgba(168,85,247,0.3)' : 'none'
            }}
          >
            📋 Reusable Templates
          </button>
        </div>

        {/* LOADING STATE */}
        {loading ? (
          <div className="loading-container"><div className="loading-spinner" />Loading boards...</div>
        ) : (
          <>
            {/* Search and Filters Bar */}
            {(activeTab === 'onboarding' || activeTab === 'offboarding') && (
              <div className="glass-card" style={{ padding: '0.85rem 1.25rem', marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <input 
                    type="text" 
                    placeholder="🔍 Search employee by name, ID or job role..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="input-field"
                    style={{ fontSize: '0.78rem', padding: '0.45rem 0.85rem' }}
                  />
                </div>

                <div style={{ minWidth: '160px' }}>
                  <select 
                    value={filterDepartment} 
                    onChange={e => setFilterDepartment(e.target.value)} 
                    className="select-field"
                    style={{ fontSize: '0.78rem', padding: '0.45rem' }}
                  >
                    <option value="">All Departments</option>
                    {Array.from(new Set(employees.map(e => e.department?.name).filter(Boolean))).map((d: any) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div style={{ minWidth: '160px' }}>
                  <select 
                    value={filterLocation} 
                    onChange={e => setFilterLocation(e.target.value)} 
                    className="select-field"
                    style={{ fontSize: '0.78rem', padding: '0.45rem' }}
                  >
                    <option value="">All Locations</option>
                    {Array.from(new Set(employees.map(e => e.location).filter(Boolean))).map((l: any) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>

                {(searchTerm || filterDepartment || filterLocation) && (
                  <button 
                    onClick={() => { setSearchTerm(''); setFilterDepartment(''); setFilterLocation(''); }}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}
                  >
                    Clear Filters
                  </button>
                )}

                {activeTab === 'onboarding' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: 'auto' }}>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', userSelect: 'none' }}>
                      <input 
                        type="checkbox" 
                        checked={showOnboardingHistory} 
                        onChange={e => setShowOnboardingHistory(e.target.checked)} 
                        style={{ width: '14px', height: '14px', accentColor: '#a855f7', cursor: 'pointer' }}
                      />
                      Show Onboarding History 📜
                    </label>
                  </div>
                )}

                {activeTab === 'offboarding' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: 'auto' }}>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', userSelect: 'none' }}>
                      <input 
                        type="checkbox" 
                        checked={showTerminatedHistory} 
                        onChange={e => setShowTerminatedHistory(e.target.checked)} 
                        style={{ width: '14px', height: '14px', accentColor: '#a855f7', cursor: 'pointer' }}
                      />
                      Show Exit History (Left Employees) 📜
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* ──── TAB 1 & 2: ONBOARDING / OFFBOARDING TABLE LIST VIEW ──── */}
            {(activeTab === 'onboarding' || activeTab === 'offboarding') && (
              <div className="glass-card" style={{ padding: '0.5rem', border: '1px solid rgba(255,255,255,0.05)', overflowX: 'auto', borderRadius: '12px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '750px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Employee</th>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Job Profile</th>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Location</th>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>{activeTab === 'onboarding' ? 'Join Date' : 'Clearance Review'}</th>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Status State</th>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                          No employees matching the search filters.
                        </td>
                      </tr>
                    ) : (
                      filteredEmployees.map(emp => (
                        <tr 
                          key={emp.id} 
                          style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', fontSize: '0.78rem', transition: 'background 0.2s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.01)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div style={{ 
                                width: '32px', 
                                height: '32px', 
                                borderRadius: '50%', 
                                background: 'linear-gradient(135deg, #a855f7, #c084fc)', 
                                color: 'white', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                fontWeight: 'bold',
                                fontSize: '0.78rem'
                              }}>
                                {emp.firstName?.charAt(0)?.toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, color: 'white' }}>{emp.firstName} {emp.lastName}</div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>ID: {emp.employeeId}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <div style={{ fontWeight: 600, color: 'white' }}>{emp.jobTitle}</div>
                            <div style={{ fontSize: '0.65rem', color: '#c084fc' }}>{emp.department?.name || 'Staff'}</div>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                            {emp.location || 'Pune Office'}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                            {activeTab === 'onboarding' ? new Date(emp.joinDate).toLocaleDateString('en-IN') : 'Clearance Process'}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            {(() => {
                              const stage = emp.accountStage;
                              const stageConfig: Record<string, { label: string; bg: string; color: string; border: string }> = {
                                ONBOARDING: { label: '🚀 Onboarding In Progress', bg: 'rgba(16,185,129,0.06)', color: '#10b981', border: '1px solid rgba(16,185,129,0.15)' },
                                OFFBOARDING: { label: '🚪 Clearance In Progress', bg: 'rgba(239,68,68,0.06)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)' },
                                EMPLOYEE: { label: '✅ Onboarded', bg: 'rgba(16,185,129,0.06)', color: '#10b981', border: '1px solid rgba(16,185,129,0.15)' },
                                TERMINATED: { label: '📜 Separated', bg: 'rgba(107,114,128,0.06)', color: '#9ca3af', border: '1px solid rgba(107,114,128,0.15)' },
                              };
                              const cfg = stageConfig[stage] || { label: stage, bg: 'rgba(168,85,247,0.06)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.12)' };
                              return (
                                <span className="badge" style={{ background: cfg.bg, color: cfg.color, border: cfg.border, fontSize: '0.62rem' }}>
                                  {cfg.label}
                                </span>
                              );
                            })()}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                            <button 
                              onClick={() => handleOpenEmployeeDetails(emp)}
                              className="btn btn-primary"
                              style={{ 
                                padding: '0.35rem 0.65rem', 
                                fontSize: '0.68rem', 
                                background: 'linear-gradient(135deg, #a855f7, #c084fc)', 
                                border: 'none',
                                cursor: 'pointer',
                                borderRadius: '6px'
                              }}
                            >
                              Manage Checklist
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* ──── TAB 3: TEMPLATES MANAGEMENT ──── */}
            {activeTab === 'templates' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                {templates.length === 0 ? (
                  <div className="empty-state" style={{ gridColumn: '1 / -1' }}>No templates created yet. Create one to begin task automations.</div>
                ) : (
                  templates.map(tpl => (
                    <div key={tpl.id} className="glass-card" style={{ padding: '1.5rem', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="badge" style={{ 
                          background: tpl.type === 'ONBOARDING' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', 
                          color: tpl.type === 'ONBOARDING' ? '#10b981' : '#f87171',
                          border: tpl.type === 'ONBOARDING' ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(239,68,68,0.2)',
                          fontSize: '0.62rem'
                        }}>
                          {tpl.type}
                        </span>

                        <div style={{ display: 'flex', gap: '0.6rem' }}>
                          <button 
                            onClick={() => handleEditTemplate(tpl)}
                            style={{ background: 'transparent', border: 'none', color: '#c084fc', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                          >
                            Edit ✏️
                          </button>
                          <button 
                            onClick={() => handleDeleteTemplate(tpl.id)}
                            style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem' }}
                          >
                            Delete 🗑
                          </button>
                        </div>
                      </div>

                      <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'white' }}>{tpl.name}</h3>
                      {tpl.description && <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0 }}>{tpl.description}</p>}

                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                        <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'white', marginBottom: '0.5rem' }}>
                          Preconfigured Tasks ({tpl.tasks.length})
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          {tpl.tasks.map((t, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                              <span style={{ fontSize: '0.7rem', color: '#c084fc', fontWeight: 'bold' }}>{idx + 1}.</span>
                              <div>
                                <div style={{ fontSize: '0.72rem', color: 'white', fontWeight: 600 }}>{t.title}</div>
                                {t.description && <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{t.description}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}

        {/* ──── DETAIL POPUP MODAL: EMPLOYEE CHECKLIST WORKFLOW ──── */}
        {selectedEmployee && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '780px', padding: '2rem', display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '2rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              
              {/* Left Column: Tasks Progress and Checklist list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto', maxHeight: '520px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'white' }}>
                      {selectedEmployee.firstName} {selectedEmployee.lastName}
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Manage {activeTab === 'onboarding' ? 'Onboarding tasks' : 'Offboarding clearance'} progress path
                    </p>
                  </div>
                </div>

                {/* Templates Provision Dropdown (If no tasks assigned) */}
                {employeeTasks.length === 0 ? (
                  <div style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'white' }}>No Active Tasks Assigned</h4>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Instantiate a predefined reusable checklist template or add custom ad-hoc tasks.</p>
                    
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <select 
                        value={selectedTemplateId} 
                        onChange={e => setSelectedTemplateId(e.target.value)} 
                        className="select-field" 
                        style={{ fontSize: '0.75rem', padding: '0.4rem' }}
                      >
                        <option value="">Choose Template...</option>
                        {templates
                          .filter(t => t.type === (activeTab === 'onboarding' ? 'ONBOARDING' : 'OFFBOARDING'))
                          .map(t => <option key={t.id} value={t.id}>{t.name}</option>)
                        }
                      </select>
                      <button 
                        onClick={handleInstantiate} 
                        disabled={!selectedTemplateId}
                        className="btn btn-primary" 
                        style={{ background: 'linear-gradient(135deg, #a855f7, #c084fc)', border: 'none', padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
                      >
                        Initialize
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {employeeTasks.map((task) => (
                      <div 
                        key={task.id} 
                        className="glass-card" 
                        style={{ 
                          padding: '1rem', 
                          background: task.status === 'COMPLETED' ? 'rgba(16,185,129,0.02)' : 'rgba(255,255,255,0.01)', 
                          border: task.status === 'COMPLETED' ? '1px solid rgba(16,185,129,0.15)' : '1px solid rgba(255,255,255,0.05)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5rem'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ 
                              fontWeight: 700, 
                              color: 'white', 
                              fontSize: '0.82rem',
                              textDecoration: task.status === 'COMPLETED' ? 'line-through' : 'none'
                            }}>
                              {task.title}
                            </div>
                            {task.description && <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', margin: 0 }}>{task.description}</p>}
                          </div>

                          <select 
                            value={task.status} 
                            onChange={e => handleUpdateTaskStatus(task.id, e.target.value)}
                            style={{
                              fontSize: '0.68rem',
                              padding: '0.2rem',
                              borderRadius: '4px',
                              border: '1px solid rgba(255,255,255,0.1)',
                              background: task.status === 'COMPLETED' ? '#10b981' : 'transparent',
                              color: 'white',
                              cursor: 'pointer'
                            }}
                          >
                            <option value="PENDING" style={{ background: '#11131c' }}>Pending</option>
                            <option value="IN_PROGRESS" style={{ background: '#11131c' }}>In Progress</option>
                            <option value="COMPLETED" style={{ background: '#11131c' }}>Completed</option>
                            <option value="SKIPPED" style={{ background: '#11131c' }}>Skipped</option>
                          </select>
                        </div>

                        {/* Remarks Form details */}
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem' }}>
                          <input 
                            type="text" 
                            placeholder="Add remarks or task update..." 
                            value={task.remarks || ''}
                            onChange={e => handleUpdateTaskRemarks(task.id, e.target.value)}
                            style={{ 
                              flex: 1, 
                              fontSize: '0.65rem', 
                              background: 'rgba(0,0,0,0.15)', 
                              border: '1px solid rgba(255,255,255,0.05)', 
                              borderRadius: '4px', 
                              padding: '0.25rem 0.5rem',
                              color: 'white'
                            }} 
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column: Custom task builder + employee summary details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', borderLeft: '1px solid rgba(255,255,255,0.05)', paddingLeft: '2rem' }}>
                <div>
                  <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'white', marginBottom: '0.5rem' }}>Summary Details</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    <div><strong>Job Title:</strong> {selectedEmployee.jobTitle}</div>
                    <div><strong>Department:</strong> {selectedEmployee.department?.name || 'Staff'}</div>
                    <div><strong>Employment:</strong> {selectedEmployee.employmentType}</div>
                    <div><strong>Join Date:</strong> {new Date(selectedEmployee.joinDate).toLocaleDateString('en-IN')}</div>
                  </div>
                </div>

                {/* Ad-hoc Custom Task Creator */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.25rem' }}>
                  <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'white', marginBottom: '0.75rem' }}>
                    Add Custom Task
                  </h4>
                  <form onSubmit={handleAddCustomTask} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Task Title</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="e.g. Provide locker keys"
                        value={customTaskForm.title}
                        onChange={e => setCustomTaskForm({ ...customTaskForm, title: e.target.value })}
                        className="input-field" 
                        style={{ fontSize: '0.72rem', padding: '0.4rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Description</label>
                      <input 
                        type="text" 
                        placeholder="Additional details..."
                        value={customTaskForm.description}
                        onChange={e => setCustomTaskForm({ ...customTaskForm, description: e.target.value })}
                        className="input-field" 
                        style={{ fontSize: '0.72rem', padding: '0.4rem' }}
                      />
                    </div>

                    <button 
                      type="submit" 
                      className="btn btn-secondary" 
                      style={{ border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.72rem', padding: '0.4rem', cursor: 'pointer' }}
                    >
                      + Add Task
                    </button>
                  </form>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: 'auto', flexWrap: 'wrap' }}>
                  {selectedEmployee.accountStage === 'ONBOARDING' && (
                    <button 
                      onClick={() => handleCompleteOnboarding(selectedEmployee.id)}
                      className="btn btn-primary"
                      style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', padding: '0.5rem 0.85rem', fontSize: '0.74rem', fontWeight: 600 }}
                    >
                      Complete Onboarding & Activate Staff ✓
                    </button>
                  )}
                  {selectedEmployee.accountStage === 'OFFBOARDING' && (
                    <button 
                      onClick={() => handleCompleteOffboarding(selectedEmployee.id)}
                      className="btn btn-primary"
                      style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', border: 'none', padding: '0.5rem 0.85rem', fontSize: '0.74rem', fontWeight: 600 }}
                    >
                      Complete Clearances & Separated 🚪
                    </button>
                  )}
                  <button onClick={() => setSelectedEmployee(null)} className="btn btn-secondary" style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '0.5rem 1rem', fontSize: '0.78rem' }}>
                    Done
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ──── TEMPLATE BUILDER MODAL ──── */}
        {showTemplateModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '520px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>{editingTemplateId ? 'Edit Checklist Template' : 'Create Checklist Template'}</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{editingTemplateId ? 'Update template configurations and preconfigured task list' : 'Define reusable task sequences for onboarding or clearance processes'}</p>
              </div>

              <form onSubmit={handleCreateTemplateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Template Name</label>
                  <input type="text" placeholder="e.g. Remote Dev Onboarding" required value={templateForm.name} onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })} className="input-field" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Checklist Type</label>
                    <select value={templateForm.type} onChange={e => setTemplateForm({ ...templateForm, type: e.target.value })} className="select-field">
                      <option value="ONBOARDING">Onboarding Path</option>
                      <option value="OFFBOARDING">Offboarding Clearance</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Description</label>
                    <input type="text" placeholder="Brief outline..." value={templateForm.description} onChange={e => setTemplateForm({ ...templateForm, description: e.target.value })} className="input-field" />
                  </div>
                </div>

                {/* Preconfigured checklist items input builder */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem' }}>
                  <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'white', marginBottom: '0.5rem' }}>Preconfigured Task List</h4>
                  
                  {/* Array values */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.75rem', maxHeight: '120px', overflowY: 'auto' }}>
                    {templateForm.tasks.length === 0 ? (
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No tasks added to list yet.</span>
                    ) : (
                      templateForm.tasks.map((task, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.15)', padding: '0.3rem 0.5rem', borderRadius: '4px' }}>
                          <span style={{ fontSize: '0.7rem', color: 'white' }}>{idx + 1}. <strong>{task.title}</strong></span>
                          <button type="button" onClick={() => handleRemoveTemplateTaskInput(idx)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.7rem' }}>✕</button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Micro inputs for task list addition */}
                  <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.02)', padding: '0.5rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ flex: 1 }}>
                      <input type="text" placeholder="Task title..." value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} className="input-field" style={{ fontSize: '0.7rem', padding: '0.35rem' }} />
                    </div>
                    <div style={{ flex: 1.2 }}>
                      <input type="text" placeholder="Short description..." value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)} className="input-field" style={{ fontSize: '0.7rem', padding: '0.35rem' }} />
                    </div>
                    <button type="button" onClick={handleAddTemplateTaskInput} className="btn btn-secondary" style={{ padding: '0.35rem 0.6rem', fontSize: '0.7rem', border: '1px solid rgba(255,255,255,0.1)' }}>+ Add</button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button type="button" onClick={() => setShowTemplateModal(false)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" disabled={templateForm.tasks.length === 0 || !templateForm.name} className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #a855f7, #c084fc)', border: 'none' }}>
                    Save Template
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ──── START ONBOARDING MODAL ──── */}
        {showOnboardingModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '580px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>🚀 Start Onboarding</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Enter details below. This will create their record and initialize onboarding stages.</p>
              </div>

              <form onSubmit={handleStartOnboardingSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>First Name</label>
                    <input type="text" placeholder="John" required value={onboardingForm.firstName} onChange={e => setOnboardingForm({ ...onboardingForm, firstName: e.target.value })} className="input-field" />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Last Name</label>
                    <input type="text" placeholder="Doe" required value={onboardingForm.lastName} onChange={e => setOnboardingForm({ ...onboardingForm, lastName: e.target.value })} className="input-field" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Work Email</label>
                    <input type="email" placeholder="john.doe@nexus.com" required value={onboardingForm.email} onChange={e => setOnboardingForm({ ...onboardingForm, email: e.target.value })} className="input-field" />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Mobile Number</label>
                    <input type="text" placeholder="9876543210" value={onboardingForm.phone} onChange={e => setOnboardingForm({ ...onboardingForm, phone: e.target.value })} className="input-field" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Gender</label>
                    <select value={onboardingForm.gender} onChange={e => setOnboardingForm({ ...onboardingForm, gender: e.target.value })} className="select-field">
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Location</label>
                    <select value={onboardingForm.location} onChange={e => setOnboardingForm({ ...onboardingForm, location: e.target.value })} className="select-field">
                      <option value="Mumbai Office">Mumbai Office</option>
                      <option value="Bangalore Office">Bangalore Office</option>
                      <option value="Pune Office">Pune Office</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Join Date</label>
                    <input type="date" required value={onboardingForm.joinDate} onChange={e => setOnboardingForm({ ...onboardingForm, joinDate: e.target.value })} className="input-field" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.8fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Department</label>
                    <select value={onboardingForm.departmentId} onChange={e => setOnboardingForm({ ...onboardingForm, departmentId: e.target.value })} className="select-field" required>
                      <option value="">Select Department...</option>
                      {departmentsList.map(dept => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Job Title</label>
                    <input type="text" placeholder="Software Engineer" required value={onboardingForm.jobTitle} onChange={e => setOnboardingForm({ ...onboardingForm, jobTitle: e.target.value })} className="input-field" />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Salary (INR/m)</label>
                    <input type="number" required value={onboardingForm.salary} onChange={e => setOnboardingForm({ ...onboardingForm, salary: e.target.value })} className="input-field" />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                  <button type="button" onClick={() => setShowOnboardingModal(false)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none' }}>
                    Add & Initiate Onboarding
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ──── INITIATE OFFBOARDING MODAL ──── */}
        {showOffboardingModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '480px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>🚪 Initiate Offboarding</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Select an active employee to initiate their separation exit clearances.</p>
              </div>

              <form onSubmit={handleInitiateOffboardingSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Select Employee</label>
                  <select 
                    value={selectedOffboardEmployeeId} 
                    onChange={e => setSelectedOffboardEmployeeId(e.target.value)} 
                    className="select-field" 
                    required
                  >
                    <option value="">Choose Employee...</option>
                    {employees
                      .filter(emp => emp.accountStage === 'EMPLOYEE' || emp.accountStage === 'MANAGER')
                      .map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName} ({emp.employeeId} - {emp.jobTitle})</option>
                      ))
                    }
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button type="button" onClick={() => setShowOffboardingModal(false)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" disabled={!selectedOffboardEmployeeId} className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', border: 'none' }}>
                    Start Clearance Flow
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
