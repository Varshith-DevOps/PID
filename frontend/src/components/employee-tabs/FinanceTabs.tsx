'use client';
import { useState } from 'react';
import InlineField from '@/components/InlineField';
import { validateForm, required, ifsc, bankAccount, uan } from '@/lib/validators';
import { upsertBankDetails, upsertPFDetails } from '@/lib/api';
import { Button, TextField, Select, DateField, ConfirmDialog } from '@/components/ui';

export function BankTab({ employee, canEdit, shouldMask, onReload }: any) {
  const bank = employee.bankDetails;
  const [editing, setEditing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ bankName: bank?.bankName || '', accountNumber: bank?.accountNumber || '', ifscCode: bank?.ifscCode || '', branchName: bank?.branchName || '', accountType: bank?.accountType || 'SAVINGS' });

  const handleSave = () => {
    setSubmitted(true);
    const { isValid } = validateForm(
      { bankName: form.bankName, accountNumber: form.accountNumber, ifscCode: form.ifscCode },
      { bankName: required('Bank name'), accountNumber: bankAccount, ifscCode: ifsc }
    );
    if (!isValid) { alert('Please correct the highlighted fields.'); return; }
    setConfirmOpen(true);
  };

  const handleConfirm = async (reason?: string) => {
    setSaving(true);
    try { await upsertBankDetails(employee.id, { ...form, changeReason: reason }); setConfirmOpen(false); setEditing(false); onReload(); } catch { alert('Error saving'); } finally { setSaving(false); }
  };

  if (editing) {
    return (
      <div>
        <div className="section-header"><h2 className="section-title">Bank Details</h2></div>
        <div className="form-grid">
          <TextField label="Bank Name" required value={form.bankName} onChange={v => setForm({ ...form, bankName: v })} validator={required('Bank name')} forceError={submitted} />
          <TextField label="Account Number" required value={form.accountNumber} onChange={v => setForm({ ...form, accountNumber: v })} validator={bankAccount} restrict="digits" maxLength={18} forceError={submitted} />
          <TextField label="IFSC Code" required value={form.ifscCode} onChange={v => setForm({ ...form, ifscCode: v })} validator={ifsc} restrict="upperAlnum" maxLength={11} forceError={submitted} />
          <TextField label="Branch Name" value={form.branchName} onChange={v => setForm({ ...form, branchName: v })} />
          <Select label="Account Type" value={form.accountType} onChange={v => setForm({ ...form, accountType: v })} options={[{ value: 'SAVINGS', label: 'Savings' }, { value: 'CURRENT', label: 'Current' }]} />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <Button size="sm" onClick={handleSave}>Save</Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
        <ConfirmDialog
          open={confirmOpen}
          title="Update Bank Details"
          message="Provide a reason for updating these bank details."
          requireReason
          reasonLabel="Reason for updating Bank Details"
          confirmLabel="Save"
          loading={saving}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmOpen(false)}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="section-header"><h2 className="section-title">Bank Details</h2>{canEdit && <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>✎ Edit</Button>}</div>
      {bank ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 2rem' }}>
          <InlineField label="Bank Name" value={bank.bankName} fieldKey="" canEdit={false} onSave={() => {}} />
          <InlineField label="Account Number" value={bank.accountNumber} fieldKey="" canEdit={false} onSave={() => {}} masked={shouldMask} maskType="account" />
          <InlineField label="IFSC Code" value={bank.ifscCode} fieldKey="" canEdit={false} onSave={() => {}} />
          <InlineField label="Branch" value={bank.branchName} fieldKey="" canEdit={false} onSave={() => {}} />
          <InlineField label="Account Type" value={bank.accountType} fieldKey="" canEdit={false} onSave={() => {}} />
        </div>
      ) : <p style={{ color: 'var(--text-muted)' }}>No bank details recorded.{canEdit && ' Click Edit to add.'}</p>}
    </div>
  );
}

export function PFTab({ employee, canEdit, shouldMask, onReload }: any) {
  const pf = employee.pfDetails;
  const [editing, setEditing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ pfNumber: pf?.pfNumber || '', uanNumber: pf?.uanNumber || '', epsNumber: pf?.epsNumber || '', pfJoinDate: pf?.pfJoinDate?.split('T')[0] || '', voluntaryPF: pf?.voluntaryPF || false, vpfPercentage: pf?.vpfPercentage || '' });

  const handleSave = () => {
    setSubmitted(true);
    const { isValid } = validateForm(
      { uanNumber: form.uanNumber },
      { uanNumber: uan }
    );
    if (!isValid) { alert('Please correct the highlighted fields.'); return; }
    setConfirmOpen(true);
  };

  const handleConfirm = async (reason?: string) => {
    setSaving(true);
    try { await upsertPFDetails(employee.id, { ...form, changeReason: reason }); setConfirmOpen(false); setEditing(false); onReload(); } catch { alert('Error saving'); } finally { setSaving(false); }
  };

  if (editing) {
    return (
      <div>
        <div className="section-header"><h2 className="section-title">PF Details</h2></div>
        <div className="form-grid">
          <TextField label="PF Number" value={form.pfNumber} onChange={v => setForm({ ...form, pfNumber: v })} />
          <TextField label="UAN Number" value={form.uanNumber} onChange={v => setForm({ ...form, uanNumber: v })} validator={uan} restrict="digits" maxLength={12} forceError={submitted} />
          <TextField label="EPS Number" value={form.epsNumber} onChange={v => setForm({ ...form, epsNumber: v })} restrict="digits" />
          <DateField label="PF Join Date" value={form.pfJoinDate} onChange={v => setForm({ ...form, pfJoinDate: v })} />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <Button size="sm" onClick={handleSave}>Save</Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
        <ConfirmDialog
          open={confirmOpen}
          title="Update PF Details"
          message="Provide a reason for updating these PF details."
          requireReason
          reasonLabel="Reason for updating PF Details"
          confirmLabel="Save"
          loading={saving}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmOpen(false)}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="section-header"><h2 className="section-title">PF Details</h2>{canEdit && <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>✎ Edit</Button>}</div>
      {pf ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 2rem' }}>
          <InlineField label="PF Number" value={pf.pfNumber} fieldKey="" canEdit={false} onSave={() => {}} masked={shouldMask} maskType="pf" />
          <InlineField label="UAN Number" value={pf.uanNumber} fieldKey="" canEdit={false} onSave={() => {}} masked={shouldMask} maskType="pf" />
          <InlineField label="EPS Number" value={pf.epsNumber} fieldKey="" canEdit={false} onSave={() => {}} masked={shouldMask} maskType="pf" />
          <InlineField label="PF Join Date" value={pf.pfJoinDate ? new Date(pf.pfJoinDate).toLocaleDateString() : 'N/A'} fieldKey="" canEdit={false} onSave={() => {}} />
          <InlineField label="Voluntary PF" value={pf.voluntaryPF ? 'Yes' : 'No'} fieldKey="" canEdit={false} onSave={() => {}} />
          {pf.vpfPercentage && <InlineField label="VPF %" value={String(pf.vpfPercentage)} fieldKey="" canEdit={false} onSave={() => {}} />}
        </div>
      ) : <p style={{ color: 'var(--text-muted)' }}>No PF details recorded.{canEdit && ' Click Edit to add.'}</p>}
    </div>
  );
}
