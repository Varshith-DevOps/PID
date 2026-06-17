'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/authContext';
import {
  actionApprovalTask,
  bootstrapPlatform,
  createBranch,
  createLegalEntity,
  createWorkLocation,
  generateComplianceCalendar,
  getApprovalInbox,
  getComplianceObligations,
  getIntegrationConnections,
  getOrganizationSetup,
  getPlatformOverview,
  getPolicyDefinitions,
  getWorkflowDefinitions,
  testIntegrationConnection,
  upsertIntegrationConnection,
} from '@/lib/api';

type TabKey = 'overview' | 'organization' | 'policies' | 'workflows' | 'compliance' | 'integrations';

const tabs: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'organization', label: 'Organization' },
  { key: 'policies', label: 'Policies' },
  { key: 'workflows', label: 'Approvals' },
  { key: 'compliance', label: 'Compliance' },
  { key: 'integrations', label: 'Integrations' },
];

const inputStyle = {
  width: '100%',
  padding: '0.7rem 0.8rem',
  borderRadius: '8px',
  border: '1px solid var(--border-color)',
  background: 'var(--bg-input)',
  color: 'var(--text-primary)',
} as const;

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '1rem',
} as const;

export default function PlatformPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [busy, setBusy] = useState(true);
  const [overview, setOverview] = useState<any>(null);
  const [organization, setOrganization] = useState<any>(null);
  const [policies, setPolicies] = useState<any[]>([]);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [obligations, setObligations] = useState<any[]>([]);
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [legalEntityForm, setLegalEntityForm] = useState({ name: '', code: '', state: '', pan: '', tan: '', pfEstablishmentCode: '', esiEmployerCode: '' });
  const [branchForm, setBranchForm] = useState({ name: '', code: '', state: '' });
  const [locationForm, setLocationForm] = useState({ name: '', city: '', state: '', pincode: '' });
  const [integrationForm, setIntegrationForm] = useState({ displayName: '', provider: 'BIOMETRIC', category: 'ATTENDANCE' });

  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.role === 'HR';

  useEffect(() => {
    if (!loading && (!user || !canManage)) router.push('/dashboard');
  }, [loading, user, canManage, router]);

  useEffect(() => {
    if (user && canManage) loadAll();
  }, [user, canManage]);

  const loadAll = async () => {
    setBusy(true);
    try {
      const [overviewData, orgData, policyData, workflowData, approvalData, obligationData, integrationData] = await Promise.all([
        getPlatformOverview(),
        getOrganizationSetup(),
        getPolicyDefinitions(),
        getWorkflowDefinitions(),
        getApprovalInbox(),
        getComplianceObligations(),
        getIntegrationConnections(),
      ]);
      setOverview(overviewData);
      setOrganization(orgData);
      setPolicies(policyData);
      setWorkflows(workflowData);
      setApprovals(approvalData);
      setObligations(obligationData);
      setIntegrations(integrationData);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const monthYear = useMemo(() => {
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  }, []);

  const handleBootstrap = async () => {
    await bootstrapPlatform();
    await loadAll();
  };

  const handleLegalEntity = async (e: React.FormEvent) => {
    e.preventDefault();
    await createLegalEntity(legalEntityForm);
    setLegalEntityForm({ name: '', code: '', state: '', pan: '', tan: '', pfEstablishmentCode: '', esiEmployerCode: '' });
    await loadAll();
  };

  const handleBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    await createBranch(branchForm);
    setBranchForm({ name: '', code: '', state: '' });
    await loadAll();
  };

  const handleLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    await createWorkLocation(locationForm);
    setLocationForm({ name: '', city: '', state: '', pincode: '' });
    await loadAll();
  };

  const handleComplianceCalendar = async () => {
    await generateComplianceCalendar(monthYear);
    await loadAll();
  };

  const handleIntegration = async (e: React.FormEvent) => {
    e.preventDefault();
    await upsertIntegrationConnection({
      ...integrationForm,
      status: 'ACTIVE',
      config: { mode: 'API', owner: user?.email },
    });
    setIntegrationForm({ displayName: '', provider: 'BIOMETRIC', category: 'ATTENDANCE' });
    await loadAll();
  };

  const handleTask = async (id: string, action: 'APPROVE' | 'REJECT') => {
    await actionApprovalTask(id, { action, comments: `${action} from Platform Command Center` });
    await loadAll();
  };

  if (loading || !user || busy) {
    return <div className="loading-container"><div className="loading-spinner" />Loading...</div>;
  }

  return (
    <div className="app-layout">
      <Sidebar activePath="/platform" />
      <main className="main-content">
        <div className="page-header">
          <div className="page-header-left">
            <div className="page-header-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h10"/><path d="M18 15l2 2 3-4"/></svg>
            </div>
            <div>
              <h1 className="page-title">Platform Command Center</h1>
              <p className="page-subtitle">Organization, policy, workflow, compliance and integration control</p>
            </div>
          </div>
          <button className="btn-primary" onClick={handleBootstrap}>Bootstrap Platform</button>
        </div>

        <div className="glass-card" style={{ padding: '0.6rem', marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={activeTab === tab.key ? 'btn-primary' : 'btn-secondary'}
              style={{ minHeight: '38px' }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <>
            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <div className="stat-card"><div className="stat-card-value text-blue">{overview?.readinessScore || 0}/6</div><div className="stat-card-label">Readiness</div></div>
              <div className="stat-card"><div className="stat-card-value text-success">{organization?.activeEmployees || 0}</div><div className="stat-card-label">Active Employees</div></div>
              <div className="stat-card"><div className="stat-card-value text-warning">{overview?.pendingWorkflowTasks || 0}</div><div className="stat-card-label">Pending Approvals</div></div>
              <div className="stat-card"><div className="stat-card-value text-danger">{overview?.compliance?.overdueCount || 0}</div><div className="stat-card-label">Overdue Compliance</div></div>
            </div>
            <div style={gridStyle}>
              <StatusPanel title="Organization" items={[
                ['Companies', organization?.companies?.length || 0],
                ['Legal entities', organization?.legalEntities?.length || 0],
                ['Branches', organization?.branches?.length || 0],
                ['Locations', organization?.locations?.length || 0],
              ]} />
              <StatusPanel title="Policy Engine" items={[
                ['Active policies', policies.filter((item) => item.status === 'ACTIVE').length],
                ['Leave policies', policies.filter((item) => item.policyType === 'LEAVE').length],
                ['Payroll policies', policies.filter((item) => item.policyType === 'PAYROLL').length],
                ['Attendance policies', policies.filter((item) => item.policyType === 'ATTENDANCE').length],
              ]} />
              <StatusPanel title="Integrations" items={[
                ['Connections', integrations.length],
                ['Active', integrations.filter((item) => item.status === 'ACTIVE').length],
                ['Tested', integrations.filter((item) => item.lastSyncStatus === 'TESTED').length],
                ['Categories', new Set(integrations.map((item) => item.category)).size],
              ]} />
            </div>
          </>
        )}

        {activeTab === 'organization' && (
          <div style={gridStyle}>
            <form className="glass-card" style={{ padding: '1rem' }} onSubmit={handleLegalEntity}>
              <h2 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Legal Entity</h2>
              <FormInput value={legalEntityForm.name} placeholder="Entity name" onChange={(value) => setLegalEntityForm({ ...legalEntityForm, name: value })} />
              <FormInput value={legalEntityForm.code} placeholder="Code" onChange={(value) => setLegalEntityForm({ ...legalEntityForm, code: value })} />
              <FormInput value={legalEntityForm.state} placeholder="State" onChange={(value) => setLegalEntityForm({ ...legalEntityForm, state: value })} />
              <FormInput value={legalEntityForm.pan} placeholder="PAN" onChange={(value) => setLegalEntityForm({ ...legalEntityForm, pan: value })} />
              <FormInput value={legalEntityForm.tan} placeholder="TAN" onChange={(value) => setLegalEntityForm({ ...legalEntityForm, tan: value })} />
              <button className="btn-primary" style={{ width: '100%' }}>Create Entity</button>
            </form>
            <form className="glass-card" style={{ padding: '1rem' }} onSubmit={handleBranch}>
              <h2 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Branch</h2>
              <FormInput value={branchForm.name} placeholder="Branch name" onChange={(value) => setBranchForm({ ...branchForm, name: value })} />
              <FormInput value={branchForm.code} placeholder="Code" onChange={(value) => setBranchForm({ ...branchForm, code: value })} />
              <FormInput value={branchForm.state} placeholder="State" onChange={(value) => setBranchForm({ ...branchForm, state: value })} />
              <button className="btn-primary" style={{ width: '100%' }}>Create Branch</button>
            </form>
            <form className="glass-card" style={{ padding: '1rem' }} onSubmit={handleLocation}>
              <h2 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Work Location</h2>
              <FormInput value={locationForm.name} placeholder="Location name" onChange={(value) => setLocationForm({ ...locationForm, name: value })} />
              <FormInput value={locationForm.city} placeholder="City" onChange={(value) => setLocationForm({ ...locationForm, city: value })} />
              <FormInput value={locationForm.state} placeholder="State" onChange={(value) => setLocationForm({ ...locationForm, state: value })} />
              <FormInput value={locationForm.pincode} placeholder="PIN code" onChange={(value) => setLocationForm({ ...locationForm, pincode: value })} />
              <button className="btn-primary" style={{ width: '100%' }}>Create Location</button>
            </form>
          </div>
        )}

        {activeTab === 'policies' && (
          <DataList items={policies} empty="No policies configured" render={(policy) => (
            <div key={policy.id} className="glass-card" style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1rem' }}>{policy.name}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{policy.description || policy.policyType}</p>
                </div>
                <span className="badge badge-info">{policy.policyType}</span>
              </div>
              <pre style={{ marginTop: '1rem', whiteSpace: 'pre-wrap', color: 'var(--text-muted)', fontSize: '0.75rem' }}>{JSON.stringify(policy.rules, null, 2)}</pre>
            </div>
          )} />
        )}

        {activeTab === 'workflows' && (
          <div style={gridStyle}>
            <div className="glass-card" style={{ padding: '1rem' }}>
              <h2 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Approval Inbox</h2>
              <DataList items={approvals} empty="No pending approvals" render={(task) => (
                <div key={task.id} style={{ padding: '0.85rem 0', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ fontWeight: 700 }}>{task.title}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{task.instance?.title} · {task.assignedRole || 'User'}</div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                    <button className="btn-primary" onClick={() => handleTask(task.id, 'APPROVE')}>Approve</button>
                    <button className="btn-secondary" onClick={() => handleTask(task.id, 'REJECT')}>Reject</button>
                  </div>
                </div>
              )} />
            </div>
            <div className="glass-card" style={{ padding: '1rem' }}>
              <h2 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Workflow Definitions</h2>
              <DataList items={workflows} empty="No workflows configured" render={(workflow) => (
                <div key={workflow.id} style={{ padding: '0.85rem 0', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{workflow.name}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{workflow.module} · {workflow.triggerEvent}</div>
                    </div>
                    <span className="badge badge-neutral">{workflow.steps?.length || 0} steps</span>
                  </div>
                </div>
              )} />
            </div>
          </div>
        )}

        {activeTab === 'compliance' && (
          <>
            <div className="glass-card" style={{ padding: '1rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ fontSize: '1rem' }}>Compliance Calendar</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{monthYear.month}/{monthYear.year}</p>
              </div>
              <button className="btn-primary" onClick={handleComplianceCalendar}>Generate Calendar</button>
            </div>
            <DataList items={obligations} empty="No compliance obligations" render={(item) => (
              <div key={item.id} className="glass-card" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'start' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem' }}>{item.name}</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{item.obligationType} · Due {new Date(item.dueDate).toLocaleDateString('en-IN')}</p>
                  </div>
                  <span className={item.riskLevel === 'HIGH' ? 'badge badge-danger' : 'badge badge-warning'}>{item.status}</span>
                </div>
              </div>
            )} />
          </>
        )}

        {activeTab === 'integrations' && (
          <div style={gridStyle}>
            <form className="glass-card" style={{ padding: '1rem' }} onSubmit={handleIntegration}>
              <h2 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Connection</h2>
              <FormInput value={integrationForm.displayName} placeholder="Display name" onChange={(value) => setIntegrationForm({ ...integrationForm, displayName: value })} />
              <FormInput value={integrationForm.provider} placeholder="Provider" onChange={(value) => setIntegrationForm({ ...integrationForm, provider: value })} />
              <FormInput value={integrationForm.category} placeholder="Category" onChange={(value) => setIntegrationForm({ ...integrationForm, category: value })} />
              <button className="btn-primary" style={{ width: '100%' }}>Save Connection</button>
            </form>
            <div className="glass-card" style={{ padding: '1rem' }}>
              <h2 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Connections</h2>
              <DataList items={integrations} empty="No integrations configured" render={(item) => (
                <div key={item.id} style={{ padding: '0.85rem 0', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{item.displayName}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{item.category} · {item.provider}</div>
                    </div>
                    <button className="btn-secondary" onClick={async () => { await testIntegrationConnection(item.id); await loadAll(); }}>Test</button>
                  </div>
                </div>
              )} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function FormInput({ value, placeholder, onChange }: { value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      style={{ ...inputStyle, marginBottom: '0.7rem' }}
    />
  );
}

function StatusPanel({ title, items }: { title: string; items: [string, number][] }) {
  return (
    <div className="glass-card" style={{ padding: '1rem' }}>
      <h2 style={{ fontSize: '1rem', marginBottom: '1rem' }}>{title}</h2>
      <div style={{ display: 'grid', gap: '0.65rem' }}>
        {items.map(([label, value]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', color: 'var(--text-secondary)' }}>
            <span>{label}</span>
            <strong style={{ color: 'var(--text-primary)' }}>{value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function DataList({ items, empty, render }: { items: any[]; empty: string; render: (item: any) => ReactNode }) {
  if (!items?.length) {
    return <div className="glass-card" style={{ padding: '1rem', color: 'var(--text-muted)' }}>{empty}</div>;
  }
  return <div style={{ display: 'grid', gap: '1rem' }}>{items.map(render)}</div>;
}
