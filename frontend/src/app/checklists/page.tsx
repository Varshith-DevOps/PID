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
import { ValidatedInput } from '@/components/ValidatedField';
import { validateForm, required, email as vEmail, mobile as vMobile, personName, amount } from '@/lib/validators';
import {
  Button, IconButton, Badge, StatusChip, Tabs, Modal, Drawer, ConfirmDialog,
  Field, Select, Avatar, Card, PageHeader, DataTable, EmptyState, ErrorState,
  LoadingBlock, FilterBar, SearchInput, FilterSelect, Checkbox,
} from '@/components/ui';
import type { Column } from '@/components/ui';

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
  const [loadError, setLoadError] = useState(false);

  // Per-form submit/validation flags
  const [customTaskSubmitted, setCustomTaskSubmitted] = useState(false);
  const [templateSubmitted, setTemplateSubmitted] = useState(false);
  const [onboardingSubmitted, setOnboardingSubmitted] = useState(false);

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

  // Confirm dialog states (replacing native confirm()/prompt())
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  const [forceComplete, setForceComplete] = useState<
    { kind: 'ONBOARDING' | 'OFFBOARDING'; employeeId: string; message: string } | null
  >(null);

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
    setLoadError(false);
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
      setLoadError(true);
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
    setCustomTaskSubmitted(true);
    if (!selectedEmployee) return;
    const { isValid } = validateForm(
      { title: customTaskForm.title },
      { title: required('Task title') }
    );
    if (!isValid) return;
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
      setCustomTaskSubmitted(false);
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
    setTemplateSubmitted(true);
    const { isValid } = validateForm(
      { name: templateForm.name },
      { name: required('Template name') }
    );
    if (!isValid || templateForm.tasks.length === 0) return;
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
      setTemplateSubmitted(false);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to save checklist template.');
    }
  };

  const handleDeleteTemplate = async (id: string) => {
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
    setOnboardingSubmitted(true);
    const { isValid } = validateForm(
      {
        firstName: onboardingForm.firstName,
        lastName: onboardingForm.lastName,
        email: onboardingForm.email,
        phone: onboardingForm.phone,
        jobTitle: onboardingForm.jobTitle,
        departmentId: onboardingForm.departmentId,
        salary: onboardingForm.salary,
      },
      {
        firstName: personName('First name'),
        lastName: personName('Last name'),
        email: vEmail,
        phone: vMobile,
        jobTitle: required('Job title'),
        departmentId: required('Department'),
        salary: amount,
      }
    );
    if (!isValid) return;
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
      setOnboardingSubmitted(false);
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
        setForceComplete({
          kind: 'ONBOARDING',
          employeeId,
          message: `${errorData.error}\n\nDo you want to force-complete the onboarding anyway?`,
        });
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
        setForceComplete({
          kind: 'OFFBOARDING',
          employeeId,
          message: `${errorData.error}\n\nDo you want to force-complete the offboarding anyway?`,
        });
      } else {
        console.error(err);
        alert(errorData?.error || 'Failed to complete offboarding.');
      }
    }
  };

  const handleForceComplete = async () => {
    if (!forceComplete) return;
    const { kind, employeeId } = forceComplete;
    try {
      const result = kind === 'ONBOARDING'
        ? await apiCompleteOnboarding(employeeId, true)
        : await apiCompleteOffboarding(employeeId, true);
      setSelectedEmployee(null);
      loadData();
      alert(result.message || (kind === 'ONBOARDING' ? 'Onboarding force-completed!' : 'Offboarding force-completed!'));
    } catch (forceErr) {
      console.error(forceErr);
      alert(kind === 'ONBOARDING' ? 'Failed to force-complete onboarding.' : 'Failed to force-complete offboarding.');
    } finally {
      setForceComplete(null);
    }
  };

  if (authLoading || !user) {
    return <div className="loading-container"><div className="loading-spinner" />Loading...</div>;
  }

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

  const stageBadge = (stage: string) => {
    const map: Record<string, { tone: any; label: string }> = {
      ONBOARDING: { tone: 'success', label: 'Onboarding In Progress' },
      OFFBOARDING: { tone: 'danger', label: 'Clearance In Progress' },
      EMPLOYEE: { tone: 'success', label: 'Onboarded' },
      TERMINATED: { tone: 'neutral', label: 'Separated' },
    };
    const cfg = map[stage] || { tone: 'info', label: stage };
    return <Badge tone={cfg.tone} dot>{cfg.label}</Badge>;
  };

  const departmentOptions = [
    { value: '', label: 'All Departments' },
    ...Array.from(new Set(employees.map(e => e.department?.name).filter(Boolean))).map((d: any) => ({ value: d, label: d })),
  ];
  const locationOptions = [
    { value: '', label: 'All Locations' },
    ...Array.from(new Set(employees.map(e => e.location).filter(Boolean))).map((l: any) => ({ value: l, label: l })),
  ];

  const employeeColumns: Column<any>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: (emp) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Avatar name={emp.firstName} size={32} />
          <div>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{emp.firstName} {emp.lastName}</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>ID: {emp.employeeId}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'job',
      header: 'Job Profile',
      render: (emp) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{emp.jobTitle}</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--accent)' }}>{emp.department?.name || 'Staff'}</div>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      render: (emp) => <span style={{ color: 'var(--text-secondary)' }}>{emp.location || 'Pune Office'}</span>,
    },
    {
      key: 'date',
      header: activeTab === 'onboarding' ? 'Join Date' : 'Clearance Review',
      render: (emp) => (
        <span style={{ color: 'var(--text-secondary)' }}>
          {activeTab === 'onboarding' ? new Date(emp.joinDate).toLocaleDateString('en-IN') : 'Clearance Process'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status State',
      render: (emp) => stageBadge(emp.accountStage),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (emp) => (
        <Button size="sm" onClick={() => handleOpenEmployeeDetails(emp)}>Manage Checklist</Button>
      ),
    },
  ];

  const hasFilters = !!(searchTerm || filterDepartment || filterLocation);

  return (
    <div className="app-layout">
      <Sidebar activePath="/checklists" />
      <main className="main-content">

        <PageHeader
          title="Onboarding & Offboarding Board"
          subtitle="Track new hire integration pathways and exit clearances seamlessly"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          }
          actions={
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              {activeTab === 'onboarding' && (
                <Button
                  variant="success"
                  onClick={() => {
                    if (departmentsList.length > 0) {
                      setOnboardingForm(prev => ({ ...prev, departmentId: departmentsList[0].id }));
                    }
                    setShowOnboardingModal(true);
                  }}
                >
                  Start Onboarding
                </Button>
              )}
              {activeTab === 'offboarding' && (
                <Button
                  variant="danger"
                  onClick={() => {
                    setSelectedOffboardEmployeeId('');
                    setShowOffboardingModal(true);
                  }}
                >
                  Initiate Offboarding
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={() => {
                  setEditingTemplateId(null);
                  setTemplateForm({ name: '', type: 'ONBOARDING', description: '', tasks: [] });
                  setShowTemplateModal(true);
                }}
              >
                Build Custom Template
              </Button>
            </div>
          }
        />

        {/* Tab Selectors */}
        <Tabs
          items={[
            { key: 'onboarding', label: 'Onboarding Path' },
            { key: 'offboarding', label: 'Offboarding Clearances' },
            { key: 'templates', label: 'Reusable Templates' },
          ]}
          value={activeTab}
          onChange={(k) => setActiveTab(k as typeof activeTab)}
          style={{ marginBottom: '1.5rem' }}
        />

        {loading ? (
          <LoadingBlock label="Loading boards…" />
        ) : loadError ? (
          <ErrorState onRetry={loadData} />
        ) : (
          <>
            {/* Search and Filters Bar */}
            {(activeTab === 'onboarding' || activeTab === 'offboarding') && (
              <FilterBar
                right={
                  activeTab === 'onboarding' ? (
                    <Checkbox
                      label="Show Onboarding History"
                      checked={showOnboardingHistory}
                      onChange={setShowOnboardingHistory}
                    />
                  ) : (
                    <Checkbox
                      label="Show Exit History (Left Employees)"
                      checked={showTerminatedHistory}
                      onChange={setShowTerminatedHistory}
                    />
                  )
                }
              >
                <SearchInput
                  value={searchTerm}
                  onChange={setSearchTerm}
                  placeholder="Search employee by name, ID or job role…"
                  width={280}
                />
                <FilterSelect value={filterDepartment} onChange={setFilterDepartment} options={departmentOptions} ariaLabel="Filter by department" />
                <FilterSelect value={filterLocation} onChange={setFilterLocation} options={locationOptions} ariaLabel="Filter by location" />
                {hasFilters && (
                  <Button variant="link" onClick={() => { setSearchTerm(''); setFilterDepartment(''); setFilterLocation(''); }}>
                    Clear Filters
                  </Button>
                )}
              </FilterBar>
            )}

            {/* ──── TAB 1 & 2: ONBOARDING / OFFBOARDING TABLE LIST VIEW ──── */}
            {(activeTab === 'onboarding' || activeTab === 'offboarding') && (
              <DataTable
                columns={employeeColumns}
                rows={filteredEmployees}
                rowKey={(emp) => emp.id}
                emptyTitle="No employees found"
                emptyMessage="No employees matching the search filters."
              />
            )}

            {/* ──── TAB 3: TEMPLATES MANAGEMENT ──── */}
            {activeTab === 'templates' && (
              templates.length === 0 ? (
                <EmptyState
                  title="No templates yet"
                  message="No templates created yet. Create one to begin task automations."
                  action={
                    <Button onClick={() => { setEditingTemplateId(null); setTemplateForm({ name: '', type: 'ONBOARDING', description: '', tasks: [] }); setShowTemplateModal(true); }}>
                      Build Custom Template
                    </Button>
                  }
                />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                  {templates.map(tpl => (
                    <Card key={tpl.id} padded>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Badge tone={tpl.type === 'ONBOARDING' ? 'success' : 'danger'}>{tpl.type}</Badge>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <Button variant="link" size="sm" onClick={() => handleEditTemplate(tpl)}>Edit</Button>
                            <Button variant="link" size="sm" style={{ color: 'var(--danger-fg)' }} onClick={() => setDeleteTemplateId(tpl.id)}>Delete</Button>
                          </div>
                        </div>

                        <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{tpl.name}</h3>
                        {tpl.description && <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0 }}>{tpl.description}</p>}

                        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                          <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                            Preconfigured Tasks ({tpl.tasks.length})
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            {tpl.tasks.map((t, idx) => (
                              <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                <span style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 'bold' }}>{idx + 1}.</span>
                                <div>
                                  <div style={{ fontSize: '0.72rem', color: 'var(--text-primary)', fontWeight: 600 }}>{t.title}</div>
                                  {t.description && <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{t.description}</div>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )
            )}
          </>
        )}

        {/* ──── DETAIL DRAWER: EMPLOYEE CHECKLIST WORKFLOW ──── */}
        <Drawer
          open={!!selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
          width={560}
          title={selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : ''}
          footer={
            selectedEmployee && (
              <>
                {selectedEmployee.accountStage === 'ONBOARDING' && (
                  <Button variant="success" onClick={() => handleCompleteOnboarding(selectedEmployee.id)}>
                    Complete Onboarding & Activate
                  </Button>
                )}
                {selectedEmployee.accountStage === 'OFFBOARDING' && (
                  <Button variant="danger" onClick={() => handleCompleteOffboarding(selectedEmployee.id)}>
                    Complete Clearances & Separated
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setSelectedEmployee(null)}>Done</Button>
              </>
            )
          }
        >
          {selectedEmployee && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                Manage {activeTab === 'onboarding' ? 'Onboarding tasks' : 'Offboarding clearance'} progress path
              </p>

              {/* Summary Details */}
              <Card padded>
                <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 0, marginBottom: '0.5rem' }}>Summary Details</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  <div><strong>Job Title:</strong> {selectedEmployee.jobTitle}</div>
                  <div><strong>Department:</strong> {selectedEmployee.department?.name || 'Staff'}</div>
                  <div><strong>Employment:</strong> {selectedEmployee.employmentType}</div>
                  <div><strong>Join Date:</strong> {new Date(selectedEmployee.joinDate).toLocaleDateString('en-IN')}</div>
                </div>
              </Card>

              {/* Tasks */}
              {employeeTasks.length === 0 ? (
                <Card padded>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>No Active Tasks Assigned</h4>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0 }}>Instantiate a predefined reusable checklist template or add custom ad-hoc tasks.</p>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                      <div style={{ flex: 1 }}>
                        <Select
                          value={selectedTemplateId}
                          onChange={setSelectedTemplateId}
                          placeholder="Choose Template…"
                          options={templates
                            .filter(t => t.type === (activeTab === 'onboarding' ? 'ONBOARDING' : 'OFFBOARDING'))
                            .map(t => ({ value: t.id, label: t.name }))}
                        />
                      </div>
                      <Button onClick={handleInstantiate} disabled={!selectedTemplateId}>Initialize</Button>
                    </div>
                  </div>
                </Card>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {employeeTasks.map((task) => (
                    <Card key={task.id} padded>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                          <div>
                            <div style={{
                              fontWeight: 700,
                              color: 'var(--text-primary)',
                              fontSize: '0.82rem',
                              textDecoration: task.status === 'COMPLETED' ? 'line-through' : 'none',
                            }}>
                              {task.title}
                            </div>
                            {task.description && <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', margin: 0 }}>{task.description}</p>}
                          </div>
                          <select
                            className="select-field"
                            value={task.status}
                            onChange={e => handleUpdateTaskStatus(task.id, e.target.value)}
                            style={{ width: 'auto', minWidth: 130, fontSize: '0.7rem' }}
                          >
                            <option value="PENDING">Pending</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="SKIPPED">Skipped</option>
                          </select>
                        </div>
                        <input
                          type="text"
                          className="input-field"
                          placeholder="Add remarks or task update…"
                          value={task.remarks || ''}
                          onChange={e => handleUpdateTaskRemarks(task.id, e.target.value)}
                          style={{ fontSize: '0.7rem' }}
                        />
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* Ad-hoc Custom Task Creator */}
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
                <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 0, marginBottom: '0.75rem' }}>
                  Add Custom Task
                </h4>
                <form onSubmit={handleAddCustomTask} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <Field label="Task Title" required>
                    <ValidatedInput
                      type="text"
                      required
                      placeholder="e.g. Provide locker keys"
                      value={customTaskForm.title}
                      onChange={v => setCustomTaskForm({ ...customTaskForm, title: v })}
                      validator={required('Task title')}
                      forceError={customTaskSubmitted}
                      className="input-field"
                    />
                  </Field>
                  <Field label="Description">
                    <ValidatedInput
                      type="text"
                      placeholder="Additional details…"
                      value={customTaskForm.description}
                      onChange={v => setCustomTaskForm({ ...customTaskForm, description: v })}
                      className="input-field"
                    />
                  </Field>
                  <Button type="submit" variant="ghost">+ Add Task</Button>
                </form>
              </div>
            </div>
          )}
        </Drawer>

        {/* ──── TEMPLATE BUILDER MODAL ──── */}
        <Modal
          open={showTemplateModal}
          onClose={() => setShowTemplateModal(false)}
          width={520}
          title={editingTemplateId ? 'Edit Checklist Template' : 'Create Checklist Template'}
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowTemplateModal(false)}>Cancel</Button>
              <Button
                type="submit"
                form="template-builder-form"
                disabled={templateForm.tasks.length === 0 || !templateForm.name}
              >
                Save Template
              </Button>
            </>
          }
        >
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 0 }}>
            {editingTemplateId ? 'Update template configurations and preconfigured task list' : 'Define reusable task sequences for onboarding or clearance processes'}
          </p>

          <form id="template-builder-form" onSubmit={handleCreateTemplateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Field label="Template Name" required>
              <ValidatedInput type="text" placeholder="e.g. Remote Dev Onboarding" required value={templateForm.name} onChange={v => setTemplateForm({ ...templateForm, name: v })} validator={required('Template name')} forceError={templateSubmitted} className="input-field" />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Select
                label="Checklist Type"
                value={templateForm.type}
                onChange={v => setTemplateForm({ ...templateForm, type: v })}
                options={[
                  { value: 'ONBOARDING', label: 'Onboarding Path' },
                  { value: 'OFFBOARDING', label: 'Offboarding Clearance' },
                ]}
              />
              <Field label="Description">
                <ValidatedInput type="text" placeholder="Brief outline…" value={templateForm.description} onChange={v => setTemplateForm({ ...templateForm, description: v })} className="input-field" />
              </Field>
            </div>

            {/* Preconfigured checklist items input builder */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
              <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Preconfigured Task List</h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.75rem', maxHeight: '120px', overflowY: 'auto' }}>
                {templateForm.tasks.length === 0 ? (
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No tasks added to list yet.</span>
                ) : (
                  templateForm.tasks.map((task, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-sunken)', padding: '0.3rem 0.5rem', borderRadius: 'var(--radius-sm)' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-primary)' }}>{idx + 1}. <strong>{task.title}</strong></span>
                      <IconButton label="Remove task" tone="danger" size={24} onClick={() => handleRemoveTemplateTaskInput(idx)} style={{ border: 'none' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </IconButton>
                    </div>
                  ))
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <ValidatedInput type="text" placeholder="Task title…" value={newTaskTitle} onChange={setNewTaskTitle} className="input-field" />
                </div>
                <div style={{ flex: 1.2 }}>
                  <ValidatedInput type="text" placeholder="Short description…" value={newTaskDesc} onChange={setNewTaskDesc} className="input-field" />
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={handleAddTemplateTaskInput}>+ Add</Button>
              </div>
            </div>
          </form>
        </Modal>

        {/* ──── START ONBOARDING MODAL ──── */}
        <Modal
          open={showOnboardingModal}
          onClose={() => setShowOnboardingModal(false)}
          width={580}
          title="Start Onboarding"
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowOnboardingModal(false)}>Cancel</Button>
              <Button type="submit" form="start-onboarding-form" variant="success">Add & Initiate Onboarding</Button>
            </>
          }
        >
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 0 }}>Enter details below. This will create their record and initialize onboarding stages.</p>

          <form id="start-onboarding-form" onSubmit={handleStartOnboardingSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Field label="First Name" required>
                <ValidatedInput type="text" placeholder="John" required value={onboardingForm.firstName} onChange={v => setOnboardingForm({ ...onboardingForm, firstName: v })} validator={personName('First name')} restrict="alpha" forceError={onboardingSubmitted} className="input-field" />
              </Field>
              <Field label="Last Name" required>
                <ValidatedInput type="text" placeholder="Doe" required value={onboardingForm.lastName} onChange={v => setOnboardingForm({ ...onboardingForm, lastName: v })} validator={personName('Last name')} restrict="alpha" forceError={onboardingSubmitted} className="input-field" />
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Field label="Work Email" required>
                <ValidatedInput type="email" placeholder="john.doe@pid-hcms.com" required value={onboardingForm.email} onChange={v => setOnboardingForm({ ...onboardingForm, email: v })} validator={vEmail} forceError={onboardingSubmitted} className="input-field" />
              </Field>
              <Field label="Mobile Number">
                <ValidatedInput type="text" inputMode="numeric" placeholder="9876543210" value={onboardingForm.phone} onChange={v => setOnboardingForm({ ...onboardingForm, phone: v })} validator={vMobile} restrict="digits" maxLength={10} forceError={onboardingSubmitted} className="input-field" />
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <Select
                label="Gender"
                value={onboardingForm.gender}
                onChange={v => setOnboardingForm({ ...onboardingForm, gender: v })}
                options={[
                  { value: 'MALE', label: 'Male' },
                  { value: 'FEMALE', label: 'Female' },
                  { value: 'OTHER', label: 'Other' },
                ]}
              />
              <Select
                label="Location"
                value={onboardingForm.location}
                onChange={v => setOnboardingForm({ ...onboardingForm, location: v })}
                options={[
                  { value: 'Mumbai Office', label: 'Mumbai Office' },
                  { value: 'Bangalore Office', label: 'Bangalore Office' },
                  { value: 'Pune Office', label: 'Pune Office' },
                ]}
              />
              <Field label="Join Date">
                <input type="date" required value={onboardingForm.joinDate} onChange={e => setOnboardingForm({ ...onboardingForm, joinDate: e.target.value })} className="input-field" />
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.8fr', gap: '1rem' }}>
              <Select
                label="Department"
                required
                value={onboardingForm.departmentId}
                onChange={v => setOnboardingForm({ ...onboardingForm, departmentId: v })}
                placeholder="Select Department…"
                options={departmentsList.map(dept => ({ value: dept.id, label: dept.name }))}
              />
              <Field label="Job Title" required>
                <ValidatedInput type="text" placeholder="Software Engineer" required value={onboardingForm.jobTitle} onChange={v => setOnboardingForm({ ...onboardingForm, jobTitle: v })} validator={required('Job title')} forceError={onboardingSubmitted} className="input-field" />
              </Field>
              <Field label="Salary (INR/m)" required>
                <ValidatedInput type="text" inputMode="decimal" required value={onboardingForm.salary} onChange={v => setOnboardingForm({ ...onboardingForm, salary: v })} validator={amount} restrict="decimal" forceError={onboardingSubmitted} className="input-field" />
              </Field>
            </div>
          </form>
        </Modal>

        {/* ──── INITIATE OFFBOARDING MODAL ──── */}
        <Modal
          open={showOffboardingModal}
          onClose={() => setShowOffboardingModal(false)}
          width={480}
          title="Initiate Offboarding"
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowOffboardingModal(false)}>Cancel</Button>
              <Button type="submit" form="initiate-offboarding-form" variant="danger" disabled={!selectedOffboardEmployeeId}>Start Clearance Flow</Button>
            </>
          }
        >
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 0 }}>Select an active employee to initiate their separation exit clearances.</p>

          <form id="initiate-offboarding-form" onSubmit={handleInitiateOffboardingSubmit}>
            <Select
              label="Select Employee"
              required
              value={selectedOffboardEmployeeId}
              onChange={setSelectedOffboardEmployeeId}
              placeholder="Choose Employee…"
              options={employees
                .filter(emp => emp.accountStage === 'EMPLOYEE' || emp.accountStage === 'MANAGER')
                .map(emp => ({ value: emp.id, label: `${emp.firstName} ${emp.lastName} (${emp.employeeId} - ${emp.jobTitle})` }))}
            />
          </form>
        </Modal>

        {/* ──── CONFIRM DIALOGS (replacing native confirm/prompt) ──── */}
        <ConfirmDialog
          open={!!deleteTemplateId}
          title="Delete template?"
          message="Are you sure you want to delete this template?"
          tone="danger"
          confirmLabel="Delete"
          onCancel={() => setDeleteTemplateId(null)}
          onConfirm={() => {
            const id = deleteTemplateId;
            setDeleteTemplateId(null);
            if (id) handleDeleteTemplate(id);
          }}
        />

        <ConfirmDialog
          open={!!forceComplete}
          title="Force-complete?"
          message={forceComplete?.message}
          tone="danger"
          confirmLabel="Force Complete"
          onCancel={() => setForceComplete(null)}
          onConfirm={handleForceComplete}
        />

      </main>
    </div>
  );
}
