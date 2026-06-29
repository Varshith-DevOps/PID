'use client';
import { useState } from 'react';
import { required } from '@/lib/validators';
import { getEmployeeDocuments, uploadDocument, deleteDocument, downloadDocumentFile } from '@/lib/api';
import {
  Button, IconButton, Card, EmptyState, ConfirmDialog,
  TextField, Textarea, Select, FileDrop,
} from '@/components/ui';

const DocIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
);
const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
);
const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
);

export default function DocumentsTab({ employee, canEdit, onReload }: any) {
  const [docs, setDocs] = useState<any[]>(employee.documents || []);
  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [docName, setDocName] = useState('');
  const [docDesc, setDocDesc] = useState('');
  const [docType, setDocType] = useState('OTHER');
  const [submitted, setSubmitted] = useState(false);
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [delId, setDelId] = useState<string | null>(null);

  const handleUpload = async () => {
    setSubmitted(true);
    const file = pickedFile;
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
      setShowForm(false); setDocName(''); setDocDesc(''); setDocType('OTHER'); setPickedFile(null); setSubmitted(false);
    } catch { alert('Upload failed'); } finally { setUploading(false); }
  };

  const handleConfirmDelete = async () => {
    if (!delId) return;
    try { await deleteDocument(delId); setDocs(docs.filter(d => d.id !== delId)); } catch { alert('Delete failed'); } finally { setDelId(null); }
  };

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Documents
        </h2>
        {canEdit && <Button size="sm" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ Upload'}</Button>}
      </div>

      {showForm && (
        <Card style={{ marginBottom: '1.5rem' }}>
          <div className="form-grid" style={{ marginBottom: '1rem' }}>
            <TextField label="Title" required value={docName} onChange={setDocName} validator={required('Title')} forceError={submitted} placeholder="e.g. Offer Letter" />
            <Select
              label="Type"
              value={docType}
              onChange={setDocType}
              options={[
                { value: 'ID_PROOF', label: 'ID Proof' },
                { value: 'ADDRESS_PROOF', label: 'Address Proof' },
                { value: 'EDUCATION', label: 'Education' },
                { value: 'EXPERIENCE', label: 'Experience Letter' },
                { value: 'OFFER_LETTER', label: 'Offer Letter' },
                { value: 'OTHER', label: 'Other' },
              ]}
            />
          </div>
          <Textarea label="Description" value={docDesc} onChange={setDocDesc} placeholder="Brief description..." />
          <FileDrop label="File *" onFile={setPickedFile} hint="Click or drag a file to upload" />
          <Button size="sm" variant="success" onClick={handleUpload} loading={uploading} disabled={uploading}>{uploading ? 'Uploading...' : 'Upload Document'}</Button>
        </Card>
      )}

      {docs.length > 0 ? docs.map((doc: any) => (
        <div key={doc.id} className="doc-card">
          <div className="doc-icon"><DocIcon /></div>
          <div className="doc-info">
            <div className="doc-name">{doc.name}</div>
            <div className="doc-desc">{doc.description || doc.type} • {doc.fileSize ? `${(doc.fileSize / 1024).toFixed(1)} KB` : ''} • {new Date(doc.createdAt).toLocaleDateString()}</div>
          </div>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <IconButton label="Download" onClick={() => downloadDocumentFile(doc.id)}><DownloadIcon /></IconButton>
            {canEdit && <IconButton label="Delete" tone="danger" onClick={() => setDelId(doc.id)}><TrashIcon /></IconButton>}
          </div>
        </div>
      )) : <EmptyState title="No documents uploaded yet" message={canEdit ? 'Use Upload to add the first document.' : undefined} />}

      <ConfirmDialog
        open={!!delId}
        title="Delete Document"
        message="This document will be permanently deleted. Continue?"
        confirmLabel="Delete"
        tone="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDelId(null)}
      />
    </div>
  );
}
