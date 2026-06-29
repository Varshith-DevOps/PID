'use client';
import { useState } from 'react';
import { validateForm, required, personName, nonNegative, integer, pincode, optional } from '@/lib/validators';
import { addDependent, deleteDependent, upsertExitDetails, updateEmployeeAddress, addEmployeeAddress, getChangeHistory } from '@/lib/api';
import {
  Button, Card, Badge, StatusChip, DataTable, ConfirmDialog,
  TextField, Select, DateField, Checkbox, LoadingBlock,
} from '@/components/ui';
import type { Column } from '@/components/ui';

export function DependentsTab({ employee, canEdit, onReload }: any) {
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({ name: '', relationship: 'SPOUSE', dateOfBirth: '', gender: '', isNominee: false, nomineePercent: '' });

  const handleAdd = async () => {
    setSubmitted(true);
    if (!form.name) { alert('Name is required'); return; }
    try { await addDependent(employee.id, form); setShowForm(false); setForm({ name: '', relationship: 'SPOUSE', dateOfBirth: '', gender: '', isNominee: false, nomineePercent: '' }); onReload(); } catch { alert('Error'); }
  };

  const handleConfirmDelete = async (remark?: string) => {
    if (!delId) return;
    setDeleting(true);
    try { await deleteDependent(delId, remark || ''); setDelId(null); onReload(); } catch { alert('Error marking inactive'); } finally { setDeleting(false); }
  };

  const columns: Column<any>[] = [
    { key: 'name', header: 'Name', render: (d) => <span style={{ fontWeight: 600 }}>{d.name}</span> },
    { key: 'relationship', header: 'Relationship', render: (d) => <Badge tone="info">{d.relationship}</Badge> },
    { key: 'dateOfBirth', header: 'DOB', render: (d) => (d.dateOfBirth ? new Date(d.dateOfBirth).toLocaleDateString() : '-') },
    { key: 'gender', header: 'Gender', render: (d) => d.gender || '-' },
    { key: 'status', header: 'Status', render: (d) => <StatusChip status={d.isActive ? 'ACTIVE' : 'INACTIVE'} /> },
    { key: 'nominee', header: 'Nominee', render: (d) => (d.isNominee ? <Badge tone="success">Yes ({d.nomineePercent || 100}%)</Badge> : 'No') },
    ...(canEdit ? [{
      key: 'actions', header: '', align: 'right' as const,
      render: (d: any) => (canEdit && d.isActive ? <Button size="sm" variant="danger" onClick={() => setDelId(d.id)}>Make Inactive</Button> : null),
    }] : []),
  ];

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Dependents &amp; Nominees</h2>
        {canEdit && <Button size="sm" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ Add'}</Button>}
      </div>
      {showForm && (
        <Card style={{ marginBottom: '1.5rem' }}>
          <div className="form-grid">
            <TextField label="Name" required value={form.name} onChange={v => setForm({ ...form, name: v })} validator={personName('Name')} restrict="alpha" forceError={submitted} />
            <Select label="Relationship" value={form.relationship} onChange={v => setForm({ ...form, relationship: v })} options={[{ value: 'SPOUSE', label: 'Spouse' }, { value: 'CHILD', label: 'Child' }, { value: 'PARENT', label: 'Parent' }, { value: 'SIBLING', label: 'Sibling' }]} />
            <DateField label="Date of Birth" value={form.dateOfBirth} onChange={v => setForm({ ...form, dateOfBirth: v })} />
            <Select label="Gender" value={form.gender} onChange={v => setForm({ ...form, gender: v })} placeholder="Select" options={[{ value: 'MALE', label: 'Male' }, { value: 'FEMALE', label: 'Female' }]} />
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <Checkbox label="Is Nominee" checked={form.isNominee} onChange={v => setForm({ ...form, isNominee: v })} />
          </div>
          <div style={{ marginTop: '1rem' }}><Button size="sm" variant="success" onClick={handleAdd}>Add Dependent</Button></div>
        </Card>
      )}
      <DataTable
        columns={columns}
        rows={employee.dependents || []}
        rowKey={(d) => d.id}
        emptyTitle="No dependents recorded"
      />
      <ConfirmDialog
        open={!!delId}
        title="Mark Dependent Inactive"
        message="Provide a reason for marking this dependent as inactive."
        requireReason
        reasonLabel="Reason for marking this dependent as inactive"
        confirmLabel="Make Inactive"
        tone="danger"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDelId(null)}
      />
    </div>
  );
}

export function ExitTab({ employee, canEdit, onReload }: any) {
  const exit = employee.exitDetails;
  const [editing, setEditing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ exitType: exit?.exitType || '', resignationDate: exit?.resignationDate?.split('T')[0] || '', lastWorkingDate: exit?.lastWorkingDate?.split('T')[0] || '', noticePeriodDays: exit?.noticePeriodDays || '', exitReason: exit?.exitReason || '', exitInterview: exit?.exitInterview || false, rehireEligible: exit?.rehireEligible !== false, fnfStatus: exit?.fnfStatus || 'PENDING', fnfAmount: exit?.fnfAmount || '' });

  const handleSave = () => {
    setSubmitted(true);
    const { isValid } = validateForm(
      { noticePeriodDays: String(form.noticePeriodDays), fnfAmount: String(form.fnfAmount) },
      { noticePeriodDays: optional(integer('Notice period')), fnfAmount: optional(nonNegative('F&F amount')) }
    );
    if (!isValid) { alert('Please correct the highlighted fields.'); return; }
    setConfirmOpen(true);
  };

  const handleConfirm = async (reason?: string) => {
    setSaving(true);
    try { await upsertExitDetails(employee.id, { ...form, changeReason: reason }); setConfirmOpen(false); setEditing(false); onReload(); } catch { alert('Error'); } finally { setSaving(false); }
  };

  if (editing) {
    return (
      <div>
        <div className="section-header"><h2 className="section-title">Exit Details</h2></div>
        <div className="form-grid">
          <Select label="Exit Type" value={form.exitType} onChange={v => setForm({ ...form, exitType: v })} placeholder="Select" options={[{ value: 'RESIGNATION', label: 'Resignation' }, { value: 'TERMINATION', label: 'Termination' }, { value: 'RETIREMENT', label: 'Retirement' }, { value: 'ABSCONDING', label: 'Absconding' }]} />
          <DateField label="Resignation Date" value={form.resignationDate} onChange={v => setForm({ ...form, resignationDate: v })} />
          <DateField label="Last Working Date" value={form.lastWorkingDate} onChange={v => setForm({ ...form, lastWorkingDate: v })} />
          <TextField label="Notice Period (days)" value={String(form.noticePeriodDays)} onChange={v => setForm({ ...form, noticePeriodDays: v })} validator={optional(integer('Notice period'))} restrict="digits" forceError={submitted} />
          <TextField label="Exit Reason" value={form.exitReason} onChange={v => setForm({ ...form, exitReason: v })} />
          <Select label="F&F Status" value={form.fnfStatus} onChange={v => setForm({ ...form, fnfStatus: v })} options={[{ value: 'PENDING', label: 'Pending' }, { value: 'PROCESSED', label: 'Processed' }, { value: 'PAID', label: 'Paid' }]} />
          <TextField label="F&F Amount" value={String(form.fnfAmount)} onChange={v => setForm({ ...form, fnfAmount: v })} validator={optional(nonNegative('F&F amount'))} restrict="decimal" forceError={submitted} />
        </div>
        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1.5rem' }}>
          <Checkbox label="Exit Interview Done" checked={form.exitInterview} onChange={v => setForm({ ...form, exitInterview: v })} />
          <Checkbox label="Rehire Eligible" checked={form.rehireEligible} onChange={v => setForm({ ...form, rehireEligible: v })} />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <Button size="sm" onClick={handleSave}>Save</Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
        <ConfirmDialog
          open={confirmOpen}
          title="Update Exit Details"
          message="Provide a reason for updating these exit details."
          requireReason
          reasonLabel="Reason for updating Exit Details"
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
      <div className="section-header"><h2 className="section-title">Exit Details</h2>{canEdit && <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>✎ Edit</Button>}</div>
      {exit ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="info-field"><div className="info-field-label">Exit Type</div><div className="info-field-value">{exit.exitType ? <Badge tone="warning">{exit.exitType}</Badge> : 'N/A'}</div></div>
          <div className="info-field"><div className="info-field-label">Resignation Date</div><div className="info-field-value">{exit.resignationDate ? new Date(exit.resignationDate).toLocaleDateString() : 'N/A'}</div></div>
          <div className="info-field"><div className="info-field-label">Last Working Date</div><div className="info-field-value">{exit.lastWorkingDate ? new Date(exit.lastWorkingDate).toLocaleDateString() : 'N/A'}</div></div>
          <div className="info-field"><div className="info-field-label">Notice Period</div><div className="info-field-value">{exit.noticePeriodDays ? `${exit.noticePeriodDays} days` : 'N/A'}</div></div>
          <div className="info-field"><div className="info-field-label">Reason</div><div className="info-field-value">{exit.exitReason || 'N/A'}</div></div>
          <div className="info-field"><div className="info-field-label">F&amp;F Status</div><div className="info-field-value"><StatusChip status={exit.fnfStatus} /></div></div>
          <div className="info-field"><div className="info-field-label">F&amp;F Amount</div><div className="info-field-value">{exit.fnfAmount ? `₹${exit.fnfAmount.toLocaleString()}` : 'N/A'}</div></div>
          <div className="info-field"><div className="info-field-label">Exit Interview</div><div className="info-field-value">{exit.exitInterview ? 'Yes' : 'No'}</div></div>
          <div className="info-field"><div className="info-field-label">Rehire Eligible</div><div className="info-field-value">{exit.rehireEligible ? <Badge tone="success">Yes</Badge> : <Badge tone="danger">No</Badge>}</div></div>
        </div>
      ) : <p style={{ color: 'var(--text-muted)' }}>No exit details recorded.{canEdit && ' Click Edit to add.'}</p>}
    </div>
  );
}

export function AddressTab({ employee, canEdit, onReload }: any) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ type: 'CURRENT', line1: '', line2: '', city: '', state: '', pincode: '', country: 'India' });

  const handleEdit = (a: any) => { setEditingId(a.id); setForm({ type: a.type, line1: a.line1, line2: a.line2 || '', city: a.city, state: a.state, pincode: a.pincode, country: a.country }); };

  const handleSave = () => {
    setSubmitted(true);
    const { isValid } = validateForm(
      { line1: form.line1, city: form.city, state: form.state, pincode: form.pincode },
      { line1: required('Address line 1'), city: required('City'), state: required('State'), pincode }
    );
    if (!isValid) { alert('Please correct the highlighted fields.'); return; }
    setConfirmOpen(true);
  };

  const handleConfirm = async (reason?: string) => {
    setSaving(true);
    try {
      if (editingId) await updateEmployeeAddress(editingId, { ...form, changeReason: reason });
      else await addEmployeeAddress(employee.id, { ...form, changeReason: reason });
      setConfirmOpen(false); setEditingId(null); setShowAdd(false); setSubmitted(false); setForm({ type: 'CURRENT', line1: '', line2: '', city: '', state: '', pincode: '', country: 'India' }); onReload();
    } catch { alert('Error saving address'); } finally { setSaving(false); }
  };

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title"><span aria-hidden="true" style={{ fontSize: '1.2rem' }}>🏠</span> Addresses</h2>
        {canEdit && !editingId && !showAdd && <Button size="sm" onClick={() => setShowAdd(true)}>+ Add Address</Button>}
      </div>

      {(showAdd || editingId) && (
        <Card style={{ marginBottom: '1.5rem' }}>
          <div className="form-grid">
            <Select label="Type" value={form.type} onChange={v => setForm({ ...form, type: v })} options={[{ value: 'CURRENT', label: 'Current' }, { value: 'PERMANENT', label: 'Permanent' }]} />
            <TextField label="Line 1" required value={form.line1} onChange={v => setForm({ ...form, line1: v })} validator={required('Address line 1')} forceError={submitted} />
            <TextField label="Line 2" value={form.line2} onChange={v => setForm({ ...form, line2: v })} />
            <TextField label="City" required value={form.city} onChange={v => setForm({ ...form, city: v })} validator={required('City')} forceError={submitted} />
            <TextField label="State" required value={form.state} onChange={v => setForm({ ...form, state: v })} validator={required('State')} forceError={submitted} />
            <TextField label="Pincode" required value={form.pincode} onChange={v => setForm({ ...form, pincode: v })} validator={pincode} restrict="digits" maxLength={6} forceError={submitted} />
            <TextField label="Country" value={form.country} onChange={v => setForm({ ...form, country: v })} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <Button size="sm" onClick={handleSave}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setShowAdd(false); }}>Cancel</Button>
          </div>
        </Card>
      )}

      <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        {employee.addresses?.map((a: any) => (
          <Card key={a.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '0.85rem', color: 'var(--trust)', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>{a.type} Address</h3>
              {canEdit && <Button size="sm" variant="ghost" onClick={() => handleEdit(a)}>✎ Edit</Button>}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.8 }}>
              {a.line1}<br />{a.line2 && <>{a.line2}<br /></>}{a.city}, {a.state} - {a.pincode}<br />{a.country}
            </div>
          </Card>
        ))}
        {(!employee.addresses || employee.addresses.length === 0) && <p style={{ color: 'var(--text-muted)' }}>No addresses recorded.</p>}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Update Address"
        message="Provide a reason for updating this address."
        requireReason
        reasonLabel="Reason for updating Address"
        confirmLabel="Save"
        loading={saving}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

export function HistoryTab({ employeeId }: { employeeId: string }) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Use a simple fetch on mount instead of complex top-level await imports
  useState(() => {
    getChangeHistory(employeeId).then(data => { setHistory(data); setLoading(false); }).catch(() => setLoading(false));
  });

  const columns: Column<any>[] = [
    { key: 'createdAt', header: 'Date', render: (h) => <span style={{ whiteSpace: 'nowrap' }}>{new Date(h.createdAt).toLocaleString()}</span> },
    { key: 'changedBy', header: 'Admin' },
    { key: 'entity', header: 'Entity', render: (h) => <Badge tone="info">{h.entity}</Badge> },
    { key: 'field', header: 'Field', render: (h) => <span style={{ color: 'var(--accent)' }}>{h.field}</span> },
    { key: 'oldValue', header: 'Old Value', render: (h) => <span style={{ opacity: 0.7 }}>{h.oldValue || '-'}</span> },
    { key: 'newValue', header: 'New Value', render: (h) => <span style={{ color: 'var(--success-fg)', fontWeight: 500 }}>{h.newValue || '-'}</span> },
    { key: 'reason', header: 'Reason', render: (h) => <span style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>{h.reason}</span> },
  ];

  if (loading) return <LoadingBlock label="Loading history…" />;

  return (
    <div>
      <div className="section-header"><h2 className="section-title"><span aria-hidden="true" style={{ fontSize: '1.2rem' }}>📝</span> Change History</h2></div>
      <DataTable columns={columns} rows={history} rowKey={(h) => h.id} emptyTitle="No change history recorded" />
    </div>
  );
}
