'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { getEmployees, getDepartments, createEmployee, getShiftTypes } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import { validateForm, email as vEmail, personName, amount, required, date as vDate } from '@/lib/validators';
import {
  PageHeader, Button, DataTable, Avatar, Badge,
  FilterBar, SearchInput, FilterSelect,
  Modal, TextField, Select, DateField, LoadingBlock, ErrorState,
} from '@/components/ui';
import type { Column } from '@/components/ui';

import BulkImportModal from '@/components/BulkImportModal';

interface Employee {
  id: string; employeeId: string; firstName: string; lastName: string; email: string;
  jobTitle: string; department: { id: string; name: string }; photoUrl?: string; accountStage?: string; joinDate?: string;
  isActive?: boolean;
  [key: string]: unknown;
}

const PeopleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
);

export default function EmployeesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [shiftTypes, setShiftTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');

  // Add Employee Form States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    jobTitle: '',
    departmentId: '',
    employmentType: 'FULL_TIME',
    joinDate: new Date().toISOString().split('T')[0],
    salary: '',
    shiftTypeId: '',
  });

  const loadMasterData = useCallback(async () => {
    try {
      const [deptData, shiftsData] = await Promise.all([
        getDepartments(),
        getShiftTypes(),
      ]);
      setDepartments(deptData);
      setShiftTypes(shiftsData || []);
    } catch (err) { console.error(err); }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const empData = await getEmployees({ search: debouncedSearch, departmentId: selectedDepartment, status: statusFilter });
      setEmployees(empData.employees);
    } catch (err) { console.error(err); setError(true); } finally { setLoading(false); }
  }, [debouncedSearch, selectedDepartment, statusFilter]);

  useEffect(() => { if (!authLoading && !user) router.push('/'); }, [user, authLoading, router]);
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(id);
  }, [search]);
  useEffect(() => { if (user) loadMasterData(); }, [user, loadMasterData]);
  useEffect(() => { if (user) loadData(); }, [user, loadData]);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const { isValid } = validateForm(
      {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        jobTitle: form.jobTitle,
        departmentId: form.departmentId,
        joinDate: form.joinDate,
        salary: form.salary,
      },
      {
        firstName: personName('First name'),
        lastName: personName('Last name'),
        email: vEmail,
        jobTitle: required('Job title'),
        departmentId: required('Department'),
        joinDate: vDate('Join date'),
        salary: amount,
      }
    );
    if (!isValid) {
      alert('Please correct the highlighted fields.');
      return;
    }
    setSaving(true);
    try {
      await createEmployee(form);
      setShowAddModal(false);
      setSubmitted(false);
      setForm({
        firstName: '',
        lastName: '',
        email: '',
        jobTitle: '',
        departmentId: '',
        employmentType: 'FULL_TIME',
        joinDate: new Date().toISOString().split('T')[0],
        salary: '',
        shiftTypeId: '',
      });
      loadData();
      alert('Employee created successfully! Login password is set to employee123 by default.');
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.error || 'Failed to create employee profile');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="app-layout">
        <Sidebar activePath="/employees" />
        <main className="main-content">
          <LoadingBlock label="Loading employees..." />
        </main>
      </div>
    );
  }

  const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
  const canViewInactive = ['SUPER_ADMIN', 'ADMIN', 'HR_ADMIN', 'HR'].includes(user.role || '');

  const columns: Column<Employee>[] = [
    {
      key: 'employeeId',
      header: 'ID',
      width: 120,
      render: (emp) => <span className="font-mono" style={{ color: 'var(--accent)', fontSize: '0.8rem' }}>{emp.employeeId}</span>,
    },
    {
      key: 'name',
      header: 'Employee',
      render: (emp) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Avatar name={`${emp.firstName} ${emp.lastName}`} src={emp.photoUrl ? `http://localhost:5000/${emp.photoUrl}` : null} size={36} />
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{emp.firstName} {emp.lastName}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{emp.jobTitle}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (emp) => <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{emp.email}</span>,
    },
    {
      key: 'joinDate',
      header: 'Date of Joining',
      width: 130,
      render: (emp) => <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{emp.joinDate ? new Date(emp.joinDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span>,
    },
    {
      key: 'department',
      header: 'Department',
      width: 160,
      render: (emp) => emp.department?.name ? <Badge tone="info">{emp.department.name}</Badge> : <span style={{ color: 'var(--text-muted)' }}>—</span>,
    },
    {
      key: 'status',
      header: 'Status',
      width: 110,
      render: (emp) => <Badge tone={emp.isActive === false ? 'danger' : 'success'}>{emp.isActive === false ? 'INACTIVE' : 'ACTIVE'}</Badge>,
    },
  ];

  const canManageEmployees = ['SUPER_ADMIN', 'ADMIN', 'HR_ADMIN', 'HR'].includes(user.role || '');

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <PageHeader
          title="Employees"
          subtitle="Organization directory"
          icon={<PeopleIcon />}
          actions={canManageEmployees && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button variant="ghost" leftIcon={<span>📥</span>} onClick={() => setShowBulkModal(true)}>
                Bulk Add Employees
              </Button>
              <Button leftIcon={<PlusIcon />} onClick={() => setShowAddModal(true)}>
                Add Employee
              </Button>
            </div>
          )}
        />

        {/* Filters */}
        <FilterBar
          right={<span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{employees.length} employees</span>}
        >
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name or ID..." width={360} />
          <FilterSelect
            ariaLabel="Filter by department"
            value={selectedDepartment}
            onChange={setSelectedDepartment}
            options={[
              { value: '', label: 'All Departments' },
              ...departments.map((d: any) => ({ value: d.id, label: d.name })),
            ]}
          />
          {canViewInactive && (
            <FilterSelect
              ariaLabel="Filter by employee status"
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as 'active' | 'inactive' | 'all')}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'all', label: 'All Employees' },
              ]}
            />
          )}
        </FilterBar>

        {/* Employee directory */}
        {error ? (
          <div className="glass-card" style={{ padding: '1rem' }}>
            <ErrorState message="We couldn’t load the employee directory." onRetry={loadData} />
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={employees}
            loading={loading}
            rowKey={(emp) => emp.id}
            onRowClick={(emp) => router.push(`/employees/${emp.id}`)}
            emptyTitle="No employees found"
            emptyMessage="Try adjusting your search or filters."
          />
        )}

        {/* Add Employee Modal */}
        <Modal
          open={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="Add New Employee"
          width={560}
        >
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '-0.5rem', marginBottom: '1rem' }}>
            Create a new employee profile and system user login account
          </p>
          <form onSubmit={handleAddEmployee} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div className="form-grid">
              <TextField label="First Name" required placeholder="John" value={form.firstName} onChange={v => setForm({ ...form, firstName: v })} validator={personName('First name')} restrict="alpha" forceError={submitted} />
              <TextField label="Last Name" required placeholder="Doe" value={form.lastName} onChange={v => setForm({ ...form, lastName: v })} validator={personName('Last name')} restrict="alpha" forceError={submitted} />
              <TextField label="Work Email" required type="email" placeholder="john.doe@company.com" value={form.email} onChange={v => setForm({ ...form, email: v })} validator={vEmail} forceError={submitted} />
              <TextField label="Job Title" required placeholder="Frontend Engineer" value={form.jobTitle} onChange={v => setForm({ ...form, jobTitle: v })} validator={required('Job title')} forceError={submitted} />
              <Select
                label="Department"
                required
                value={form.departmentId}
                onChange={v => setForm({ ...form, departmentId: v })}
                placeholder="Select Dept..."
                options={departments.map((d: any) => ({ value: d.id, label: d.name }))}
              />
              <Select
                label="Employment Type"
                value={form.employmentType}
                onChange={v => setForm({ ...form, employmentType: v })}
                options={[
                  { value: 'FULL_TIME', label: 'Full Time' },
                  { value: 'PART_TIME', label: 'Part Time' },
                  { value: 'CONTRACT', label: 'Contract' },
                  { value: 'INTERN', label: 'Intern' },
                ]}
              />
              <DateField label="Join Date" required value={form.joinDate} onChange={v => setForm({ ...form, joinDate: v })} />
              <TextField label="Monthly Salary (INR)" required placeholder="80000" value={form.salary} onChange={v => setForm({ ...form, salary: v })} validator={amount} restrict="decimal" forceError={submitted} />
            </div>
            <Select
              label="Shift Assignment (Onboarding)"
              value={form.shiftTypeId}
              onChange={v => setForm({ ...form, shiftTypeId: v })}
              placeholder="General Shift (Default)"
              options={shiftTypes.filter((s: any) => s.isActive).map((s: any) => ({ value: s.id, label: `${s.name} (${s.startTime} - ${s.endTime})` }))}
            />
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <Button type="button" variant="ghost" onClick={() => setShowAddModal(false)}>Cancel</Button>
              <Button type="submit" loading={saving}>Create Profile</Button>
            </div>
          </form>
        </Modal>

        {/* Bulk Add Employees Modal */}
        <BulkImportModal
          isOpen={showBulkModal}
          onClose={() => setShowBulkModal(false)}
          onSuccess={() => {
            setShowBulkModal(false);
            loadData();
          }}
        />
      </main>
    </div>
  );
}
