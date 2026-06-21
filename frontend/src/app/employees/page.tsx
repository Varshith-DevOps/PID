'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { getEmployees, getDepartments, createEmployee, getShiftTypes } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import { ValidatedInput } from '@/components/ValidatedField';
import { validateForm, email as vEmail, personName, amount, required, date as vDate } from '@/lib/validators';

interface Employee {
  id: string; employeeId: string; firstName: string; lastName: string; email: string;
  jobTitle: string; department: { id: string; name: string }; photoUrl?: string; accountStage?: string; joinDate?: string;
}

export default function EmployeesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [shiftTypes, setShiftTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  
  // Add Employee Form States
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitted, setSubmitted] = useState(false);
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

  useEffect(() => { if (!authLoading && !user) router.push('/'); }, [user, authLoading]);
  useEffect(() => { if (user) loadData(); }, [user, search, selectedDepartment]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [empData, deptData, shiftsData] = await Promise.all([
        getEmployees({ search, departmentId: selectedDepartment }),
        getDepartments(),
        getShiftTypes(),
      ]);
      setEmployees(empData.employees);
      setDepartments(deptData);
      setShiftTypes(shiftsData || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

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
    }
  };

  if (authLoading || !user) return <div className="loading-container"><div className="loading-spinner" />Loading...</div>;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="page-header-left">
            <div className="page-header-icon" style={{ background: 'linear-gradient(135deg, #0B7890, #182B6D)' }}>
              {/* 3D-style people icon */}
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))' }}>
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div>
              <h1 className="page-title">Employees</h1>
              <p className="page-subtitle">Organization directory</p>
            </div>
          </div>
          {(user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') && (
            <button onClick={() => setShowAddModal(true)} className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #0B7890, #182B6D)', display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none', boxShadow: '0 4px 15px rgba(11,120,144,0.35)', cursor: 'pointer' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Employee
            </button>
          )}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <input type="text" placeholder="Search by name or ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-field" style={{ flex: 1, maxWidth: '360px' }} />
          <select value={selectedDepartment} onChange={(e) => setSelectedDepartment(e.target.value)} className="select-field" style={{ width: '180px' }}>
            <option value="">All Departments</option>
            {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <div style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}>
            {employees.length} employees
          </div>
        </div>

        {/* Minimalist Employee List */}
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          {loading ? (
            <div className="loading-container"><div className="loading-spinner" />Loading...</div>
          ) : employees.length === 0 ? (
            <div className="empty-state">No employees found</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '120px' }}>ID</th>
                  <th>Employee</th>
                  <th>Email</th>
                  <th style={{ width: '130px' }}>Date of Joining</th>
                  <th style={{ width: '160px' }}>Department</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const initials = `${emp.firstName[0]}${emp.lastName[0]}`;
                  return (
                    <tr key={emp.id} onClick={() => router.push(`/employees/${emp.id}`)} style={{ cursor: 'pointer' }}>
                      <td style={{ fontFamily: 'monospace', color: 'var(--accent-blue)', fontSize: '0.8rem' }}>{emp.employeeId}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          {/* 3D avatar */}
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #0B7890, #00A7B5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'white', boxShadow: '0 3px 8px rgba(11,120,144,0.35)', flexShrink: 0, overflow: 'hidden' }}>
                            {emp.photoUrl ? <img src={`http://localhost:5000/${emp.photoUrl}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{emp.firstName} {emp.lastName}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{emp.jobTitle}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{emp.email}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{emp.joinDate ? new Date(emp.joinDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                      <td><span className="badge badge-info" style={{ fontSize: '0.65rem' }}>{emp.department?.name}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Manual Add Employee Modal Form Overlay */}
        {showAddModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '520px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'white' }}>Add New Employee</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Create a new employee profile and system user login account</p>
              </div>

              <form onSubmit={handleAddEmployee} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>First Name</label>
                    <ValidatedInput type="text" placeholder="John" required value={form.firstName} onChange={v => setForm({ ...form, firstName: v })} validator={personName('First name')} restrict="alpha" forceError={submitted} className="input-field" />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Last Name</label>
                    <ValidatedInput type="text" placeholder="Doe" required value={form.lastName} onChange={v => setForm({ ...form, lastName: v })} validator={personName('Last name')} restrict="alpha" forceError={submitted} className="input-field" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Work Email</label>
                    <ValidatedInput type="email" placeholder="john.doe@company.com" required value={form.email} onChange={v => setForm({ ...form, email: v })} validator={vEmail} forceError={submitted} className="input-field" />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Job Title</label>
                    <ValidatedInput type="text" placeholder="Frontend Engineer" required value={form.jobTitle} onChange={v => setForm({ ...form, jobTitle: v })} validator={required('Job title')} forceError={submitted} className="input-field" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Department</label>
                    <select required value={form.departmentId} onChange={e => setForm({ ...form, departmentId: e.target.value })} className="select-field">
                      <option value="">Select Dept...</option>
                      {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Employment Type</label>
                    <select value={form.employmentType} onChange={e => setForm({ ...form, employmentType: e.target.value })} className="select-field">
                      <option value="FULL_TIME">Full Time</option>
                      <option value="PART_TIME">Part Time</option>
                      <option value="CONTRACT">Contract</option>
                      <option value="INTERN">Intern</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Join Date</label>
                    <input type="date" required value={form.joinDate} onChange={e => setForm({ ...form, joinDate: e.target.value })} className="input-field" />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Monthly Salary (INR)</label>
                    <ValidatedInput type="text" inputMode="decimal" placeholder="80000" required value={form.salary} onChange={v => setForm({ ...form, salary: v })} validator={amount} restrict="decimal" forceError={submitted} className="input-field" />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Shift Assignment (Onboarding)</label>
                  <select value={form.shiftTypeId} onChange={e => setForm({ ...form, shiftTypeId: e.target.value })} className="select-field">
                    <option value="">General Shift (Default)</option>
                    {shiftTypes.filter((s: any) => s.isActive).map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.startTime} - {s.endTime})</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #0B7890, #182B6D)', border: 'none' }}>
                    Create Profile
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