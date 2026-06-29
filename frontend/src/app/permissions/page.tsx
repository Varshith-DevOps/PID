'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import {
  getAllPermissions, getRolePermissions, updateRolePermissions, resetRolePermissions,
  updateUserRole, updateUserPermissions, resetPermissions, addCustomModule,
  getCustomModules, deleteCustomModule,
} from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import {
  PageHeader, Card, Badge, Button, Checkbox, Select, Tabs, Drawer, ConfirmDialog,
  DataTable, EmptyState, LoadingBlock, Banner, Avatar, FilterBar, SearchInput,
} from '@/components/ui';
import type { Column, TabItem } from '@/components/ui';

const ACTIONS = ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'EXPORT'];

interface Perm { module: string; action: string; isGranted: boolean }
interface OrgUser {
  id: string; name: string; email: string; role: string; isActive: boolean;
  permissions: Perm[];
  employee?: { jobTitle?: string; employeeId?: string; department?: { name?: string } } | null;
}
interface RolePermission { id: string; role: string; name: string; description?: string; permissions: Perm[] }
interface AssignableRole { role: string; name: string; description: string }

function roleTone(role: string): 'danger' | 'warning' | 'info' | 'success' | 'neutral' {
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') return 'warning';
  if (role === 'MANAGER' || role === 'HR') return 'info';
  if (role.startsWith('PAYROLL') || role === 'FINANCE' || role === 'ACCOUNTS') return 'success';
  return 'neutral';
}

export default function AccessControlPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<'users' | 'roles'>('users');

  // User Access state
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [assignableRoles, setAssignableRoles] = useState<AssignableRole[]>([]);
  const [search, setSearch] = useState('');
  const [roleChange, setRoleChange] = useState<{ u: OrgUser; role: string } | null>(null);
  const [savingRole, setSavingRole] = useState(false);

  // Role catalog state
  const [roles, setRoles] = useState<RolePermission[]>([]);
  const [selectedRole, setSelectedRole] = useState<RolePermission | null>(null);
  const [savingRoleDefaults, setSavingRoleDefaults] = useState(false);
  const [resetTarget, setResetTarget] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [newModule, setNewModule] = useState('');
  const [newModuleDesc, setNewModuleDesc] = useState('');
  const [addingModule, setAddingModule] = useState(false);
  const [customModules, setCustomModules] = useState<{ id: string; key: string; label: string; description?: string }[]>([]);
  const [removeModuleTarget, setRemoveModuleTarget] = useState<string | null>(null);

  // Per-user customize drawer
  const [customizeUser, setCustomizeUser] = useState<OrgUser | null>(null);
  const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>>>({});
  const [savingUserPerms, setSavingUserPerms] = useState(false);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  useEffect(() => {
    if (!loading && (!user || !canManage)) router.push('/dashboard');
  }, [user, loading, canManage, router]);

  useEffect(() => {
    if (user && canManage) loadAll();
  }, [user]);

  const loadAll = async () => {
    try {
      const [access, roleData, custom] = await Promise.all([getAllPermissions(), getRolePermissions(), getCustomModules()]);
      setUsers(access.users || []);
      setModules(access.modules || []);
      setAssignableRoles(access.assignableRoles || []);
      setRoles(roleData.roles || []);
      setCustomModules(custom.custom || []);
      setSelectedRole((cur) => roleData.roles?.find((r: RolePermission) => r.id === cur?.id) || roleData.roles?.[0] || null);
    } catch {
      /* surfaced via toast */
    }
  };

  const customKeys = useMemo(() => new Set(customModules.map((m) => m.key)), [customModules]);

  const handleAddModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModule.trim()) return;
    setAddingModule(true);
    try {
      await addCustomModule(newModule.trim(), newModuleDesc.trim() || undefined);
      setNewModule(''); setNewModuleDesc('');
      await loadAll();
    } catch { /* toast */ } finally { setAddingModule(false); }
  };

  const doRemoveModule = async (key: string) => {
    try { await deleteCustomModule(key); await loadAll(); } catch { /* toast */ } finally { setRemoveModuleTarget(null); }
  };

  // ── Role assignment ──────────────────────────────────────────────────────
  const confirmRoleChange = async () => {
    if (!roleChange) return;
    setSavingRole(true);
    try {
      await updateUserRole(roleChange.u.id, roleChange.role);
      setRoleChange(null);
      await loadAll();
    } catch { /* toast */ } finally { setSavingRole(false); }
  };

  // ── Per-user permission customization ───────────────────────────────────
  const roleBaseline = (role: string) => roles.find((r) => r.role === role)?.permissions || [];

  const openCustomize = (u: OrgUser) => {
    const base = roleBaseline(u.role);
    const m: Record<string, Record<string, boolean>> = {};
    for (const mod of modules) {
      m[mod] = {};
      for (const act of ACTIONS) {
        const explicit = u.permissions.find((p) => p.module === mod && p.action === act);
        const baseP = base.find((p) => p.module === mod && p.action === act);
        m[mod][act] = explicit ? explicit.isGranted : baseP ? baseP.isGranted : false;
      }
    }
    setMatrix(m);
    setCustomizeUser(u);
  };

  const toggleMatrix = (mod: string, act: string, val: boolean) =>
    setMatrix((prev) => ({ ...prev, [mod]: { ...prev[mod], [act]: val } }));

  const saveUserPerms = async () => {
    if (!customizeUser) return;
    setSavingUserPerms(true);
    const perms: Perm[] = [];
    for (const mod of modules) for (const act of ACTIONS) perms.push({ module: mod, action: act, isGranted: matrix[mod]?.[act] || false });
    try {
      await updateUserPermissions(customizeUser.id, perms);
      setCustomizeUser(null);
      await loadAll();
    } catch { /* toast */ } finally { setSavingUserPerms(false); }
  };

  const resetUserToRole = async (u: OrgUser) => {
    try { await resetPermissions(u.id); setCustomizeUser(null); await loadAll(); } catch { /* toast */ }
  };

  // ── Role-defaults editor (super admin only) ─────────────────────────────
  const toggleRoleDefault = (module: string, action: string, isGranted: boolean) => {
    if (!selectedRole) return;
    const updated = { ...selectedRole, permissions: selectedRole.permissions.map((p) => (p.module === module && p.action === action ? { ...p, isGranted } : p)) };
    if (!selectedRole.permissions.some((p) => p.module === module && p.action === action)) {
      updated.permissions = [...selectedRole.permissions, { module, action, isGranted }];
    }
    setSelectedRole(updated);
    setRoles(roles.map((r) => (r.id === updated.id ? updated : r)));
  };
  const saveRoleDefaults = async () => {
    if (!selectedRole) return;
    setSavingRoleDefaults(true);
    try { await updateRolePermissions(selectedRole.role, selectedRole.permissions); } catch { /* toast */ } finally { setSavingRoleDefaults(false); }
  };
  const doResetRole = async (role: string) => {
    setResetting(true);
    try { await resetRolePermissions(role); await loadAll(); } catch { /* toast */ } finally { setResetting(false); setResetTarget(null); }
  };

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(q));
  }, [users, search]);

  if (loading || !user || !canManage) return <LoadingBlock />;

  const tabs: TabItem[] = [
    { key: 'users', label: 'User Access' },
    { key: 'roles', label: 'Roles & Functions' },
  ];

  const userColumns: Column<OrgUser>[] = [
    {
      key: 'user', header: 'User',
      render: (u) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Avatar name={u.name} size={32} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.name}</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{u.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'title', header: 'Role in company',
      render: (u) => (
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
          {u.employee?.jobTitle || '—'}{u.employee?.department?.name ? ` · ${u.employee.department.name}` : ''}
        </span>
      ),
    },
    {
      key: 'role', header: 'System role',
      render: (u) => {
        const isSelf = u.id === user.id;
        const editable = canManage && !isSelf;
        if (!editable) {
          return <Badge tone={roleTone(u.role)}>{u.role.replace(/_/g, ' ')}</Badge>;
        }
        return (
          <select
            className="select-field"
            style={{ maxWidth: 190 }}
            value={u.role}
            onChange={(e) => setRoleChange({ u, role: e.target.value })}
          >
            {!assignableRoles.some((r) => r.role === u.role) && <option value={u.role}>{u.role.replace(/_/g, ' ')}</option>}
            {assignableRoles.map((r) => <option key={r.role} value={r.role}>{r.name}</option>)}
          </select>
        );
      },
    },
    {
      key: 'actions', header: '', align: 'right',
      render: (u) => (
        <Button size="sm" variant="ghost" onClick={() => openCustomize(u)} disabled={u.role === 'SUPER_ADMIN'}>
          Customize access
        </Button>
      ),
    },
  ];

  const roleMatrixColumns: Column<{ module: string }>[] = [
    { key: 'module', header: 'Module', render: (row) => (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: 'var(--text-primary)' }}>
        {row.module}{customKeys.has(row.module) && <Badge tone="info">custom</Badge>}
      </span>
    ) },
    ...ACTIONS.map((action) => ({
      key: action, header: action, align: 'center' as const,
      render: (row: { module: string }) => {
        const perm = selectedRole?.permissions.find((p) => p.module === row.module && p.action === action);
        return (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Checkbox label="" checked={perm?.isGranted ?? false} disabled={!isSuperAdmin}
              onChange={(c) => toggleRoleDefault(row.module, action, c)} />
          </div>
        );
      },
    })),
  ];

  return (
    <div className="app-layout">
      <Sidebar activePath="/permissions" />
      <main className="main-content">
        <PageHeader
          title="Access Control"
          subtitle="Manage who can do what across your organization"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>}
        />

        <div style={{ marginBottom: '1.25rem' }}><Tabs items={tabs} value={tab} onChange={(k) => setTab(k as 'users' | 'roles')} /></div>

        {tab === 'users' && (
          <>
            <Banner tone="info" title="Assign roles to control access">
              Each user’s <strong>system role</strong> decides which modules they can use. Change a role
              from the dropdown, or click <strong>Customize access</strong> to fine-tune one person’s
              permissions. Changing a role signs that user out so the new access applies.
            </Banner>
            <div style={{ marginTop: '1rem' }}>
              <FilterBar>
                <SearchInput value={search} onChange={setSearch} placeholder="Search people…" />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{filteredUsers.length} users</span>
              </FilterBar>
              <DataTable<OrgUser> columns={userColumns} rows={filteredUsers} rowKey={(u) => u.id}
                emptyTitle="No users yet" emptyMessage="Add employees to your organization to manage their access." />
            </div>
          </>
        )}

        {tab === 'roles' && (
          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.25rem' }}>
            <Card>
              <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.75rem' }}>Roles</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '60vh', overflowY: 'auto' }}>
                {roles.map((r) => {
                  const active = selectedRole?.id === r.id;
                  return (
                    <button key={r.id} onClick={() => setSelectedRole(r)}
                      style={{ textAlign: 'left', border: 'none', background: active ? 'var(--accent-soft)' : 'transparent', borderRadius: 'var(--radius-sm)', padding: '0.6rem 0.7rem', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem', color: active ? 'var(--accent)' : 'var(--text-primary)' }}>{r.name}</span>
                        <Badge tone={roleTone(r.role)}>{r.role.replace(/_/g, ' ')}</Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
              {canManage && (
                <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <label className="form-label" style={{ margin: 0 }}>Custom modules</label>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{customModules.length}</span>
                  </div>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0 0 0.6rem', lineHeight: 1.45 }}>
                    Access scopes unique to your organization. They appear in the matrix and can be granted per user.
                  </p>
                  {customModules.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.6rem' }}>
                      {customModules.map((m) => (
                        <div key={m.id} title={m.description || ''} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.55rem', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)' }}>
                          <code style={{ fontSize: '0.72rem', color: 'var(--text-primary)' }}>{m.key}</code>
                          <button onClick={() => setRemoveModuleTarget(m.key)} aria-label={`Delete ${m.key}`}
                            style={{ border: 'none', background: 'none', color: 'var(--danger-fg)', cursor: 'pointer', fontWeight: 700, lineHeight: 1 }}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <form onSubmit={handleAddModule} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <input className="input-field" placeholder="Module name e.g. Inventory" value={newModule} onChange={(e) => setNewModule(e.target.value)} />
                    <input className="input-field" placeholder="Description (optional)" value={newModuleDesc} onChange={(e) => setNewModuleDesc(e.target.value)} />
                    <Button type="submit" size="sm" fullWidth loading={addingModule}>Add module</Button>
                  </form>
                </div>
              )}
            </Card>

            <Card>
              {selectedRole ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ maxWidth: 620 }}>
                      <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{selectedRole.name}</h2>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.35rem', lineHeight: 1.5 }}>{selectedRole.description}</p>
                    </div>
                    {isSuperAdmin ? (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Button variant="warning" size="sm" onClick={() => setResetTarget(selectedRole.role)}>Reset</Button>
                        <Button size="sm" loading={savingRoleDefaults} onClick={saveRoleDefaults}>Save defaults</Button>
                      </div>
                    ) : (
                      <Badge tone="neutral">Reference — defaults set by platform</Badge>
                    )}
                  </div>
                  <DataTable<{ module: string }> columns={roleMatrixColumns} rows={modules.map((m) => ({ module: m }))} rowKey={(r) => r.module} emptyTitle="No modules" />
                </>
              ) : <EmptyState title="Select a role" message="Pick a role to see what it can do." />}
            </Card>
          </div>
        )}

        {/* Role change confirmation */}
        <ConfirmDialog
          open={!!roleChange}
          title="Change system role"
          message={roleChange ? `Make ${roleChange.u.name} a ${assignableRoles.find((r) => r.role === roleChange.role)?.name || roleChange.role}? Their current per-user permissions reset to the new role's defaults, and they'll be signed out so the change applies.` : ''}
          confirmLabel="Change role"
          loading={savingRole}
          onConfirm={confirmRoleChange}
          onCancel={() => setRoleChange(null)}
        />

        {/* Role-defaults reset (super admin) */}
        <ConfirmDialog open={!!resetTarget} title="Reset role defaults" message="Reset this role to the built-in defaults? This affects every user with the role." confirmLabel="Reset" tone="danger" loading={resetting} onConfirm={() => resetTarget && doResetRole(resetTarget)} onCancel={() => setResetTarget(null)} />

        {/* Custom module removal */}
        <ConfirmDialog
          open={!!removeModuleTarget}
          title="Delete custom module"
          message={`Delete the "${removeModuleTarget}" module? Any grants for it across your organization are removed too.`}
          confirmLabel="Delete module"
          tone="danger"
          onConfirm={() => removeModuleTarget && doRemoveModule(removeModuleTarget)}
          onCancel={() => setRemoveModuleTarget(null)}
        />

        {/* Per-user customize drawer */}
        <Drawer open={!!customizeUser} onClose={() => setCustomizeUser(null)} width={520}
          title={customizeUser ? `Customize access — ${customizeUser.name}` : ''}
          footer={customizeUser && (
            <>
              <Button variant="ghost" onClick={() => resetUserToRole(customizeUser)}>Reset to role default</Button>
              <Button loading={savingUserPerms} onClick={saveUserPerms}>Save</Button>
            </>
          )}
        >
          {customizeUser && (
            <>
              <Banner tone="neutral">
                Overrides just this person on top of the <strong>{customizeUser.role.replace(/_/g, ' ')}</strong> role.
                Leave it on the role defaults unless they need something specific.
              </Banner>
              <div className="table-container" style={{ marginTop: '1rem' }}>
                <table className="data-table">
                  <thead><tr><th>Module</th>{ACTIONS.map((a) => <th key={a} style={{ textAlign: 'center' }}>{a}</th>)}</tr></thead>
                  <tbody>
                    {modules.map((mod) => (
                      <tr key={mod}>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>{mod}{customKeys.has(mod) && <Badge tone="info">custom</Badge>}</span>
                        </td>
                        {ACTIONS.map((act) => (
                          <td key={act} style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                              <Checkbox label="" checked={matrix[mod]?.[act] || false} onChange={(c) => toggleMatrix(mod, act, c)} />
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Drawer>
      </main>
    </div>
  );
}
