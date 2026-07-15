'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { getEmployeeById, updateEmployee, changePassword, updateAccountStage, getTodayAttendance, resetPasswordForUser, addSalaryRevision, deactivateEmployee, reactivateEmployee } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import PersonalTab from '@/components/employee-tabs/PersonalTab';
import ProfessionalTab from '@/components/employee-tabs/ProfessionalTab';
import { BankTab, PFTab } from '@/components/employee-tabs/FinanceTabs';
import DocumentsTab from '@/components/employee-tabs/DocumentsTab';
import { DependentsTab, ExitTab, AddressTab, HistoryTab } from '@/components/employee-tabs/OtherTabs';
import {
  PageHeader, Button, Card, StatCard, Avatar, Badge, StatusChip,
  Tabs, DataTable, Field, Select, DateField, TextField, NumberField,
  LoadingBlock, ErrorState, ConfirmDialog, Modal, Textarea,
} from '@/components/ui';
import type { Column, TabItem } from '@/components/ui';

const TABS = ['personal', 'professional', 'bank', 'pf', 'documents', 'dependents', 'exit', 'salary', 'address', 'access', 'history'];
const TAB_ICONS: Record<string, string> = {
  personal: '👤', professional: '💼', bank: '🏦', pf: '🛡️', documents: '📄',
  dependents: '👨‍👩‍👧', exit: '🚪', salary: '💰', address: '🏠', access: '🔐', history: '📝',
};
const TAB_LABELS: Record<string, string> = {
  personal: 'Personal', professional: 'Professional', bank: 'Bank Details', pf: 'PF Details',
  documents: 'Documents', dependents: 'Dependents', exit: 'Exit Details', salary: 'Salary & CTC',
  address: 'Addresses', access: 'Access Control', history: 'Change History',
};

const DEACTIVATION_REASONS = [
  { value: 'RESIGNED', label: 'Resigned' },
  { value: 'TERMINATED', label: 'Terminated' },
  { value: 'CONTRACT_ENDED', label: 'Contract Ended' },
  { value: 'LONG_TERM_INACTIVE', label: 'Long-term Inactive' },
  { value: 'DUPLICATE_TEST_RECORD', label: 'Duplicate/Test Record' },
  { value: 'OTHER', label: 'Other' },
];

export default function EmployeeDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('personal');
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState('');
  const [empStatus, setEmpStatus] = useState<string>('Offline');
  const [resetMsg, setResetMsg] = useState('');
  const [salaryForm, setSalaryForm] = useState({ effectiveDate: '', revisedSalary: '', reason: '', annualCTC: '', bonusPercent: '' });
  const [showSalaryForm, setShowSalaryForm] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [lifecycleSaving, setLifecycleSaving] = useState(false);
  const [lifecycleError, setLifecycleError] = useState('');
  const [lifecycleMsg, setLifecycleMsg] = useState('');
  const [deactivationForm, setDeactivationForm] = useState({ reason: '', effectiveDate: new Date().toISOString().split('T')[0], remarks: '', confirmation: '' });
  const [reactivationRemarks, setReactivationRemarks] = useState('');
  const deactivationReasonRef = useRef<HTMLDivElement | null>(null);
  const deactivationDateRef = useRef<HTMLDivElement | null>(null);
  const deactivationRemarksRef = useRef<HTMLDivElement | null>(null);
  const deactivationConfirmRef = useRef<HTMLDivElement | null>(null);

  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
  const canManageLifecycle = ['SUPER_ADMIN', 'ADMIN', 'HR_ADMIN', 'HR'].includes(user?.role || '');
  const canEdit = isAdmin;
  const shouldMask = !isAdmin;

  useEffect(() => { if (!authLoading && !user) router.push('/'); }, [user, authLoading, router]);
  useEffect(() => { if (user && id) { loadEmployee(); checkStatus(); } }, [user, id]);

  const loadEmployee = async () => {
    setLoading(true);
    try { setEmployee(await getEmployeeById(id)); } catch { } finally { setLoading(false); }
  };

  const checkStatus = async () => {
    try {
      const data = await getTodayAttendance();
      const rec = data?.find?.((a: any) => a.employeeId === id);
      if (rec?.checkIn && !rec?.checkOut) setEmpStatus('Logged In');
      else if (rec?.checkOut) setEmpStatus('Logged Out');
      else { const dow = new Date().getDay(); setEmpStatus(dow === 0 || dow === 6 ? 'Week Off' : 'Not Checked In'); }
    } catch { setEmpStatus('Unknown'); }
  };

  const handleFieldSave = async (key: string, val: string, reason?: string) => {
    try { await updateEmployee(id, { [key]: val, changeReason: reason }); loadEmployee(); } catch { alert('Error saving'); }
  };

  const handlePwChange = async () => {
    if (pwForm.newPw !== pwForm.confirm) { setPwMsg('Passwords do not match'); return; }
    if (pwForm.newPw.length < 6) { setPwMsg('Min 6 characters'); return; }
    try { await changePassword(pwForm.current, pwForm.newPw); setPwMsg('✓ Password changed successfully'); setPwForm({ current: '', newPw: '', confirm: '' }); } catch { setPwMsg('✕ Error: current password incorrect'); }
  };

  const handleStageChange = async (stage: string) => {
    try { await updateAccountStage(id, stage); loadEmployee(); } catch { alert('Error'); }
  };

  const handleSalarySave = async () => {
    try {
      await addSalaryRevision(id, salaryForm);
      setShowSalaryForm(false);
      setSalaryForm({ effectiveDate: '', revisedSalary: '', reason: '', annualCTC: '', bonusPercent: '' });
      loadEmployee();
    } catch { alert('Error updating salary'); }
  };

  const handleRegeneratePassword = async () => {
    setResetting(true);
    try {
      const result = await resetPasswordForUser(employee.user.id);
      setResetMsg(`✓ Password reset. Temporary: ${result.temporaryPassword}`);
    } catch { setResetMsg('✕ Error resetting password'); } finally {
      setResetting(false);
      setConfirmReset(false);
    }
  };

  const resetDeactivateForm = () => {
    setDeactivationForm({ reason: '', effectiveDate: new Date().toISOString().split('T')[0], remarks: '', confirmation: '' });
    setLifecycleError('');
  };

  const focusFirstInvalidDeactivationField = () => {
    const normalizedConfirmation = deactivationForm.confirmation.trim().toUpperCase();
    let target: HTMLDivElement | null = null;
    if (!deactivationForm.reason) target = deactivationReasonRef.current;
    else if (!deactivationForm.effectiveDate) target = deactivationDateRef.current;
    else if (deactivationForm.reason === 'OTHER' && !deactivationForm.remarks.trim()) target = deactivationRemarksRef.current;
    else if (normalizedConfirmation !== 'DEACTIVATE') target = deactivationConfirmRef.current;
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target?.querySelector<HTMLElement>('input, select, textarea')?.focus();
  };

  const handleDeactivate = async () => {
    if (!employee || lifecycleSaving) return;
    const normalizedConfirmation = deactivationForm.confirmation.trim().toUpperCase();
    const requiresRemarks = deactivationForm.reason === 'OTHER';
    const canDeactivate = Boolean(deactivationForm.reason)
      && Boolean(deactivationForm.effectiveDate)
      && normalizedConfirmation === 'DEACTIVATE'
      && (!requiresRemarks || Boolean(deactivationForm.remarks.trim()));
    if (!canDeactivate) {
      focusFirstInvalidDeactivationField();
      return;
    }
    setLifecycleSaving(true);
    setLifecycleError('');
    try {
      const result = await deactivateEmployee(employee.id, {
        ...deactivationForm,
        confirmation: normalizedConfirmation,
      });
      setEmployee(result.employee);
      setLifecycleMsg('Employee deactivated successfully.');
      setShowDeactivateModal(false);
      resetDeactivateForm();
    } catch (err: any) {
      setLifecycleError(err?.response?.data?.error || 'Employee deactivation failed.');
    } finally {
      setLifecycleSaving(false);
    }
  };

  const handleReactivate = async () => {
    if (!employee || lifecycleSaving) return;
    setLifecycleSaving(true);
    setLifecycleError('');
    try {
      const result = await reactivateEmployee(employee.id, { remarks: reactivationRemarks.trim() });
      setEmployee(result.employee);
      setLifecycleMsg('Employee reactivated successfully.');
      setShowReactivateModal(false);
      setReactivationRemarks('');
    } catch (err: any) {
      setLifecycleError(err?.response?.data?.error || 'Employee reactivation failed.');
    } finally {
      setLifecycleSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="app-layout">
        <Sidebar activePath="/employees" />
        <main className="main-content">
          <LoadingBlock label="Loading employee profile..." />
        </main>
      </div>
    );
  }
  if (!employee) {
    return (
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          <div className="glass-card" style={{ padding: '1rem' }}>
            <ErrorState
              title="Employee not found"
              message="This profile may have been removed or you don’t have access."
              onRetry={loadEmployee}
            />
          </div>
        </main>
      </div>
    );
  }

  const fullName = `${employee.firstName} ${employee.lastName}`;
  const presence = empStatus === 'Logged In' ? 'online' : empStatus === 'Week Off' ? 'away' : 'offline';
  const normalizedDeactivationConfirmation = deactivationForm.confirmation.trim().toUpperCase();
  const deactivationRequiresRemarks = deactivationForm.reason === 'OTHER';
  const canDeactivate = Boolean(deactivationForm.reason)
    && Boolean(deactivationForm.effectiveDate)
    && normalizedDeactivationConfirmation === 'DEACTIVATE'
    && (!deactivationRequiresRemarks || Boolean(deactivationForm.remarks.trim()))
    && !lifecycleSaving;
  const deactivationMissingMessage = !deactivationForm.reason
    ? 'Select a deactivation reason.'
    : !deactivationForm.effectiveDate
      ? 'Select an effective date.'
      : deactivationRequiresRemarks && !deactivationForm.remarks.trim()
        ? 'Remarks are required when reason is Other.'
        : normalizedDeactivationConfirmation !== 'DEACTIVATE'
          ? 'Type DEACTIVATE in the confirmation field.'
          : '';

  const tabItems: TabItem[] = TABS.map((tab) => ({
    key: tab,
    label: TAB_LABELS[tab],
    icon: <span aria-hidden="true" style={{ fontSize: '0.9rem' }}>{TAB_ICONS[tab]}</span>,
  }));

  const revisionColumns: Column<any>[] = [
    { key: 'effectiveDate', header: 'Effective Date', render: (r) => new Date(r.effectiveDate).toLocaleDateString() },
    { key: 'previousSalary', header: 'Previous', render: (r) => `₹${r.previousSalary.toLocaleString()}` },
    { key: 'revisedSalary', header: 'Revised', render: (r) => <span style={{ color: 'var(--success-fg)', fontWeight: 600 }}>₹{r.revisedSalary.toLocaleString()}</span> },
    { key: 'reason', header: 'Reason', render: (r) => r.reason || '-' },
  ];

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <PageHeader
          breadcrumb={
            <button className="btn btn-ghost btn-sm" onClick={() => router.push('/employees')} style={{ padding: '0.25rem 0' }}>&larr; Back to Employees</button>
          }
          title={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
              {fullName}
              <Badge tone={presence === 'online' ? 'success' : presence === 'away' ? 'warning' : 'neutral'} dot>{empStatus}</Badge>
            </span>
          }
          subtitle={employee.jobTitle}
          icon={<Avatar name={fullName} src={employee.photoUrl ? `http://localhost:5000/${employee.photoUrl}` : null} size={56} presence={presence} />}
          actions={canManageLifecycle && (
            employee.isActive ? (
              <Button variant="danger" loading={lifecycleSaving} disabled={lifecycleSaving} onClick={() => { setLifecycleMsg(''); resetDeactivateForm(); setShowDeactivateModal(true); }}>
                Deactivate Employee
              </Button>
            ) : (
              <Button variant="success" loading={lifecycleSaving} disabled={lifecycleSaving} onClick={() => { setLifecycleMsg(''); setLifecycleError(''); setShowReactivateModal(true); }}>
                Reactivate Employee
              </Button>
            )
          )}
        />

        {/* Meta chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {employee.department?.name && <Badge tone="neutral">🏢 {employee.department.name}</Badge>}
          <Badge tone="neutral">🆔 {employee.employeeId}</Badge>
          <Badge tone="neutral">📅 {new Date(employee.joinDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Badge>
          <Badge tone={employee.accountStage === 'MANAGER' ? 'compliance' : 'info'}>{employee.accountStage || 'EMPLOYEE'}</Badge>
          <Badge tone={employee.isActive ? 'success' : 'danger'}>{employee.isActive ? 'ACTIVE' : 'INACTIVE'}</Badge>
          {employee.maritalStatus && <Badge tone="neutral">{employee.maritalStatus}</Badge>}
        </div>

        {lifecycleMsg && (
          <div role="status" style={{ marginBottom: '1rem', padding: '0.75rem 1rem', border: '1px solid var(--success-border)', borderRadius: 'var(--radius-md)', background: 'var(--success-bg)', color: 'var(--success-fg)', fontSize: '0.85rem' }}>
            {lifecycleMsg}
          </div>
        )}

        {!employee.isActive && (
          <Card style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              <div className="info-field"><div className="info-field-label">Status</div><div className="info-field-value"><StatusChip status="INACTIVE" /></div></div>
              <div className="info-field"><div className="info-field-label">Reason</div><div className="info-field-value">{employee.deactivationReason?.replace(/_/g, ' ') || '-'}</div></div>
              <div className="info-field"><div className="info-field-label">Effective Date</div><div className="info-field-value">{employee.deactivationEffectiveDate ? new Date(employee.deactivationEffectiveDate).toLocaleDateString('en-IN') : '-'}</div></div>
              <div className="info-field"><div className="info-field-label">Deactivated By</div><div className="info-field-value">{employee.deactivatedBy || '-'}</div></div>
              <div className="info-field"><div className="info-field-label">Deactivated At</div><div className="info-field-value">{employee.deactivatedAt ? new Date(employee.deactivatedAt).toLocaleString('en-IN') : '-'}</div></div>
              {employee.deactivationRemarks && <div className="info-field"><div className="info-field-label">Remarks</div><div className="info-field-value">{employee.deactivationRemarks}</div></div>}
            </div>
          </Card>
        )}

        {/* Tab Navigation */}
        <Tabs items={tabItems} value={activeTab} onChange={setActiveTab} style={{ marginBottom: '1.5rem' }} />

        {/* Tab Content */}
        <div className="glass-card" style={{ padding: '2rem' }}>
          {activeTab === 'personal' && <PersonalTab employee={employee} canEdit={canEdit} onSave={handleFieldSave} shouldMask={shouldMask} />}
          {activeTab === 'professional' && <ProfessionalTab employee={employee} canEdit={canEdit} onSave={handleFieldSave} />}
          {activeTab === 'bank' && <BankTab employee={employee} canEdit={canEdit} shouldMask={shouldMask} onReload={loadEmployee} />}
          {activeTab === 'pf' && <PFTab employee={employee} canEdit={canEdit} shouldMask={shouldMask} onReload={loadEmployee} />}
          {activeTab === 'documents' && <DocumentsTab employee={employee} canEdit={canEdit} onReload={loadEmployee} />}
          {activeTab === 'dependents' && <DependentsTab employee={employee} canEdit={canEdit} onReload={loadEmployee} />}
          {activeTab === 'exit' && <ExitTab employee={employee} canEdit={canEdit} onReload={loadEmployee} />}

          {/* ===== SALARY & CTC TAB ===== */}
          {activeTab === 'salary' && (
            <div>
              <div className="section-header"><h2 className="section-title"><span aria-hidden="true" style={{ fontSize: '1.2rem' }}>💰</span> Salary &amp; CTC</h2></div>
              {/* Salary stat cards */}
              <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <StatCard label="Monthly Salary" value={<span style={{ color: 'var(--success-fg)' }}>₹{employee.salary?.toLocaleString()}</span>} />
                <StatCard label="Annual CTC" value={<span style={{ color: 'var(--trust)' }}>₹{(employee.annualCTC || employee.salary * 12)?.toLocaleString()}</span>} />
                <StatCard label="Bonus (of CTC)" value={`${employee.bonusPercent ?? 0}%`} />
                <StatCard label="PF Status" value={employee.pfDetails ? '✓ Active' : '✕ N/A'} />
              </div>

              {/* Editable salary fields */}
              {canEdit && (
                <div style={{ marginTop: '1.5rem', marginBottom: '2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '0.9rem', color: 'var(--accent)' }}>Update Compensation</h3>
                    <Button
                      size="sm"
                      variant={showSalaryForm ? 'ghost' : 'primary'}
                      onClick={() => { setShowSalaryForm(!showSalaryForm); setSalaryForm({ effectiveDate: new Date().toISOString().split('T')[0], revisedSalary: String(employee.salary || ''), reason: 'Annual Appraisal', annualCTC: String(employee.annualCTC || ''), bonusPercent: String(employee.bonusPercent || '') }); }}
                    >{showSalaryForm ? 'Cancel' : 'Revise Salary'}</Button>
                  </div>
                  {showSalaryForm && (
                    <Card>
                      <div className="form-grid">
                        <DateField label="Effective Date" value={salaryForm.effectiveDate} onChange={v => setSalaryForm({ ...salaryForm, effectiveDate: v })} />
                        <NumberField label="Revised Monthly Salary" value={salaryForm.revisedSalary} onChange={v => setSalaryForm({ ...salaryForm, revisedSalary: v })} />
                        <NumberField label="Annual CTC" value={salaryForm.annualCTC} onChange={v => setSalaryForm({ ...salaryForm, annualCTC: v })} />
                        <NumberField label="Bonus %" value={salaryForm.bonusPercent} onChange={v => setSalaryForm({ ...salaryForm, bonusPercent: v })} />
                        <div style={{ gridColumn: '1 / -1' }}>
                          <TextField label="Reason for Revision" value={salaryForm.reason} onChange={v => setSalaryForm({ ...salaryForm, reason: v })} placeholder="e.g. Annual Appraisal, Promotion" />
                        </div>
                      </div>
                      <Button variant="success" size="sm" style={{ marginTop: '1rem' }} onClick={handleSalarySave}>Confirm Revision</Button>
                    </Card>
                  )}
                </div>
              )}

              <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--accent)' }}>Revision History</h3>
              <DataTable
                columns={revisionColumns}
                rows={employee.salaryRevisions || []}
                rowKey={(r) => r.id}
                emptyTitle="No revision records"
              />
            </div>
          )}

          {/* ===== ADDRESSES TAB ===== */}
          {activeTab === 'address' && <AddressTab employee={employee} canEdit={canEdit} onReload={loadEmployee} />}

          {/* ===== HISTORY TAB ===== */}
          {activeTab === 'history' && isAdmin && <HistoryTab employeeId={employee.id} />}

          {/* ===== ACCESS CONTROL TAB ===== */}
          {activeTab === 'access' && (
            <div>
              <div className="section-header"><h2 className="section-title"><span aria-hidden="true" style={{ fontSize: '1.2rem' }}>🔐</span> Access Control</h2></div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 2rem', marginBottom: '2rem' }}>
                <div className="info-field"><div className="info-field-label">Linked Email</div><div className="info-field-value">{employee.user?.email || 'Not Linked'}</div></div>
                <div className="info-field"><div className="info-field-label">System Role</div><div className="info-field-value"><Badge tone="info">{employee.user?.role || 'N/A'}</Badge></div></div>
                <div className="info-field"><div className="info-field-label">Account Stage</div>
                  <div className="info-field-value">
                    {isAdmin ? (
                      <select className="select-field" style={{ width: 'auto' }} value={employee.accountStage || 'EMPLOYEE'} onChange={e => handleStageChange(e.target.value)}>
                        <option value="EMPLOYEE">Employee</option><option value="MANAGER">Manager</option><option value="ADMIN">Admin</option><option value="INACTIVE">Inactive</option>
                      </select>
                    ) : <Badge tone="compliance">{employee.accountStage || 'EMPLOYEE'}</Badge>}
                  </div>
                </div>
                <div className="info-field"><div className="info-field-label">Account Status</div>
                  <div className="info-field-value">
                    <StatusChip status={employee.isActive ? 'ACTIVE' : 'INACTIVE'} />
                  </div>
                </div>
              </div>

              {/* Password Management */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.5rem' }}>
                {/* Admin: Regenerate password for this employee */}
                {isAdmin && employee.user && (
                  <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}><span aria-hidden="true">🔄</span> Regenerate Password</span>}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Generate a new temporary password for this employee. They must change it on next login.</p>
                    <Button variant="warning" size="sm" onClick={() => setConfirmReset(true)}>Regenerate Password</Button>
                    {resetMsg && <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', background: resetMsg.startsWith('✓') ? 'var(--success-bg)' : 'var(--danger-bg)', color: resetMsg.startsWith('✓') ? 'var(--success-fg)' : 'var(--danger-fg)', fontFamily: 'var(--font-mono, monospace)' }}>{resetMsg}</p>}
                  </Card>
                )}

                {/* Self: Change own password */}
                {user?.id === employee.user?.id && (
                  <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}><span aria-hidden="true">🔑</span> Change Password</span>}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Change your login password below.</p>
                    <Field label="Current Password">
                      <input type="password" className="input-field" value={pwForm.current} onChange={e => setPwForm({ ...pwForm, current: e.target.value })} />
                    </Field>
                    <Field label="New Password">
                      <input type="password" className="input-field" value={pwForm.newPw} onChange={e => setPwForm({ ...pwForm, newPw: e.target.value })} />
                    </Field>
                    <Field label="Confirm New Password">
                      <input type="password" className="input-field" value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} />
                    </Field>
                    <Button size="sm" onClick={handlePwChange} disabled={!pwForm.current || !pwForm.newPw}>Change Password</Button>
                    {pwMsg && <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: pwMsg.startsWith('✓') ? 'var(--success-fg)' : 'var(--danger-fg)' }}>{pwMsg}</p>}
                  </Card>
                )}
              </div>
            </div>
          )}
        </div>

        <Modal
          open={showDeactivateModal}
          onClose={() => !lifecycleSaving && setShowDeactivateModal(false)}
          title="Deactivate Employee"
          width={560}
          footer={
            <>
              <Button variant="ghost" disabled={lifecycleSaving} onClick={() => setShowDeactivateModal(false)}>Cancel</Button>
              <Button variant="danger" loading={lifecycleSaving} disabled={!canDeactivate} onClick={handleDeactivate}>
                Confirm Deactivation
              </Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', padding: '0.75rem', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div className="info-field"><div className="info-field-label">Employee</div><div className="info-field-value">{fullName}</div></div>
              <div className="info-field"><div className="info-field-label">Employee ID</div><div className="info-field-value">{employee.employeeId}</div></div>
              <div className="info-field"><div className="info-field-label">Department</div><div className="info-field-value">{employee.department?.name || '-'}</div></div>
              <div className="info-field"><div className="info-field-label">Current Status</div><div className="info-field-value">{employee.isActive ? 'ACTIVE' : 'INACTIVE'}</div></div>
            </div>
            <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--warning-border)', background: 'var(--warning-bg)', color: 'var(--warning-fg)', fontSize: '0.82rem', lineHeight: 1.5 }}>
              This employee will lose system access and will be removed from active HR operations. Historical records will be preserved.
            </div>
            {lifecycleError && <div role="alert" style={{ color: 'var(--danger-fg)', fontSize: '0.8rem' }}>{lifecycleError}</div>}
            {deactivationMissingMessage && (
              <div role="status" style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', background: 'var(--surface-sunken)', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.55rem 0.65rem' }}>
                {deactivationMissingMessage}
              </div>
            )}
            <div ref={deactivationReasonRef}>
              <Select label="Deactivation Reason" required value={deactivationForm.reason} onChange={v => { setLifecycleError(''); setDeactivationForm({ ...deactivationForm, reason: v }); }} placeholder="Select reason..." options={DEACTIVATION_REASONS} />
            </div>
            <div ref={deactivationDateRef}>
              <DateField label="Effective Date" required value={deactivationForm.effectiveDate} onChange={v => { setLifecycleError(''); setDeactivationForm({ ...deactivationForm, effectiveDate: v }); }} />
            </div>
            <div ref={deactivationRemarksRef}>
              <Textarea label={deactivationForm.reason === 'OTHER' ? 'Remarks' : 'Remarks (optional)'} required={deactivationForm.reason === 'OTHER'} value={deactivationForm.remarks} onChange={v => { setLifecycleError(''); setDeactivationForm({ ...deactivationForm, remarks: v }); }} placeholder="Add handover notes or context" />
            </div>
            <div ref={deactivationConfirmRef}>
              <TextField label="Type DEACTIVATE to confirm" required value={deactivationForm.confirmation} onChange={v => { setLifecycleError(''); setDeactivationForm({ ...deactivationForm, confirmation: v }); }} placeholder="DEACTIVATE" />
            </div>
          </div>
        </Modal>

        <Modal
          open={showReactivateModal}
          onClose={() => !lifecycleSaving && setShowReactivateModal(false)}
          title="Reactivate Employee"
          width={480}
          footer={
            <>
              <Button variant="ghost" disabled={lifecycleSaving} onClick={() => setShowReactivateModal(false)}>Cancel</Button>
              <Button variant="success" loading={lifecycleSaving} disabled={lifecycleSaving} onClick={handleReactivate}>
                Reactivate Employee
              </Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Reactivating this employee will restore the employee profile to active HR operations and re-enable the linked login after the backend update succeeds.
            </p>
            {lifecycleError && <div role="alert" style={{ color: 'var(--danger-fg)', fontSize: '0.8rem' }}>{lifecycleError}</div>}
            <Textarea label="Reactivation Remarks (optional)" value={reactivationRemarks} onChange={setReactivationRemarks} placeholder="Reason for reactivation" />
          </div>
        </Modal>

        <ConfirmDialog
          open={confirmReset}
          title="Regenerate Password"
          message="A new temporary password will be generated for this employee. They must change it on next login. Continue?"
          confirmLabel="Regenerate"
          tone="primary"
          loading={resetting}
          onConfirm={handleRegeneratePassword}
          onCancel={() => setConfirmReset(false)}
        />
      </main>
    </div>
  );
}
