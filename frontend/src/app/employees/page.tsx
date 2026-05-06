'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { getEmployees, getDepartments } from '@/lib/api';
import Sidebar from '@/components/Sidebar';

interface Employee {
  id: string; employeeId: string; firstName: string; lastName: string; email: string;
  jobTitle: string; department: { id: string; name: string }; photoUrl?: string; accountStage?: string; joinDate?: string;
}

export default function EmployeesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');

  useEffect(() => { if (!authLoading && !user) router.push('/'); }, [user, authLoading]);
  useEffect(() => { if (user) loadData(); }, [user, search, selectedDepartment]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [empData, deptData] = await Promise.all([getEmployees({ search, departmentId: selectedDepartment }), getDepartments()]);
      setEmployees(empData.employees); setDepartments(deptData);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  if (authLoading || !user) return <div className="loading-container"><div className="loading-spinner" />Loading...</div>;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div className="page-header-left">
            <div className="page-header-icon" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
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
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'white', boxShadow: '0 3px 8px rgba(99,102,241,0.35)', flexShrink: 0, overflow: 'hidden' }}>
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
      </main>
    </div>
  );
}