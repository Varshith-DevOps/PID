'use client';
import { useState } from 'react';
import InlineField from '@/components/InlineField';
import { ValidatedInput } from '@/components/ValidatedField';
import { validateForm, required, ifsc, bankAccount, uan } from '@/lib/validators';
import { upsertBankDetails, upsertPFDetails } from '@/lib/api';

export function BankTab({ employee, canEdit, shouldMask, onReload }: any) {
  const bank = employee.bankDetails;
  const [editing, setEditing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ bankName: bank?.bankName||'', accountNumber: bank?.accountNumber||'', ifscCode: bank?.ifscCode||'', branchName: bank?.branchName||'', accountType: bank?.accountType||'SAVINGS' });

  const handleSave = async () => {
    setSubmitted(true);
    const { isValid } = validateForm(
      { bankName: form.bankName, accountNumber: form.accountNumber, ifscCode: form.ifscCode },
      { bankName: required('Bank name'), accountNumber: bankAccount, ifscCode: ifsc }
    );
    if (!isValid) { alert('Please correct the highlighted fields.'); return; }
    const reason = prompt('Reason for updating Bank Details:');
    if (reason === null) return;
    if (reason.trim() === '') { alert('Reason required'); return; }
    try { await upsertBankDetails(employee.id, { ...form, changeReason: reason }); setEditing(false); onReload(); } catch { alert('Error saving'); }
  };

  if (editing) {
    return (
      <div>
        <div className="section-header"><h2 className="section-title">Bank Details</h2></div>
        <div className="form-grid">
          <div className="form-group"><label className="form-label">Bank Name *</label><ValidatedInput className="input-field" value={form.bankName} onChange={v=>setForm({...form,bankName:v})} validator={required('Bank name')} forceError={submitted} /></div>
          <div className="form-group"><label className="form-label">Account Number *</label><ValidatedInput className="input-field" value={form.accountNumber} onChange={v=>setForm({...form,accountNumber:v})} validator={bankAccount} restrict="digits" maxLength={18} forceError={submitted} /></div>
          <div className="form-group"><label className="form-label">IFSC Code *</label><ValidatedInput className="input-field" value={form.ifscCode} onChange={v=>setForm({...form,ifscCode:v})} validator={ifsc} restrict="upperAlnum" maxLength={11} forceError={submitted} /></div>
          <div className="form-group"><label className="form-label">Branch Name</label><ValidatedInput className="input-field" value={form.branchName} onChange={v=>setForm({...form,branchName:v})} /></div>
          <div className="form-group"><label className="form-label">Account Type</label><select className="select-field" value={form.accountType} onChange={e=>setForm({...form,accountType:e.target.value})}><option value="SAVINGS">Savings</option><option value="CURRENT">Current</option></select></div>
        </div>
        <div style={{display:'flex',gap:'0.5rem',marginTop:'1rem'}}><button className="btn btn-primary btn-sm" onClick={handleSave}>Save</button><button className="btn btn-ghost btn-sm" onClick={()=>setEditing(false)}>Cancel</button></div>
      </div>
    );
  }

  return (
    <div>
      <div className="section-header"><h2 className="section-title">Bank Details</h2>{canEdit && <button className="btn btn-ghost btn-sm" onClick={()=>setEditing(true)}>✎ Edit</button>}</div>
      {bank ? (
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 2rem' }}>
          <InlineField label="Bank Name" value={bank.bankName} fieldKey="" canEdit={false} onSave={()=>{}} />
          <InlineField label="Account Number" value={bank.accountNumber} fieldKey="" canEdit={false} onSave={()=>{}} masked={shouldMask} maskType="account" />
          <InlineField label="IFSC Code" value={bank.ifscCode} fieldKey="" canEdit={false} onSave={()=>{}} />
          <InlineField label="Branch" value={bank.branchName} fieldKey="" canEdit={false} onSave={()=>{}} />
          <InlineField label="Account Type" value={bank.accountType} fieldKey="" canEdit={false} onSave={()=>{}} />
        </div>
      ) : <p style={{color:'var(--text-muted)'}}>No bank details recorded.{canEdit && ' Click Edit to add.'}</p>}
    </div>
  );
}

export function PFTab({ employee, canEdit, shouldMask, onReload }: any) {
  const pf = employee.pfDetails;
  const [editing, setEditing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ pfNumber: pf?.pfNumber||'', uanNumber: pf?.uanNumber||'', epsNumber: pf?.epsNumber||'', pfJoinDate: pf?.pfJoinDate?.split('T')[0]||'', voluntaryPF: pf?.voluntaryPF||false, vpfPercentage: pf?.vpfPercentage||'' });

  const handleSave = async () => {
    setSubmitted(true);
    const { isValid } = validateForm(
      { uanNumber: form.uanNumber },
      { uanNumber: uan }
    );
    if (!isValid) { alert('Please correct the highlighted fields.'); return; }
    const reason = prompt('Reason for updating PF Details:');
    if (reason === null) return;
    if (reason.trim() === '') { alert('Reason required'); return; }
    try { await upsertPFDetails(employee.id, { ...form, changeReason: reason }); setEditing(false); onReload(); } catch { alert('Error saving'); }
  };

  if (editing) {
    return (
      <div>
        <div className="section-header"><h2 className="section-title">PF Details</h2></div>
        <div className="form-grid">
          <div className="form-group"><label className="form-label">PF Number</label><ValidatedInput className="input-field" value={form.pfNumber} onChange={v=>setForm({...form,pfNumber:v})} /></div>
          <div className="form-group"><label className="form-label">UAN Number</label><ValidatedInput className="input-field" value={form.uanNumber} onChange={v=>setForm({...form,uanNumber:v})} validator={uan} restrict="digits" maxLength={12} forceError={submitted} /></div>
          <div className="form-group"><label className="form-label">EPS Number</label><ValidatedInput className="input-field" value={form.epsNumber} onChange={v=>setForm({...form,epsNumber:v})} restrict="digits" /></div>
          <div className="form-group"><label className="form-label">PF Join Date</label><input type="date" className="input-field" value={form.pfJoinDate} onChange={e=>setForm({...form,pfJoinDate:e.target.value})} /></div>
        </div>
        <div style={{display:'flex',gap:'0.5rem',marginTop:'1rem'}}><button className="btn btn-primary btn-sm" onClick={handleSave}>Save</button><button className="btn btn-ghost btn-sm" onClick={()=>setEditing(false)}>Cancel</button></div>
      </div>
    );
  }

  return (
    <div>
      <div className="section-header"><h2 className="section-title">PF Details</h2>{canEdit && <button className="btn btn-ghost btn-sm" onClick={()=>setEditing(true)}>✎ Edit</button>}</div>
      {pf ? (
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 2rem' }}>
          <InlineField label="PF Number" value={pf.pfNumber} fieldKey="" canEdit={false} onSave={()=>{}} masked={shouldMask} maskType="pf" />
          <InlineField label="UAN Number" value={pf.uanNumber} fieldKey="" canEdit={false} onSave={()=>{}} masked={shouldMask} maskType="pf" />
          <InlineField label="EPS Number" value={pf.epsNumber} fieldKey="" canEdit={false} onSave={()=>{}} masked={shouldMask} maskType="pf" />
          <InlineField label="PF Join Date" value={pf.pfJoinDate ? new Date(pf.pfJoinDate).toLocaleDateString() : 'N/A'} fieldKey="" canEdit={false} onSave={()=>{}} />
          <InlineField label="Voluntary PF" value={pf.voluntaryPF ? 'Yes' : 'No'} fieldKey="" canEdit={false} onSave={()=>{}} />
          {pf.vpfPercentage && <InlineField label="VPF %" value={String(pf.vpfPercentage)} fieldKey="" canEdit={false} onSave={()=>{}} />}
        </div>
      ) : <p style={{color:'var(--text-muted)'}}>No PF details recorded.{canEdit && ' Click Edit to add.'}</p>}
    </div>
  );
}
