'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { getRolePermissions, updateRolePermissions, resetRolePermissions } from '@/lib/api';
import Sidebar from '@/components/Sidebar';

const MODULES = ['USERS', 'EMPLOYEES', 'ATTENDANCE', 'LEAVE', 'PAYROLL', 'REPORTS', 'SETTINGS'];
const ACTIONS = ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'EXPORT'];

interface RolePermission {
  id: string;
  role: string;
  name: string;
  permissions: { module: string; action: string; isGranted: boolean }[];
}

export default function PermissionsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [roles, setRoles] = useState<RolePermission[]>([]);
  const [selectedRole, setSelectedRole] = useState<RolePermission | null>(null);
  const [loadingPermissions, setLoadingPermissions] = useState(false);

  useEffect(() => {
    if (!loading && (!user || user.role === 'EMPLOYEE')) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN')) {
      loadPermissions();
    }
  }, [user]);

  const loadPermissions = async () => {
    try {
      const data = await getRolePermissions();
      setRoles(data.roles);
      setSelectedRole((current) => {
        if (current) return data.roles.find((role: RolePermission) => role.id === current.id) || data.roles[0] || null;
        return data.roles[0] || null;
      });
    } catch (err) {
      console.error('Failed to load permissions');
    }
  };

  const handlePermissionChange = (module: string, action: string, isGranted: boolean) => {
    if (!selectedRole) return;
    const updated = selectedRole.permissions.map((p) =>
      p.module === module && p.action === action ? { ...p, isGranted } : p
    );
    const newRole = { ...selectedRole, permissions: updated };
    setSelectedRole(newRole);
    setRoles(roles.map((role) => (role.id === newRole.id ? newRole : role)));
  };

  const handleSave = async () => {
    if (!selectedRole) return;
    setLoadingPermissions(true);
    try {
      await updateRolePermissions(selectedRole.role, selectedRole.permissions);
      alert('Permissions saved');
    } catch (err) {
      alert('Failed to save permissions');
    } finally {
      setLoadingPermissions(false);
    }
  };

  const handleReset = async (role: string) => {
    if (!confirm('Reset to default permissions?')) return;
    try {
      await resetRolePermissions(role);
      loadPermissions();
      alert('Permissions reset');
    } catch (err) {
      alert('Failed to reset permissions');
    }
  };

  if (loading || !user) return <div className="loading-container"><div className="loading-spinner" />Loading...</div>;
  if (user.role === 'EMPLOYEE') return null;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div className="page-header-left">
            <div className="page-header-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <div><h1 className="page-title">Permissions</h1><p className="page-subtitle">Manage user access controls</p></div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.5rem' }}>
          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1rem' }}>Access Controls</h3>
            <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
              {roles.map((role) => (
                <div key={role.id} onClick={() => setSelectedRole(role)} style={{ padding: '0.75rem', cursor: 'pointer', background: selectedRole?.id === role.id ? 'rgba(59,130,246,0.15)' : 'transparent', borderRadius: 'var(--radius-sm)', marginBottom: '0.25rem', transition: 'var(--transition)' }}>
                  <div style={{ fontWeight: 600, color: selectedRole?.id === role.id ? 'var(--accent-blue)' : 'var(--text-primary)', fontSize: '0.9rem' }}>{role.name}</div>
                  <span className={`badge ${role.role === 'SUPER_ADMIN' ? 'badge-danger' : role.role === 'ADMIN' ? 'badge-warning' : role.role === 'MANAGER' ? 'badge-info' : 'badge-neutral'}`} style={{ marginTop: '0.25rem' }}>{role.role}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card" style={{ padding: '1.5rem' }}>
            {selectedRole ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Permissions for {selectedRole.name}</h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Role-level access control</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button onClick={() => handleReset(selectedRole.role)} className="btn btn-warning btn-sm">Reset</button>
                    <button onClick={handleSave} disabled={loadingPermissions} className="btn btn-primary btn-sm">{loadingPermissions ? 'Saving...' : 'Save'}</button>
                  </div>
                </div>

                <div style={{ overflow: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Module</th>
                        {ACTIONS.map((action) => (
                          <th key={action} style={{ textAlign: 'center' }}>{action}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {MODULES.map((module) => (
                        <tr key={module}>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{module}</td>
                          {ACTIONS.map((action) => {
                            const perm = selectedRole.permissions.find((p) => p.module === module && p.action === action);
                            const isGranted = perm?.isGranted ?? false;
                            const isDisabled = user.role === 'ADMIN' && selectedRole.role === 'SUPER_ADMIN';
                            return (
                              <td key={action} style={{ textAlign: 'center' }}>
                                <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', background: isGranted ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isGranted ? 'rgba(16,185,129,0.3)' : 'var(--border-color)'}`, cursor: isDisabled ? 'not-allowed' : 'pointer', transition: 'var(--transition)' }}>
                                  <input type="checkbox" checked={isGranted} onChange={(e) => handlePermissionChange(module, action, e.target.checked)} disabled={isDisabled} style={{ display: 'none' }} />
                                  {isGranted && (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                                  )}
                                </label>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 1rem', opacity: 0.3 }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <p>Select an access control to manage permissions</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
