'use client';
import { useState } from 'react';
import { addDependent, deleteDependent, upsertExitDetails, updateEmployeeAddress, addEmployeeAddress, getChangeHistory } from '@/lib/api';

export function DependentsTab({ employee, canEdit, onReload }: any) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', relationship: 'SPOUSE', dateOfBirth: '', gender: '', isNominee: false, nomineePercent: '' });

  const handleAdd = async () => {
    if (!form.name) { alert('Name is required'); return; }
    try { await addDependent(employee.id, form); setShowForm(false); setForm({ name: '', relationship: 'SPOUSE', dateOfBirth: '', gender: '', isNominee: false, nomineePercent: '' }); onReload(); } catch { alert('Error'); }
  };
  const handleDel = async (id: string) => {
    const remark = prompt('Reason for marking this dependent as inactive?');
    if (remark !== null) {
      try { await deleteDependent(id, remark); onReload(); } catch { alert('Error marking inactive'); }
    }
  };

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Dependents &amp; Nominees</h2>
        {canEdit && <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ Add'}</button>}
      </div>
      {showForm && (
        <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="form-grid">
            <div className="form-group"><label className="form-label">Name *</label><input className="input-field" value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Relationship</label><select className="select-field" value={form.relationship} onChange={e => setForm({...form, relationship: e.target.value})}><option value="SPOUSE">Spouse</option><option value="CHILD">Child</option><option value="PARENT">Parent</option><option value="SIBLING">Sibling</option></select></div>
            <div className="form-group"><label className="form-label">Date of Birth</label><input type="date" className="input-field" value={form.dateOfBirth} onChange={e => setForm({...form, dateOfBirth: e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Gender</label><select className="select-field" value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}><option value="">Select</option><option value="MALE">Male</option><option value="FEMALE">Female</option></select></div>
          </div>
          <label className="checkbox-label" style={{ marginTop: '0.5rem' }}><input type="checkbox" checked={form.isNominee} onChange={e => setForm({...form, isNominee: e.target.checked})} /> Is Nominee</label>
          <div style={{ marginTop: '1rem' }}><button className="btn btn-success btn-sm" onClick={handleAdd}>Add Dependent</button></div>
        </div>
      )}
      {employee.dependents?.length > 0 ? (
        <table className="data-table">
          <thead><tr><th>Name</th><th>Relationship</th><th>DOB</th><th>Gender</th><th>Status</th><th>Nominee</th>{canEdit && <th></th>}</tr></thead>
          <tbody>{employee.dependents.map((d: any) => (
            <tr key={d.id} style={{ opacity: d.isActive ? 1 : 0.6 }}>
              <td style={{ fontWeight: 600 }}>{d.name}</td><td><span className="badge badge-info">{d.relationship}</span></td>
              <td>{d.dateOfBirth ? new Date(d.dateOfBirth).toLocaleDateString() : '-'}</td><td>{d.gender || '-'}</td>
              <td>{d.isActive ? <span className="badge badge-success">Active</span> : <span className="badge badge-danger">Inactive</span>}</td>
              <td>{d.isNominee ? <span className="badge badge-success">Yes ({d.nomineePercent || 100}%)</span> : 'No'}</td>
              {canEdit && d.isActive && <td><button className="btn btn-danger btn-sm" onClick={() => handleDel(d.id)}>Make Inactive</button></td>}
            </tr>
          ))}</tbody>
        </table>
      ) : <p style={{ color: 'var(--text-muted)' }}>No dependents recorded.</p>}
    </div>
  );
}

export function ExitTab({ employee, canEdit, onReload }: any) {
  const exit = employee.exitDetails;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ exitType: exit?.exitType||'', resignationDate: exit?.resignationDate?.split('T')[0]||'', lastWorkingDate: exit?.lastWorkingDate?.split('T')[0]||'', noticePeriodDays: exit?.noticePeriodDays||'', exitReason: exit?.exitReason||'', exitInterview: exit?.exitInterview||false, rehireEligible: exit?.rehireEligible!==false, fnfStatus: exit?.fnfStatus||'PENDING', fnfAmount: exit?.fnfAmount||'' });

  const handleSave = async () => {
    const reason = prompt('Reason for updating Exit Details:');
    if (reason === null) return;
    if (reason.trim() === '') { alert('Reason required'); return; }
    try { await upsertExitDetails(employee.id, { ...form, changeReason: reason }); setEditing(false); onReload(); } catch { alert('Error'); } 
  };

  if (editing) {
    return (
      <div>
        <div className="section-header"><h2 className="section-title">Exit Details</h2></div>
        <div className="form-grid">
          <div className="form-group"><label className="form-label">Exit Type</label><select className="select-field" value={form.exitType} onChange={e=>setForm({...form,exitType:e.target.value})}><option value="">Select</option><option value="RESIGNATION">Resignation</option><option value="TERMINATION">Termination</option><option value="RETIREMENT">Retirement</option><option value="ABSCONDING">Absconding</option></select></div>
          <div className="form-group"><label className="form-label">Resignation Date</label><input type="date" className="input-field" value={form.resignationDate} onChange={e=>setForm({...form,resignationDate:e.target.value})} /></div>
          <div className="form-group"><label className="form-label">Last Working Date</label><input type="date" className="input-field" value={form.lastWorkingDate} onChange={e=>setForm({...form,lastWorkingDate:e.target.value})} /></div>
          <div className="form-group"><label className="form-label">Notice Period (days)</label><input type="number" className="input-field" value={form.noticePeriodDays} onChange={e=>setForm({...form,noticePeriodDays:e.target.value})} /></div>
          <div className="form-group"><label className="form-label">Exit Reason</label><input className="input-field" value={form.exitReason} onChange={e=>setForm({...form,exitReason:e.target.value})} /></div>
          <div className="form-group"><label className="form-label">F&amp;F Status</label><select className="select-field" value={form.fnfStatus} onChange={e=>setForm({...form,fnfStatus:e.target.value})}><option value="PENDING">Pending</option><option value="PROCESSED">Processed</option><option value="PAID">Paid</option></select></div>
          <div className="form-group"><label className="form-label">F&amp;F Amount</label><input type="number" className="input-field" value={form.fnfAmount} onChange={e=>setForm({...form,fnfAmount:e.target.value})} /></div>
        </div>
        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1rem' }}>
          <label className="checkbox-label"><input type="checkbox" checked={form.exitInterview} onChange={e=>setForm({...form,exitInterview:e.target.checked})} /> Exit Interview Done</label>
          <label className="checkbox-label"><input type="checkbox" checked={form.rehireEligible} onChange={e=>setForm({...form,rehireEligible:e.target.checked})} /> Rehire Eligible</label>
        </div>
        <div style={{display:'flex',gap:'0.5rem',marginTop:'1rem'}}><button className="btn btn-primary btn-sm" onClick={handleSave}>Save</button><button className="btn btn-ghost btn-sm" onClick={()=>setEditing(false)}>Cancel</button></div>
      </div>
    );
  }

  return (
    <div>
      <div className="section-header"><h2 className="section-title">Exit Details</h2>{canEdit && <button className="btn btn-ghost btn-sm" onClick={()=>setEditing(true)}>✎ Edit</button>}</div>
      {exit ? (
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem' }}>
          <div className="info-field"><div className="info-field-label">Exit Type</div><div className="info-field-value"><span className="badge badge-warning">{exit.exitType||'N/A'}</span></div></div>
          <div className="info-field"><div className="info-field-label">Resignation Date</div><div className="info-field-value">{exit.resignationDate ? new Date(exit.resignationDate).toLocaleDateString() : 'N/A'}</div></div>
          <div className="info-field"><div className="info-field-label">Last Working Date</div><div className="info-field-value">{exit.lastWorkingDate ? new Date(exit.lastWorkingDate).toLocaleDateString() : 'N/A'}</div></div>
          <div className="info-field"><div className="info-field-label">Notice Period</div><div className="info-field-value">{exit.noticePeriodDays ? `${exit.noticePeriodDays} days` : 'N/A'}</div></div>
          <div className="info-field"><div className="info-field-label">Reason</div><div className="info-field-value">{exit.exitReason || 'N/A'}</div></div>
          <div className="info-field"><div className="info-field-label">F&amp;F Status</div><div className="info-field-value"><span className={`badge ${exit.fnfStatus==='PAID'?'badge-success':exit.fnfStatus==='PROCESSED'?'badge-warning':'badge-neutral'}`}>{exit.fnfStatus}</span></div></div>
          <div className="info-field"><div className="info-field-label">F&amp;F Amount</div><div className="info-field-value">{exit.fnfAmount ? `₹${exit.fnfAmount.toLocaleString()}` : 'N/A'}</div></div>
          <div className="info-field"><div className="info-field-label">Exit Interview</div><div className="info-field-value">{exit.exitInterview ? 'Yes' : 'No'}</div></div>
          <div className="info-field"><div className="info-field-label">Rehire Eligible</div><div className="info-field-value">{exit.rehireEligible ? <span className="badge badge-success">Yes</span> : <span className="badge badge-danger">No</span>}</div></div>
        </div>
      ) : <p style={{color:'var(--text-muted)'}}>No exit details recorded.{canEdit && ' Click Edit to add.'}</p>}
    </div>
  );
}

export function AddressTab({ employee, canEdit, onReload }: any) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ type: 'CURRENT', line1: '', line2: '', city: '', state: '', pincode: '', country: 'India' });

  const handleEdit = (a: any) => { setEditingId(a.id); setForm({ type: a.type, line1: a.line1, line2: a.line2||'', city: a.city, state: a.state, pincode: a.pincode, country: a.country }); };
  
  const handleSave = async () => {
    const reason = prompt('Reason for updating Address:');
    if (reason === null) return;
    if (reason.trim() === '') { alert('Reason required'); return; }
    try {
      if (editingId) await updateEmployeeAddress(editingId, { ...form, changeReason: reason });
      else await addEmployeeAddress(employee.id, { ...form, changeReason: reason });
      setEditingId(null); setShowAdd(false); setForm({ type: 'CURRENT', line1: '', line2: '', city: '', state: '', pincode: '', country: 'India' }); onReload();
    } catch { alert('Error saving address'); }
  };

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title"><span style={{ fontSize: '1.2rem', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))' }}>🏠</span> Addresses</h2>
        {canEdit && !editingId && !showAdd && <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ Add Address</button>}
      </div>

      {(showAdd || editingId) && (
        <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="form-grid">
            <div className="form-group"><label className="form-label">Type</label><select className="select-field" value={form.type} onChange={e=>setForm({...form, type:e.target.value})}><option value="CURRENT">Current</option><option value="PERMANENT">Permanent</option></select></div>
            <div className="form-group"><label className="form-label">Line 1 *</label><input className="input-field" value={form.line1} onChange={e=>setForm({...form, line1:e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Line 2</label><input className="input-field" value={form.line2} onChange={e=>setForm({...form, line2:e.target.value})} /></div>
            <div className="form-group"><label className="form-label">City *</label><input className="input-field" value={form.city} onChange={e=>setForm({...form, city:e.target.value})} /></div>
            <div className="form-group"><label className="form-label">State *</label><input className="input-field" value={form.state} onChange={e=>setForm({...form, state:e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Pincode *</label><input className="input-field" value={form.pincode} onChange={e=>setForm({...form, pincode:e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Country</label><input className="input-field" value={form.country} onChange={e=>setForm({...form, country:e.target.value})} /></div>
          </div>
          <div style={{display:'flex',gap:'0.5rem',marginTop:'1rem'}}>
            <button className="btn btn-primary btn-sm" onClick={handleSave}>Save</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setEditingId(null); setShowAdd(false); }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        {employee.addresses?.map((a: any) => (
          <div key={a.id} className="glass-card glass-card-glow" style={{ padding: '1.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '0.85rem', color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '1px' }}>{a.type} Address</h3>
              {canEdit && <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(a)}>✎ Edit</button>}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.8 }}>
              {a.line1}<br/>{a.line2 && <>{a.line2}<br/></>}{a.city}, {a.state} - {a.pincode}<br/>{a.country}
            </div>
          </div>
        ))}
        {(!employee.addresses || employee.addresses.length === 0) && <p style={{ color: 'var(--text-muted)' }}>No addresses recorded.</p>}
      </div>
    </div>
  );
}

export function HistoryTab({ employeeId }: { employeeId: string }) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Use a simple fetch on mount instead of complex top-level await imports
  useState(() => {
    getChangeHistory(employeeId).then(data => { setHistory(data); setLoading(false); }).catch(()=>setLoading(false));
  });

  if (loading) return <div>Loading history...</div>;

  return (
    <div>
      <div className="section-header"><h2 className="section-title"><span style={{ fontSize: '1.2rem', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))' }}>📝</span> Change History</h2></div>
      {history.length > 0 ? (
        <table className="data-table">
          <thead><tr><th>Date</th><th>Admin</th><th>Entity</th><th>Field</th><th>Old Value</th><th>New Value</th><th>Reason</th></tr></thead>
          <tbody>{history.map((h: any) => (
            <tr key={h.id}>
              <td style={{ whiteSpace:'nowrap' }}>{new Date(h.createdAt).toLocaleString()}</td>
              <td>{h.changedBy}</td>
              <td><span className="badge badge-info">{h.entity}</span></td>
              <td style={{ color: 'var(--accent-cyan)' }}>{h.field}</td>
              <td style={{ opacity: 0.7 }}>{h.oldValue || '-'}</td>
              <td style={{ color: 'var(--success)', fontWeight: 500 }}>{h.newValue || '-'}</td>
              <td style={{ fontStyle: 'italic', color: 'var(--accent-violet)' }}>{h.reason}</td>
            </tr>
          ))}</tbody>
        </table>
      ) : <p style={{color:'var(--text-muted)'}}>No change history recorded.</p>}
    </div>
  );
}
