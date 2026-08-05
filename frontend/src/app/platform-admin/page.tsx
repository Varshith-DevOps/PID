'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/lib/authContext';
import { isOwnerRole, ownerTabsFor, PLATFORM_STAFF_ROLE_OPTIONS } from '@/lib/platformRoles';
import {
  PageHeader, Card, StatCard, Button, Badge, StatusChip, Tabs, Banner,
  Field, TextField, NumberField, Textarea, Select, Checkbox,
  DataTable, EmptyState, PermissionDenied, ConfirmDialog, SkeletonTable,
} from '@/components/ui';
import type { Column, TabItem } from '@/components/ui';
import {
  getPlatformCompanies,
  createPlatformCompany,
  updatePlatformCompany,
  deletePlatformCompany,
  updatePlatformCompanyStatus,
  getPlatformSubscriptions,
  updatePlatformSubscription,
  getPlatformMetrics,
  getContactRequests,
  deleteContactRequest,
  createCustomPlan,
  verifyCompanyKYC,
  getSupportStaff,
  createSupportStaff,
  setSupportStaffStatus,
  assignSupportCompany,
  revokeSupportCompany,
  updateTenantSubdomain,
  recordTenantPayment,
  runDunningSweep,
  getPlatformAuditLogs,
  getBillingPlans
} from '@/lib/api';
import { Modal } from '@/components/ui';
import { BASE_DOMAIN } from '@/lib/tenant';

interface Company {
  id: string;
  name: string;
  code: string;
  subdomain?: string | null;
  status: string;
  createdAt: string;
  cin?: string | null;
  gstin?: string | null;
  directorName?: string | null;
  directorPan?: string | null;
  directorDin?: string | null;
  signingAuthorityName?: string | null;
  signingAuthorityEmail?: string | null;
  signingAuthorityPhone?: string | null;
  contactPersonName?: string | null;
  contactPersonEmail?: string | null;
  contactPersonPhone?: string | null;
  kycStatus?: string | null;
  kycRemarks?: string | null;
  demoCallScheduledAt?: string | null;
  billingStatus?: string | null;
  graceEndsAt?: string | null;
  subscriptions: {
    plan: {
      name: string;
    };
    endDate: string;
  }[];
}

interface Subscription {
  id: string;
  companyId: string;
  status: string;
  startDate: string;
  endDate: string;
  company: {
    name: string;
  };
  plan: {
    id: string;
    name: string;
  };
}

interface ContactRequest {
  id: string;
  name: string;
  email: string;
  phone: string;
  companyName: string;
  message: string;
  createdAt: string;
}

interface BehaviorRow {
  companyId: string;
  name: string;
  code: string;
  employeeCount: number;
  activeUserCount: number;
  attendanceCount: number;
  leaveCount: number;
  payrollCount: number;
  ticketsCount: number;
}

interface SupportStaff {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  assignments: { companyId: string; companyName: string | null; companyCode: string | null; companyStatus: string | null }[];
}

type TabKey = 'overview' | 'tenants' | 'kyc' | 'subscriptions' | 'leads' | 'custom-plan' | 'support' | 'audit';

const VALID_TABS = ['overview', 'tenants', 'kyc', 'subscriptions', 'leads', 'custom-plan', 'support', 'audit'];

function PlatformAdminPanel() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [contacts, setContacts] = useState<ContactRequest[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [behaviorMetrics, setBehaviorMetrics] = useState<BehaviorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');

  // The URL ?tab= drives the active tab so the Admin Portal sidebar links work.
  const tabParam = searchParams.get('tab');
  useEffect(() => {
    if (tabParam && VALID_TABS.includes(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam as TabKey);
    } else if (!tabParam && activeTab !== 'overview') {
      setActiveTab('overview');
    }
  }, [tabParam, activeTab]);

  const goTab = (key: TabKey) => {
    setActiveTab(key);
    router.replace(`/platform-admin?tab=${key}`, { scroll: false });
  };
  const [kycRemarks, setKycRemarks] = useState<Record<string, string>>({});
  const [extendTarget, setExtendTarget] = useState<string | null>(null);
  const [extending, setExtending] = useState(false);
  const [supportStaff, setSupportStaff] = useState<SupportStaff[]>([]);
  const [staffForm, setStaffForm] = useState({ name: '', email: '', password: '', role: 'SUPPORT' });
  const [creatingStaff, setCreatingStaff] = useState(false);
  const [assignSelection, setAssignSelection] = useState<Record<string, string>>({});
  const [subdomainTarget, setSubdomainTarget] = useState<Company | null>(null);
  const [subdomainValue, setSubdomainValue] = useState('');
  const [savingSubdomain, setSavingSubdomain] = useState(false);
  const [subdomainError, setSubdomainError] = useState('');
  const [payTarget, setPayTarget] = useState<Company | null>(null);
  const [payForm, setPayForm] = useState({ amount: '', months: '1' });
  const [paying, setPaying] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditAction, setAuditAction] = useState('');
  const [auditDays, setAuditDays] = useState('30');
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [tenantForm, setTenantForm] = useState({ 
    id: '', name: '', email: '', phone: '', address: '', industry: '', companySize: '', kycStatus: 'APPROVED',
    adminName: '', adminEmail: '', adminPassword: '', code: '', subdomain: '', planId: '', billingCycle: 'MONTHLY', status: 'ACTIVE'
  });
  const [plans, setPlans] = useState<any[]>([]);

  useEffect(() => {
    getBillingPlans().then(setPlans).catch(() => {});
  }, []);
  const [tenantSaving, setTenantSaving] = useState(false);
  const [customPlanForm, setCustomPlanForm] = useState({
    name: '',
    description: '',
    price: '9999',
    employeeLimit: '100',
    durationDays: '30',
    features: {
      coreHR: true,
      attendance: true,
      leave: true,
      payroll: true,
      performance: true,
      learning: true,
      helpdesk: true,
      aiAgents: true,
      customWorkflows: true,
      apiAccess: true
    }
  });

  useEffect(() => {
    async function loadPlatformAdminDetails() {
      try {
        const [cRes, sRes, leadRes, metricRes] = await Promise.all([
          getPlatformCompanies(),
          getPlatformSubscriptions(),
          getContactRequests(),
          getPlatformMetrics()
        ]);
        setCompanies(cRes);
        setSubscriptions(sRes);
        setContacts(leadRes);
        setMetrics(metricRes.metrics);
        setBehaviorMetrics(metricRes.tenantBehavior || []);
      } catch (err) {
        console.error('Failed to load platform admin details:', err);
      } finally {
        setLoading(false);
      }
    }
    loadPlatformAdminDetails();
  }, []);

  const loadSupportStaff = async () => {
    try {
      setSupportStaff(await getSupportStaff());
    } catch (err) {
      console.error('Failed to load support staff:', err);
    }
  };

  useEffect(() => {
    if (user && ownerTabsFor(user.role).includes('support')) loadSupportStaff();
  }, [user?.role]);

  const handleCreateStaff = async () => {
    if (!staffForm.name.trim() || !staffForm.email.trim() || staffForm.password.length < 8) {
      alert('Name, email, and a password of at least 8 characters are required.');
      return;
    }
    setCreatingStaff(true);
    try {
      await createSupportStaff(staffForm);
      setStaffForm({ name: '', email: '', password: '', role: 'SUPPORT' });
      await loadSupportStaff();
    } catch (err) {
      console.error('Failed to create support staff:', err);
    } finally {
      setCreatingStaff(false);
    }
  };

  const handleAssign = async (staffId: string) => {
    const companyId = assignSelection[staffId];
    if (!companyId) { alert('Select a customer to assign.'); return; }
    try {
      await assignSupportCompany(staffId, companyId);
      setAssignSelection((prev) => ({ ...prev, [staffId]: '' }));
      await loadSupportStaff();
    } catch (err) {
      console.error('Failed to assign tenant:', err);
    }
  };

  const handleRevoke = async (staffId: string, companyId: string) => {
    try {
      await revokeSupportCompany(staffId, companyId);
      await loadSupportStaff();
    } catch (err) {
      console.error('Failed to revoke assignment:', err);
    }
  };

  const handleToggleStaff = async (staffId: string, isActive: boolean) => {
    try {
      await setSupportStaffStatus(staffId, isActive);
      await loadSupportStaff();
    } catch (err) {
      console.error('Failed to update staff status:', err);
    }
  };

  const openSubdomainEditor = (company: Company) => {
    setSubdomainTarget(company);
    setSubdomainValue(company.subdomain || company.code);
    setSubdomainError('');
  };

  const handleSaveSubdomain = async () => {
    if (!subdomainTarget) return;
    setSavingSubdomain(true);
    setSubdomainError('');
    try {
      await updateTenantSubdomain(subdomainTarget.id, subdomainValue.trim().toLowerCase());
      setSubdomainTarget(null);
      // refresh tenant list to show the new subdomain
      setCompanies(await getPlatformCompanies());
    } catch (err: any) {
      setSubdomainError(err?.response?.data?.error || 'Failed to update subdomain.');
    } finally {
      setSavingSubdomain(false);
    }
  };

  const handleCreateCustomPlan = async () => {
    if (!selectedCompanyId) {
      alert('Please select a target company');
      return;
    }
    if (!customPlanForm.name.trim()) {
      alert('Plan name is required');
      return;
    }
    try {
      const payload = {
        name: customPlanForm.name,
        description: customPlanForm.description,
        price: parseFloat(customPlanForm.price),
        employeeLimit: parseInt(customPlanForm.employeeLimit),
        durationDays: parseInt(customPlanForm.durationDays),
        featureLimits: customPlanForm.features
      };

      await createCustomPlan(selectedCompanyId, payload);
      alert('Custom subscription assigned successfully!');

      const [cRes, sRes, metricRes] = await Promise.all([
        getPlatformCompanies(),
        getPlatformSubscriptions(),
        getPlatformMetrics()
      ]);
      setCompanies(cRes);
      setSubscriptions(sRes);
      setMetrics(metricRes.metrics);
      setBehaviorMetrics(metricRes.tenantBehavior || []);

      setSelectedCompanyId('');
      setCustomPlanForm({
        name: '',
        description: '',
        price: '9999',
        employeeLimit: '100',
        durationDays: '30',
        features: {
          coreHR: true,
          attendance: true,
          leave: true,
          payroll: true,
          performance: true,
          learning: true,
          helpdesk: true,
          aiAgents: true,
          customWorkflows: true,
          apiAccess: true
        }
      });
      setActiveTab('tenants');
    } catch (err) {
      console.error(err);
      alert('Failed to assign custom plan');
    }
  };

  const handleStatusChange = async (companyId: string, newStatus: string) => {
    try {
      await updatePlatformCompanyStatus(companyId, newStatus);
      setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, status: newStatus } : c));
    } catch (err) {
      alert('Failed to update tenant status');
    }
  };

  const refreshPlatform = async () => {
    try {
      const [cRes, sRes] = await Promise.all([getPlatformCompanies(), getPlatformSubscriptions()]);
      setCompanies(cRes); setSubscriptions(sRes);
    } catch { /* toast */ }
  };

  const handleSaveTenant = async () => {
    setTenantSaving(true);
    try {
      if (tenantForm.id) {
        await updatePlatformCompany(tenantForm.id, tenantForm);
      } else {
        await createPlatformCompany(tenantForm);
      }
      setShowTenantModal(false);
      setTenantForm({ 
        id: '', name: '', email: '', phone: '', address: '', industry: '', companySize: '', kycStatus: 'APPROVED',
        adminName: '', adminEmail: '', adminPassword: '', code: '', subdomain: '', planId: '', billingCycle: 'MONTHLY', status: 'ACTIVE'
      });
      await refreshPlatform();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save tenant');
    } finally {
      setTenantSaving(false);
    }
  };

  const handleDeleteTenant = async (id: string) => {
    if (!confirm('WARNING: This will permanently delete this tenant and ALL its data (employees, attendance, payroll, etc). Are you absolutely sure?')) return;
    try {
      await deletePlatformCompany(id);
      await refreshPlatform();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete tenant');
    }
  };

  const handleDeleteLead = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    try {
      await deleteContactRequest(id);
      setContacts(prev => prev.filter(c => c.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete lead');
    }
  };

  const handleConvertLead = (lead: ContactRequest) => {
    setTenantForm({
      id: '',
      name: lead.companyName || lead.name,
      email: lead.email,
      phone: lead.phone || '',
      address: '',
      industry: '',
      companySize: '',
      kycStatus: 'APPROVED',
      adminName: '',
      adminEmail: '',
      adminPassword: '',
      code: '',
      subdomain: '',
      planId: '',
      billingCycle: 'MONTHLY',
      status: 'ACTIVE'
    });
    setActiveTab('tenants');
    setShowTenantModal(true);
    // Optionally we can delete the lead after, but for now we just populate the form.
  };

  const handleRecordPayment = async () => {
    if (!payTarget) return;
    setPaying(true);
    try {
      await recordTenantPayment(payTarget.id, {
        amount: payForm.amount ? parseFloat(payForm.amount) : undefined,
        months: parseInt(payForm.months, 10) || 1,
      });
      setPayTarget(null); setPayForm({ amount: '', months: '1' });
      await refreshPlatform();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to record payment');
    } finally { setPaying(false); }
  };

  const loadAudit = async () => {
    setLoadingAudit(true);
    try {
      const r = await getPlatformAuditLogs({ action: auditAction || undefined, days: parseInt(auditDays, 10) || undefined, take: 300 });
      setAuditLogs(r.logs || []);
    } catch { /* toast */ } finally { setLoadingAudit(false); }
  };

  useEffect(() => {
    if (activeTab === 'audit') loadAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, auditDays]);

  const handleRunDunning = async () => {
    setSweeping(true);
    try {
      const r = await runDunningSweep();
      alert(`Dunning sweep: ${r.scanned} scanned · ${r.pastDue} past-due · ${r.suspended} suspended (grace ${r.graceDays}d).`);
      await refreshPlatform();
    } catch { alert('Failed to run dunning sweep'); } finally { setSweeping(false); }
  };

  const handleVerifyKYC = async (companyId: string, status: 'APPROVED' | 'REJECTED' | 'NEEDS_INFO') => {
    try {
      const remarks = kycRemarks[companyId] || '';
      if (status === 'NEEDS_INFO' && !remarks.trim()) {
        alert('Please add a note describing what the tenant needs to provide.');
        return;
      }
      await verifyCompanyKYC(companyId, { status, remarks });
      alert(`Company KYC status updated to ${status} successfully.`);

      const [cRes, sRes, metricRes] = await Promise.all([
        getPlatformCompanies(),
        getPlatformSubscriptions(),
        getPlatformMetrics()
      ]);
      setCompanies(cRes);
      setSubscriptions(sRes);
      setMetrics(metricRes.metrics);
      setBehaviorMetrics(metricRes.tenantBehavior || []);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update KYC status');
    }
  };

  const handleExtendSubscription = async (subId: string, days: number) => {
    setExtending(true);
    try {
      const sub = subscriptions.find(s => s.id === subId);
      if (!sub) return;

      const currentEnd = new Date(sub.endDate);
      const newEnd = new Date(currentEnd.getTime() + days * 24 * 60 * 60 * 1000);

      await updatePlatformSubscription(subId, { endDate: newEnd.toISOString() });
      setSubscriptions(prev => prev.map(s => s.id === subId ? { ...s, endDate: newEnd.toISOString() } : s));
      alert('Subscription extended successfully');
    } catch (err) {
      alert('Failed to extend subscription');
    } finally {
      setExtending(false);
      setExtendTarget(null);
    }
  };

  if (!isOwnerRole(user?.role)) {
    return (
      <PermissionDenied message="Access Denied. This is the platform Admin Portal — owner accounts only." />
    );
  }

  const allowedTabs = new Set(ownerTabsFor(user?.role));
  const tabs: TabItem[] = ([
    { key: 'overview', label: 'Overview' },
    { key: 'tenants', label: 'Tenants' },
    { key: 'kyc', label: `KYC Approvals (${metrics?.pendingKycCount || 0})` },
    { key: 'subscriptions', label: 'Subscriptions' },
    { key: 'leads', label: 'Leads' },
    { key: 'custom-plan', label: 'Custom Plan Builder' },
    { key: 'support', label: 'Platform Staff' },
    { key: 'audit', label: 'Audit Log' },
  ] as TabItem[]).filter((t) => allowedTabs.has(t.key as any));

  const behaviorColumns: Column<BehaviorRow>[] = [
    {
      key: 'name',
      header: 'Tenant Company',
      render: (row) => (
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
          {row.name} <code style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({row.code})</code>
        </span>
      ),
    },
    { key: 'employeeCount', header: 'Employees', render: (row) => <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{row.employeeCount}</span> },
    { key: 'activeUserCount', header: 'Active Users' },
    { key: 'attendanceCount', header: 'Attendance logs' },
    { key: 'leaveCount', header: 'Leave logs' },
    { key: 'payrollCount', header: 'Payroll records', render: (row) => <span style={{ color: 'var(--success-fg)', fontWeight: 600 }}>{row.payrollCount}</span> },
    { key: 'ticketsCount', header: 'Helpdesk tickets' },
  ];

  const tenantColumns: Column<Company>[] = [
    { key: 'name', header: 'Company Name', render: (c) => <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</span> },
    { key: 'code', header: 'Tenant Code', render: (c) => <code>{c.code}</code> },
    {
      key: 'subdomain',
      header: 'Workspace',
      render: (c) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <code style={{ color: 'var(--accent)' }}>{c.subdomain || c.code}.{BASE_DOMAIN}</code>
          <button onClick={() => openSubdomainEditor(c)} title="Edit subdomain" aria-label="Edit subdomain"
            style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, display: 'inline-flex' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
          </button>
        </span>
      ),
    },
    { key: 'createdAt', header: 'Created Date', render: (c) => new Date(c.createdAt).toLocaleDateString() },
    { key: 'plan', header: 'Current Plan', render: (c) => <span style={{ color: 'var(--accent)' }}>{c.subscriptions[0]?.plan?.name || 'No Active Plan'}</span> },
    {
      key: 'billing', header: 'Billing',
      render: (c) => {
        const bs = c.billingStatus || 'CURRENT';
        const tone = bs === 'SUSPENDED_NONPAYMENT' ? 'danger' : bs === 'PAST_DUE' ? 'warning' : 'success';
        const label = bs === 'SUSPENDED_NONPAYMENT' ? 'Past due — suspended' : bs === 'PAST_DUE' ? 'Past due (grace)' : 'Current';
        const paidThrough = c.subscriptions[0]?.endDate ? new Date(c.subscriptions[0].endDate).toLocaleDateString() : '—';
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'flex-start' }}>
            <Badge tone={tone} dot>{label}</Badge>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Paid thru {paidThrough}</span>
            <Button size="sm" variant="ghost" onClick={() => { setPayTarget(c); setPayForm({ amount: '', months: '1' }); }}>Record payment</Button>
          </div>
        );
      },
    },
    { key: 'status', header: 'Account Status', render: (c) => <StatusChip status={c.status} /> },
    {
      key: 'action',
      header: 'Action',
      render: (c) => (
        <select
          className="select-field"
          value={c.status}
          onChange={(e) => handleStatusChange(c.id, e.target.value)}
          style={{ maxWidth: 160 }}
        >
          <option value="ACTIVE">ACTIVE</option>
          <option value="SUSPENDED">SUSPENDED</option>
          <option value="INACTIVE">INACTIVE</option>
        </select>
      ),
    },
  ];

  const subscriptionColumns: Column<Subscription>[] = [
    { key: 'tenant', header: 'Tenant', render: (s) => <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.company.name}</span> },
    { key: 'plan', header: 'Plan', render: (s) => <span style={{ color: 'var(--accent)' }}>{s.plan.name}</span> },
    { key: 'status', header: 'Billing status', render: (s) => <StatusChip status={s.status} /> },
    { key: 'endDate', header: 'Expiry date', render: (s) => new Date(s.endDate).toLocaleDateString() },
    {
      key: 'overrides',
      header: 'Overrides',
      render: (s) => (
        <Button variant="ghost" size="sm" onClick={() => setExtendTarget(s.id)}>Extend 30 Days</Button>
      ),
    },
  ];

  const leadColumns: Column<ContactRequest>[] = [
    { key: 'name', header: 'Name', render: (c) => <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</span> },
    {
      key: 'contact',
      header: 'Email / Phone',
      render: (c) => (
        <div>
          <div>{c.email}</div>
          <div style={{ color: 'var(--text-muted)', marginTop: '2px' }}>{c.phone || 'N/A'}</div>
        </div>
      ),
    },
    { key: 'companyName', header: 'Company', render: (c) => c.companyName || 'N/A' },
    { key: 'message', header: 'Message', render: (c) => <span style={{ color: 'var(--text-secondary)', maxWidth: 250, display: 'inline-block', whiteSpace: 'normal', wordBreak: 'break-word' }}>{c.message}</span> },
    { key: 'createdAt', header: 'Date', render: (c) => new Date(c.createdAt).toLocaleDateString() },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (c) => (
        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
          <Button size="sm" variant="success" onClick={() => handleConvertLead(c)}>Convert to Tenant</Button>
          <Button size="sm" variant="danger" onClick={() => handleDeleteLead(c.id)}>Delete</Button>
        </div>
      )
    }
  ];

  function kycTone(status?: string | null): 'success' | 'danger' | 'warning' {
    if (status === 'APPROVED') return 'success';
    if (status === 'REJECTED') return 'danger';
    return 'warning';
  }

  return (
    <ProtectedRoute>
      <div className="app-layout">
        <Sidebar activePath="/platform-admin" />

        <main className="main-content">
          <PageHeader
            title="Platform Control Center"
            subtitle="Global administrative overview of SaaS operations, billing renewals, and client onboarding."
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4z" /></svg>
            }
          />

          <Card padded={false} style={{ padding: '0.4rem 0.75rem', marginBottom: '1.5rem' }}>
            <Tabs items={tabs} value={activeTab} onChange={(key) => goTab(key as TabKey)} style={{ borderBottom: 'none' }} />
          </Card>

          {loading ? (
            <Card><SkeletonTable rows={6} cols={5} /></Card>
          ) : (
            <div>
              {/* Tab 1: Overview */}
              {activeTab === 'overview' && metrics && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                    <StatCard label="Total Companies" value={metrics.totalTenants} />
                    <StatCard label="Active Subscriptions" value={metrics.activeSubscriptions} />
                    <StatCard label="Pending KYC" value={metrics.pendingKycCount || 0} />
                    <StatCard label="Pending Leads" value={metrics.pendingContactRequests} />
                    <StatCard label="Total Revenue" value={`₹${metrics.totalRevenue.toLocaleString()}`} />
                  </div>

                  {/* Tenant Behavior metrics section */}
                  <Card title="Tenant Behavior & Module Utilization Metrics">
                    <DataTable<BehaviorRow>
                      columns={behaviorColumns}
                      rows={behaviorMetrics}
                      rowKey={(row) => row.companyId}
                      emptyTitle="No tenant utilization statistics loaded."
                    />
                  </Card>
                </div>
              )}

              {/* Tab 2: Tenants */}
              {activeTab === 'tenants' && (
                <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <Button variant="primary" size="sm" onClick={() => {
                    setTenantForm({ 
                      id: '', name: '', email: '', phone: '', address: '', industry: '', companySize: '', kycStatus: 'APPROVED',
                      adminName: '', adminEmail: '', adminPassword: '', code: '', subdomain: '', planId: plans[0]?.id || '', billingCycle: 'MONTHLY', status: 'ACTIVE'
                    });
                    setShowTenantModal(true);
                  }}>Create Tenant</Button>
                  <Button variant="ghost" size="sm" loading={sweeping} onClick={handleRunDunning}>Run dunning sweep</Button>
                </div>
                <DataTable<Company>
                  columns={tenantColumns}
                  rows={companies}
                  rowKey={(c) => c.id}
                  emptyTitle="No tenant companies registered."
                />
                </>
              )}

              {/* Tab 3: KYC Approvals */}
              {activeTab === 'kyc' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {companies.map((c) => (
                    <Card key={c.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                        <div>
                          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{c.name}</h3>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>Tenant Code: <code>{c.code}</code> | Registered: {new Date(c.createdAt).toLocaleDateString()}</span>
                        </div>
                        <Badge tone={kycTone(c.kycStatus)}>{c.kycStatus || 'NOT SUBMITTED'}</Badge>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Identification</span>
                          <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>CIN: <code style={{ color: 'var(--accent)' }}>{c.cin || 'N/A'}</code></div>
                          <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginTop: '2px' }}>GST: <code>{c.gstin || 'N/A'}</code></div>
                        </div>

                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Director Details</span>
                          <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>Name: {c.directorName || 'N/A'}</div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>PAN: {c.directorPan || 'N/A'} | DIN: {c.directorDin || 'N/A'}</div>
                        </div>

                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Contact & Signatory</span>
                          <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>Signatory: {c.signingAuthorityName || 'N/A'}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Contact: {c.contactPersonName || 'N/A'} ({c.contactPersonPhone || 'N/A'})</div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', background: 'var(--surface-sunken)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Scheduled Onboarding Demo Call</span>
                          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--warning-fg)' }}>
                            {c.demoCallScheduledAt ? new Date(c.demoCallScheduledAt).toLocaleString() : 'Not Scheduled'}
                          </div>
                        </div>

                        {c.kycStatus !== 'APPROVED' && (
                          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <input
                              type="text"
                              className="input-field"
                              placeholder="Review remarks/reasons..."
                              value={kycRemarks[c.id] || ''}
                              onChange={(e) => setKycRemarks(prev => ({ ...prev, [c.id]: e.target.value }))}
                              style={{ width: '220px' }}
                            />
                            <Button variant="success" size="sm" onClick={() => handleVerifyKYC(c.id, 'APPROVED')}>Approve</Button>
                            <Button variant="warning" size="sm" onClick={() => handleVerifyKYC(c.id, 'NEEDS_INFO')}>Request Info</Button>
                            <Button variant="danger" size="sm" onClick={() => handleVerifyKYC(c.id, 'REJECTED')}>Reject</Button>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                  {companies.length === 0 && (
                    <EmptyState title="No company compliance records registered on this server." />
                  )}
                </div>
              )}

              {/* Tab 4: Subscriptions */}
              {activeTab === 'subscriptions' && (
                <DataTable<Subscription>
                  columns={subscriptionColumns}
                  rows={subscriptions}
                  rowKey={(s) => s.id}
                  emptyTitle="No subscriptions found."
                />
              )}

              {/* Tab 5: Leads */}
              {activeTab === 'leads' && (
                <DataTable<ContactRequest>
                  columns={leadColumns}
                  rows={contacts}
                  rowKey={(c) => c.id}
                  emptyTitle="No leads captured yet."
                />
              )}

              {/* Tab 6: Custom Plan Builder */}
              {activeTab === 'custom-plan' && (
                <Card style={{ maxWidth: '650px' }}>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Assign Custom Pricing & Feature Set</h2>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <Select
                      label="Target Tenant Company"
                      value={selectedCompanyId}
                      onChange={setSelectedCompanyId}
                      placeholder="-- Select Company --"
                      options={companies.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))}
                    />

                    <TextField
                      label="Plan Name"
                      placeholder="e.g. Enterprise Custom Growth"
                      value={customPlanForm.name}
                      onChange={(v) => setCustomPlanForm({ ...customPlanForm, name: v })}
                    />

                    <Textarea
                      label="Description"
                      placeholder="Details of custom arrangement..."
                      value={customPlanForm.description}
                      onChange={(v) => setCustomPlanForm({ ...customPlanForm, description: v })}
                    />

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                      <NumberField
                        label="Price (INR / month)"
                        decimal
                        placeholder="e.g. 5000"
                        value={customPlanForm.price}
                        onChange={(v) => setCustomPlanForm({ ...customPlanForm, price: v })}
                      />
                      <NumberField
                        label="Employee Limit"
                        placeholder="e.g. 100"
                        value={customPlanForm.employeeLimit}
                        onChange={(v) => setCustomPlanForm({ ...customPlanForm, employeeLimit: v })}
                      />
                      <NumberField
                        label="Duration (Days)"
                        placeholder="e.g. 30"
                        value={customPlanForm.durationDays}
                        onChange={(v) => setCustomPlanForm({ ...customPlanForm, durationDays: v })}
                      />
                    </div>

                    <Field label="Granted Feature Modules">
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', background: 'var(--surface-sunken)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                        {Object.keys(customPlanForm.features).map((featureKey) => (
                          <Checkbox
                            key={featureKey}
                            label={<span style={{ textTransform: 'capitalize' }}>{featureKey.replace(/([A-Z])/g, ' $1').trim()}</span>}
                            checked={(customPlanForm.features as any)[featureKey]}
                            onChange={(checked) => {
                              const newFeatures = { ...customPlanForm.features, [featureKey]: checked };
                              setCustomPlanForm({ ...customPlanForm, features: newFeatures });
                            }}
                          />
                        ))}
                      </div>
                    </Field>

                    <Button variant="primary" fullWidth style={{ marginTop: '0.5rem' }} onClick={handleCreateCustomPlan}>
                      Create & Assign Custom Subscription
                    </Button>
                  </div>
                </Card>
              )}

              {/* Tab 7: Platform Staff (owner-side roles, separation of duties) */}
              {activeTab === 'support' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <Banner tone="info" title="Platform staff & separation of duties">
                    Create owner-side accounts with a specific role. <strong>Compliance</strong> handles KYC,
                    <strong> Billing</strong> handles subscriptions/payments, <strong>Support</strong> gets read-only
                    customer access (assign customers below), and an <strong>Auditor</strong> gets read-only oversight.
                  </Banner>

                  <Card title="Create platform staff">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.2fr auto', gap: '1rem', alignItems: 'end' }}>
                      <TextField label="Name" value={staffForm.name} onChange={(v) => setStaffForm({ ...staffForm, name: v })} placeholder="e.g. Ravi Kumar" />
                      <TextField label="Work Email" value={staffForm.email} onChange={(v) => setStaffForm({ ...staffForm, email: v })} placeholder="ravi@yourco.com" />
                      <TextField label="Temp Password" type="password" value={staffForm.password} onChange={(v) => setStaffForm({ ...staffForm, password: v })} placeholder="min 8 characters" />
                      <Select label="Role" value={staffForm.role} onChange={(v) => setStaffForm({ ...staffForm, role: v })} options={PLATFORM_STAFF_ROLE_OPTIONS} />
                      <Button onClick={handleCreateStaff} loading={creatingStaff}>Create</Button>
                    </div>
                  </Card>

                  <Card title="Platform staff" padded={false}>
                    <DataTable<SupportStaff>
                      columns={[
                        { key: 'name', header: 'Name', render: (s) => <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</span> },
                        { key: 'email', header: 'Email', render: (s) => <span style={{ color: 'var(--text-secondary)' }}>{s.email}</span> },
                        { key: 'role', header: 'Role', render: (s) => <Badge tone={s.role === 'SUPPORT' ? 'info' : s.role === 'AUDITOR' ? 'neutral' : 'success'}>{s.role?.replace(/_/g, ' ')}</Badge> },
                        { key: 'status', header: 'Status', render: (s) => <StatusChip status={s.isActive ? 'ACTIVE' : 'INACTIVE'} /> },
                        {
                          key: 'assign',
                          header: 'Assigned Customers (Support)',
                          render: (s) => {
                            if (s.role !== 'SUPPORT') return <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Platform-wide</span>;
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                  {s.assignments.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>None</span>}
                                  {s.assignments.map((a) => (
                                    <span key={a.companyId} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                      <Badge tone="neutral">{a.companyName || a.companyCode}</Badge>
                                      <button onClick={() => handleRevoke(s.id, a.companyId)} aria-label={`Revoke ${a.companyName}`} title="Revoke access"
                                        style={{ border: 'none', background: 'none', color: 'var(--danger-fg)', cursor: 'pointer', fontWeight: 700, lineHeight: 1 }}>×</button>
                                    </span>
                                  ))}
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                  <select className="select-field" style={{ maxWidth: 200 }} value={assignSelection[s.id] || ''} onChange={(e) => setAssignSelection((prev) => ({ ...prev, [s.id]: e.target.value }))}>
                                    <option value="">-- Assign customer --</option>
                                    {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                  </select>
                                  <Button size="sm" variant="ghost" onClick={() => handleAssign(s.id)}>Assign</Button>
                                </div>
                              </div>
                            );
                          },
                        },
                        {
                          key: 'action',
                          header: '',
                          render: (s) => (
                            <Button size="sm" variant={s.isActive ? 'danger' : 'success'} onClick={() => handleToggleStaff(s.id, !s.isActive)}>
                              {s.isActive ? 'Deactivate' : 'Activate'}
                            </Button>
                          ),
                        },
                      ]}
                      rows={supportStaff}
                      rowKey={(s) => s.id}
                      emptyTitle="No support staff yet"
                      emptyMessage="Create a support account above to grant read-only access to customer tenants."
                    />
                  </Card>
                </div>
              )}

              {/* Tab 8: Audit Log */}
              {activeTab === 'audit' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <Banner tone="neutral" title="Platform audit log">
                    A read-only record of every owner-side action — KYC decisions, tenant suspends, billing,
                    subscriptions, and staff changes — for oversight and accountability.
                  </Banner>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input className="input-field" style={{ maxWidth: 220 }} placeholder="Filter by action (e.g. KYC)" value={auditAction} onChange={(e) => setAuditAction(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadAudit()} />
                    <select className="select-field" style={{ maxWidth: 160 }} value={auditDays} onChange={(e) => setAuditDays(e.target.value)}>
                      <option value="1">Last 24 hours</option>
                      <option value="7">Last 7 days</option>
                      <option value="30">Last 30 days</option>
                      <option value="90">Last 90 days</option>
                      <option value="3650">All time</option>
                    </select>
                    <Button size="sm" variant="ghost" onClick={loadAudit} loading={loadingAudit}>Search</Button>
                  </div>
                  <Card padded={false}>
                    <DataTable<any>
                      loading={loadingAudit}
                      columns={[
                        { key: 'time', header: 'Time', render: (l) => <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{new Date(l.createdAt).toLocaleString()}</span> },
                        { key: 'actor', header: 'Actor', render: (l) => (
                          <div><div style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>{l.userEmail || 'system'}</div>{l.actorRole && <Badge tone="neutral">{String(l.actorRole).replace(/_/g, ' ')}</Badge>}</div>
                        ) },
                        { key: 'action', header: 'Action', render: (l) => <Badge tone="info">{l.action}</Badge> },
                        { key: 'entity', header: 'Target', render: (l) => <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{l.entity}{l.entityId ? ` · ${String(l.entityId).slice(0, 8)}` : ''}</span> },
                        { key: 'details', header: 'Details', render: (l) => <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{[l.oldDetails && `was: ${l.oldDetails}`, l.newDetails && `now: ${l.newDetails}`].filter(Boolean).join('  ').slice(0, 80) || '—'}</span> },
                      ]}
                      rows={auditLogs}
                      rowKey={(l) => l.id}
                      emptyTitle="No audit entries"
                      emptyMessage="Owner-side actions will appear here as they happen."
                    />
                  </Card>
                </div>
              )}

            </div>
          )}

          <ConfirmDialog
            open={!!extendTarget}
            title="Extend subscription"
            message="Extend this subscription by 30 days?"
            confirmLabel="Extend 30 Days"
            tone="primary"
            loading={extending}
            onConfirm={() => extendTarget && handleExtendSubscription(extendTarget, 30)}
            onCancel={() => setExtendTarget(null)}
          />

          <Modal
            open={!!payTarget}
            onClose={() => setPayTarget(null)}
            title="Record payment"
            footer={
              <>
                <Button variant="ghost" onClick={() => setPayTarget(null)}>Cancel</Button>
                <Button loading={paying} onClick={handleRecordPayment}>Record payment</Button>
              </>
            }
          >
            {payTarget && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Record an offline/manual payment for <strong>{payTarget.name}</strong>. This extends their
                  subscription and clears any past-due / non-payment suspension.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label className="form-label">Amount (INR)</label>
                    <input className="input-field" type="number" min="0" placeholder="0" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
                  </div>
                  <div>
                    <label className="form-label">Extend by (months)</label>
                    <input className="input-field" type="number" min="1" value={payForm.months} onChange={(e) => setPayForm({ ...payForm, months: e.target.value })} />
                  </div>
                </div>
              </div>
            )}
          </Modal>

          <Modal
            open={!!subdomainTarget}
            onClose={() => setSubdomainTarget(null)}
            title={`Change workspace subdomain`}
            footer={
              <>
                <Button variant="ghost" onClick={() => setSubdomainTarget(null)}>Cancel</Button>
                <Button onClick={handleSaveSubdomain} loading={savingSubdomain}>Save subdomain</Button>
              </>
            }
          >
            {subdomainTarget && (
              <div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  Set the workspace URL for <strong>{subdomainTarget.name}</strong>. Only the owner team can change this; the tenant cannot.
                </p>
                <label className="form-label">Subdomain</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <input
                    className="input-field"
                    value={subdomainValue}
                    onChange={(e) => setSubdomainValue(e.target.value.toLowerCase())}
                    placeholder="acme"
                    style={{ maxWidth: 220 }}
                    autoFocus
                  />
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>.{BASE_DOMAIN}</span>
                </div>
                {subdomainError && <div style={{ marginTop: '0.75rem' }}><Banner tone="danger">{subdomainError}</Banner></div>}
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
                  3–63 chars; lowercase letters, digits, hyphens. Changing this updates where the tenant signs in.
                </p>
              </div>
            )}
          </Modal>

          <Modal
            open={showTenantModal}
              onClose={() => setShowTenantModal(false)}
              title={tenantForm.id ? "Edit Tenant" : "Create Tenant"}
              footer={
                <>
                  <Button variant="ghost" onClick={() => setShowTenantModal(false)}>Cancel</Button>
                  <Button loading={tenantSaving} onClick={handleSaveTenant}>Save Tenant</Button>
                </>
              }
            >
              <div style={{ display: 'grid', gap: '1rem', maxHeight: '70vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
                <h4 style={{ margin: 0, paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>Company Details</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label className="form-label">Company Name *</label>
                    <input className="input-field" value={tenantForm.name} onChange={e => setTenantForm({ ...tenantForm, name: e.target.value })} placeholder="Acme Corp" />
                  </div>
                  <div>
                    <label className="form-label">Company Size</label>
                    <select className="select-field" value={tenantForm.companySize} onChange={e => setTenantForm({ ...tenantForm, companySize: e.target.value })}>
                      <option value="">Select...</option>
                      <option value="1-10">1-10</option>
                      <option value="11-50">11-50</option>
                      <option value="51-200">51-200</option>
                      <option value="201-500">201-500</option>
                      <option value="500+">500+</option>
                    </select>
                  </div>
                </div>
                {!tenantForm.id && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label className="form-label">Tenant Code</label>
                      <input className="input-field" value={tenantForm.code} onChange={e => setTenantForm({ ...tenantForm, code: e.target.value })} placeholder="ACME" />
                    </div>
                    <div>
                      <label className="form-label">Workspace Subdomain</label>
                      <input className="input-field" value={tenantForm.subdomain} onChange={e => setTenantForm({ ...tenantForm, subdomain: e.target.value })} placeholder="acme" />
                    </div>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label className="form-label">Company Email</label>
                    <input className="input-field" type="email" value={tenantForm.email} onChange={e => setTenantForm({ ...tenantForm, email: e.target.value })} />
                  </div>
                  <div>
                    <label className="form-label">Company Phone</label>
                    <input className="input-field" type="tel" value={tenantForm.phone} onChange={e => setTenantForm({ ...tenantForm, phone: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="form-label">Address</label>
                  <input className="input-field" value={tenantForm.address} onChange={e => setTenantForm({ ...tenantForm, address: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Industry</label>
                  <input className="input-field" value={tenantForm.industry} onChange={e => setTenantForm({ ...tenantForm, industry: e.target.value })} />
                </div>

                {!tenantForm.id && (
                  <>
                    <h4 style={{ margin: '1rem 0 0 0', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>Company Admin Setup</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label className="form-label">Admin Name *</label>
                        <input className="input-field" value={tenantForm.adminName} onChange={e => setTenantForm({ ...tenantForm, adminName: e.target.value })} placeholder="Jane Doe" />
                      </div>
                      <div>
                        <label className="form-label">Admin Email (Login) *</label>
                        <input className="input-field" type="email" value={tenantForm.adminEmail} onChange={e => setTenantForm({ ...tenantForm, adminEmail: e.target.value })} placeholder="jane@acme.com" />
                      </div>
                    </div>
                    <div>
                      <label className="form-label">Admin Password *</label>
                      <input className="input-field" type="password" value={tenantForm.adminPassword} onChange={e => setTenantForm({ ...tenantForm, adminPassword: e.target.value })} placeholder="••••••••" />
                    </div>

                    <h4 style={{ margin: '1rem 0 0 0', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>Subscription Setup</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label className="form-label">Subscription Plan</label>
                        <select className="select-field" value={tenantForm.planId} onChange={e => setTenantForm({ ...tenantForm, planId: e.target.value })}>
                          {plans.map(p => <option key={p.id} value={p.id}>{p.name} - ₹{p.priceMonthly}/mo</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="form-label">Billing Cycle</label>
                        <select className="select-field" value={tenantForm.billingCycle} onChange={e => setTenantForm({ ...tenantForm, billingCycle: e.target.value })}>
                          <option value="MONTHLY">Monthly</option>
                          <option value="ANNUAL">Annual</option>
                        </select>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </Modal>
        </main>
      </div>
    </ProtectedRoute>
  );
}

export default function PlatformAdminPage() {
  return (
    <Suspense fallback={null}>
      <PlatformAdminPanel />
    </Suspense>
  );
}
