'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { getEmployeeById, updateEmployee, changePassword, updateAccountStage, getTodayAttendance, resetPasswordForUser, addSalaryRevision } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import PersonalTab from '@/components/employee-tabs/PersonalTab';
import ProfessionalTab from '@/components/employee-tabs/ProfessionalTab';
import { BankTab, PFTab } from '@/components/employee-tabs/FinanceTabs';
import DocumentsTab from '@/components/employee-tabs/DocumentsTab';
import { DependentsTab, ExitTab, AddressTab, HistoryTab } from '@/components/employee-tabs/OtherTabs';
import InlineField from '@/components/InlineField';

const TABS = ['personal','professional','bank','pf','documents','dependents','exit','salary','address','access', 'history'];
const TAB_ICONS: Record<string,string> = {
  personal:'👤', professional:'💼', bank:'🏦', pf:'🛡️', documents:'📄',
  dependents:'👨‍👩‍👧', exit:'🚪', salary:'💰', address:'🏠', access:'🔐', history: '📝'
};
const TAB_LABELS: Record<string,string> = {
  personal:'Personal', professional:'Professional', bank:'Bank Details', pf:'PF Details',
  documents:'Documents', dependents:'Dependents', exit:'Exit Details', salary:'Salary & CTC',
  address:'Addresses', access:'Access Control', history: 'Change History'
};

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

  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
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

  if (authLoading || loading) return <div className="loading-container"><div className="loading-spinner" />Loading...</div>;
  if (!employee) return <div className="loading-container">Employee not found</div>;

  const initials = `${employee.firstName?.[0] || ''}${employee.lastName?.[0] || ''}`;
  const statusColor = empStatus === 'Logged In' ? 'var(--success)' : empStatus === 'Week Off' ? 'var(--warning)' : 'var(--text-muted)';

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <button className="btn btn-ghost" onClick={() => router.push('/employees')} style={{ marginBottom: '1rem' }}>&larr; Back</button>

        {/* Profile Header with 3D avatar and live status */}
        <div className="profile-header">
          <div className="avatar-lg" style={{ boxShadow: '0 6px 24px rgba(11,120,144,0.4)', background: 'linear-gradient(135deg, #0B7890, #00A7B5)' }}>
            {employee.photoUrl ? <img src={`http://localhost:5000/${employee.photoUrl}`} alt="" /> : initials}
          </div>
          <div className="profile-info">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className="profile-name">{employee.firstName} {employee.lastName}</div>
              {/* Live status indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.2rem 0.65rem', borderRadius: '999px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, boxShadow: empStatus === 'Logged In' ? '0 0 8px rgba(16,185,129,0.6)' : 'none' }} />
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: statusColor }}>{empStatus}</span>
              </div>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{employee.jobTitle}</p>
            <div className="profile-meta">
              <div className="profile-meta-item">🏢 {employee.department?.name}</div>
              <div className="profile-meta-item">🆔 {employee.employeeId}</div>
              <div className="profile-meta-item">📅 {new Date(employee.joinDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
              <span className={`badge ${employee.accountStage === 'MANAGER' ? 'badge-purple' : 'badge-info'}`}>{employee.accountStage || 'EMPLOYEE'}</span>
              {employee.maritalStatus && <span className="badge badge-neutral">{employee.maritalStatus}</span>}
            </div>
          </div>
        </div>

        {/* 3D Tab Navigation */}
        <div className="tab-group" style={{ marginBottom: '1.5rem', overflowX: 'auto', flexWrap: 'wrap' }}>
          {TABS.map(tab => (
            <button key={tab} className={`tab-btn ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.85rem', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}>{TAB_ICONS[tab]}</span>
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

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
              <div className="section-header"><h2 className="section-title"><span style={{ fontSize: '1.2rem', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))' }}>💰</span> Salary &amp; CTC</h2></div>
              {/* Salary stat cards */}
              <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <div className="stat-card"><div className="stat-card-value" style={{ color: 'var(--success)' }}>₹{employee.salary?.toLocaleString()}</div><div className="stat-card-label">Monthly Salary</div></div>
                <div className="stat-card"><div className="stat-card-value" style={{ color: 'var(--accent-blue)' }}>₹{(employee.annualCTC || employee.salary * 12)?.toLocaleString()}</div><div className="stat-card-label">Annual CTC</div></div>
                <div className="stat-card"><div className="stat-card-value" style={{ color: 'var(--accent-violet)' }}>{employee.bonusPercent ?? 0}%</div><div className="stat-card-label">Bonus (of CTC)</div></div>
                <div className="stat-card"><div className="stat-card-value" style={{ color: 'var(--accent-cyan)' }}>{employee.pfDetails ? '✓ Active' : '✕ N/A'}</div><div className="stat-card-label">PF Status</div></div>
              </div>

              {/* Editable salary fields */}
              {canEdit && (
                <div style={{ marginTop: '1.5rem', marginBottom: '2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '0.9rem', color: 'var(--accent-cyan)' }}>Update Compensation</h3>
                    <button className="btn btn-primary btn-sm" onClick={() => { setShowSalaryForm(!showSalaryForm); setSalaryForm({ effectiveDate: new Date().toISOString().split('T')[0], revisedSalary: String(employee.salary||''), reason: 'Annual Appraisal', annualCTC: String(employee.annualCTC||''), bonusPercent: String(employee.bonusPercent||'') }); }}>{showSalaryForm ? 'Cancel' : 'Revise Salary'}</button>
                  </div>
                  {showSalaryForm && (
                    <div className="glass-card" style={{ padding: '1.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <div className="form-grid">
                        <div className="form-group"><label className="form-label">Effective Date</label><input type="date" className="input-field" value={salaryForm.effectiveDate} onChange={e => setSalaryForm({...salaryForm, effectiveDate: e.target.value})} /></div>
                        <div className="form-group"><label className="form-label">Revised Monthly Salary</label><input type="number" className="input-field" value={salaryForm.revisedSalary} onChange={e => setSalaryForm({...salaryForm, revisedSalary: e.target.value})} /></div>
                        <div className="form-group"><label className="form-label">Annual CTC</label><input type="number" className="input-field" value={salaryForm.annualCTC} onChange={e => setSalaryForm({...salaryForm, annualCTC: e.target.value})} /></div>
                        <div className="form-group"><label className="form-label">Bonus %</label><input type="number" className="input-field" value={salaryForm.bonusPercent} onChange={e => setSalaryForm({...salaryForm, bonusPercent: e.target.value})} /></div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}><label className="form-label">Reason for Revision</label><input type="text" className="input-field" value={salaryForm.reason} onChange={e => setSalaryForm({...salaryForm, reason: e.target.value})} placeholder="e.g. Annual Appraisal, Promotion" /></div>
                      </div>
                      <button className="btn btn-success btn-sm" style={{ marginTop: '1rem' }} onClick={handleSalarySave}>Confirm Revision</button>
                    </div>
                  )}
                </div>
              )}

              <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--accent-cyan)' }}>Revision History</h3>
              {employee.salaryRevisions?.length > 0 ? (
                <table className="data-table">
                  <thead><tr><th>Effective Date</th><th>Previous</th><th>Revised</th><th>Reason</th></tr></thead>
                  <tbody>{employee.salaryRevisions.map((r: any) => (
                    <tr key={r.id}><td>{new Date(r.effectiveDate).toLocaleDateString()}</td><td>₹{r.previousSalary.toLocaleString()}</td><td style={{ color: 'var(--success)', fontWeight: 600 }}>₹{r.revisedSalary.toLocaleString()}</td><td>{r.reason || '-'}</td></tr>
                  ))}</tbody>
                </table>
              ) : <p style={{ color: 'var(--text-muted)' }}>No revision records.</p>}
            </div>
          )}

          {/* ===== ADDRESSES TAB ===== */}
          {activeTab === 'address' && <AddressTab employee={employee} canEdit={canEdit} onReload={loadEmployee} />}

          {/* ===== HISTORY TAB ===== */}
          {activeTab === 'history' && isAdmin && <HistoryTab employeeId={employee.id} />}

          {/* ===== ACCESS CONTROL TAB ===== */}
          {activeTab === 'access' && (
            <div>
              <div className="section-header"><h2 className="section-title"><span style={{ fontSize: '1.2rem', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))' }}>🔐</span> Access Control</h2></div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 2rem', marginBottom: '2rem' }}>
                <div className="info-field"><div className="info-field-label">Linked Email</div><div className="info-field-value">{employee.user?.email || 'Not Linked'}</div></div>
                <div className="info-field"><div className="info-field-label">System Role</div><div className="info-field-value"><span className="badge badge-info">{employee.user?.role || 'N/A'}</span></div></div>
                <div className="info-field"><div className="info-field-label">Account Stage</div>
                  <div className="info-field-value">
                    {isAdmin ? (
                      <select className="select-field" style={{ width: 'auto' }} value={employee.accountStage || 'EMPLOYEE'} onChange={e => handleStageChange(e.target.value)}>
                        <option value="EMPLOYEE">Employee</option><option value="MANAGER">Manager</option><option value="ADMIN">Admin</option><option value="INACTIVE">Inactive</option>
                      </select>
                    ) : <span className="badge badge-purple">{employee.accountStage || 'EMPLOYEE'}</span>}
                  </div>
                </div>
                <div className="info-field"><div className="info-field-label">Account Status</div>
                  <div className="info-field-value">
                    <span className={`badge ${employee.isActive ? 'badge-success' : 'badge-danger'}`}>{employee.isActive ? 'Active' : 'Deactivated'}</span>
                  </div>
                </div>
              </div>

              {/* Password Management */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.5rem' }}>
                {/* Admin: Regenerate password for this employee */}
                {isAdmin && employee.user && (
                  <div className="glass-card" style={{ padding: '1.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}>🔄</span> Regenerate Password
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Generate a new temporary password for this employee. They must change it on next login.</p>
                    <button className="btn btn-warning btn-sm" onClick={async () => {
                      try {
                        const result = await resetPasswordForUser(employee.user.id);
                        setResetMsg(`✓ Password reset. Temporary: ${result.temporaryPassword}`);
                      } catch { setResetMsg('✕ Error resetting password'); }
                    }}>Regenerate Password</button>
                    {resetMsg && <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', padding: '0.5rem 0.75rem', borderRadius: '6px', background: resetMsg.startsWith('✓') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: resetMsg.startsWith('✓') ? 'var(--success)' : 'var(--danger)', fontFamily: 'monospace' }}>{resetMsg}</p>}
                  </div>
                )}

                {/* Self: Change own password */}
                {user?.id === employee.user?.id && (
                  <div className="glass-card" style={{ padding: '1.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}>🔑</span> Change Password
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Change your login password below.</p>
                    <div className="form-group"><label className="form-label">Current Password</label><input type="password" className="input-field" value={pwForm.current} onChange={e => setPwForm({...pwForm, current: e.target.value})} /></div>
                    <div className="form-group"><label className="form-label">New Password</label><input type="password" className="input-field" value={pwForm.newPw} onChange={e => setPwForm({...pwForm, newPw: e.target.value})} /></div>
                    <div className="form-group"><label className="form-label">Confirm New Password</label><input type="password" className="input-field" value={pwForm.confirm} onChange={e => setPwForm({...pwForm, confirm: e.target.value})} /></div>
                    <button className="btn btn-primary btn-sm" onClick={handlePwChange} disabled={!pwForm.current || !pwForm.newPw}>Change Password</button>
                    {pwMsg && <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: pwMsg.startsWith('✓') ? 'var(--success)' : 'var(--danger)' }}>{pwMsg}</p>}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
