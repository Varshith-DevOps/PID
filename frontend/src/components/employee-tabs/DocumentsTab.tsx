'use client';
import { useState, useRef } from 'react';
import { ValidatedInput, ValidatedTextarea } from '@/components/ValidatedField';
import { required } from '@/lib/validators';
import { getEmployeeDocuments, uploadDocument, deleteDocument, downloadDocumentFile } from '@/lib/api';

export default function DocumentsTab({ employee, canEdit, onReload }: any) {
  const [docs, setDocs] = useState<any[]>(employee.documents || []);
  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [docName, setDocName] = useState('');
  const [docDesc, setDocDesc] = useState('');
  const [docType, setDocType] = useState('OTHER');
  const [submitted, setSubmitted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    setSubmitted(true);
    const file = fileRef.current?.files?.[0];
    if (!file || !docName) { alert('Please provide a title and select a file'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('name', docName);
      fd.append('type', docType);
      fd.append('description', docDesc);
      await uploadDocument(employee.id, fd);
      const updated = await getEmployeeDocuments(employee.id);
      setDocs(updated);
      setShowForm(false); setDocName(''); setDocDesc(''); setDocType('OTHER');
      if (fileRef.current) fileRef.current.value = '';
    } catch { alert('Upload failed'); } finally { setUploading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this document?')) return;
    try { await deleteDocument(id); setDocs(docs.filter(d => d.id !== id)); } catch { alert('Delete failed'); }
  };

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Documents
        </h2>
        {canEdit && <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ Upload'}</button>}
      </div>

      {showForm && (
        <div className="doc-upload-zone" style={{ textAlign: 'left' }}>
          <div className="form-grid" style={{ marginBottom: '1rem' }}>
            <div className="form-group"><label className="form-label">Title *</label><ValidatedInput className="input-field" value={docName} onChange={setDocName} validator={required('Title')} forceError={submitted} placeholder="e.g. Offer Letter" /></div>
            <div className="form-group"><label className="form-label">Type</label>
              <select className="select-field" value={docType} onChange={e => setDocType(e.target.value)}>
                <option value="ID_PROOF">ID Proof</option><option value="ADDRESS_PROOF">Address Proof</option><option value="EDUCATION">Education</option><option value="EXPERIENCE">Experience Letter</option><option value="OFFER_LETTER">Offer Letter</option><option value="OTHER">Other</option>
              </select>
            </div>
          </div>
          <div className="form-group"><label className="form-label">Description</label><ValidatedTextarea className="textarea-field" value={docDesc} onChange={setDocDesc} placeholder="Brief description..." style={{ minHeight: '60px' }} /></div>
          <div className="form-group"><label className="form-label">File *</label><input type="file" ref={fileRef} className="input-field" /></div>
          <button className="btn btn-success btn-sm" onClick={handleUpload} disabled={uploading}>{uploading ? 'Uploading...' : 'Upload Document'}</button>
        </div>
      )}

      {docs.length > 0 ? docs.map((doc: any) => (
        <div key={doc.id} className="doc-card">
          <div className="doc-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
          <div className="doc-info">
            <div className="doc-name">{doc.name}</div>
            <div className="doc-desc">{doc.description || doc.type} • {doc.fileSize ? `${(doc.fileSize/1024).toFixed(1)} KB` : ''} • {new Date(doc.createdAt).toLocaleDateString()}</div>
          </div>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => downloadDocumentFile(doc.id)}>↓</button>
            {canEdit && <button className="btn btn-danger btn-sm" onClick={() => handleDelete(doc.id)}>✕</button>}
          </div>
        </div>
      )) : <p style={{ color: 'var(--text-muted)' }}>No documents uploaded yet.</p>}
    </div>
  );
}
