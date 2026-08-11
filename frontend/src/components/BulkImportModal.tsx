'use client';

import { useState } from 'react';
import { Modal, Button, Badge, Card, DataTable, LoadingBlock } from '@/components/ui';
import type { Column } from '@/components/ui';
import { useToast } from '@/lib/toastContext';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BulkImportModal({ isOpen, onClose, onSuccess }: BulkImportModalProps) {
  const { showToast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<any>(null);

  const handleDownloadTemplate = () => {
    window.open('/api/employees/bulk-import/template', '_blank');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = async (uploadedFile: File) => {
    setFile(uploadedFile);
    setParsing(true);
    setValidationResult(null);
    setImportSummary(null);

    try {
      const text = await uploadedFile.text();
      const rows = parseCSV(text);
      if (rows.length === 0) {
        showToast('The selected CSV file is empty.', 'error');
        setParsing(false);
        return;
      }

      // Call validation API
      const res = await fetch('/api/employees/bulk-import/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employees: rows }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to validate bulk CSV rows.');
      }

      setValidationResult(data);
    } catch (err: any) {
      showToast(err.message || 'Error processing CSV file.', 'error');
    } finally {
      setParsing(false);
    }
  };

  const parseCSV = (csvText: string): any[] => {
    const lines = csvText.split(/\r\n|\n/).filter(line => line.trim().length > 0);
    if (lines.length <= 1) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
    const result = [];

    for (let i = 1; i < lines.length; i++) {
      const currentline = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
      if (currentline.length < headers.length) continue;

      const obj: any = {};
      for (let j = 0; j < headers.length; j++) {
        obj[headers[j]] = currentline[j];
      }
      result.push(obj);
    }
    return result;
  };

  const handleExecuteImport = async () => {
    if (!validationResult || validationResult.validRows === 0) {
      showToast('No valid rows available to import.', 'error');
      return;
    }

    setImporting(true);
    try {
      const validRowsToImport = validationResult.rows
        .filter((r: any) => r.isValid)
        .map((r: any) => r.data);

      const res = await fetch('/api/employees/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employees: validRowsToImport }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to execute bulk employee import.');
      }

      setImportSummary(data);
      showToast(`Successfully imported ${data.createdEmployees} employees!`, 'success');
      onSuccess();
    } catch (err: any) {
      showToast(err.message || 'Error executing import.', 'error');
    } finally {
      setImporting(false);
    }
  };

  const previewColumns: Column<any>[] = [
    { key: 'row', header: '#', render: (r) => r.rowNumber },
    { key: 'status', header: 'Status', render: (r) => r.isValid ? <Badge tone="success">Valid</Badge> : <Badge tone="danger">Invalid</Badge> },
    { key: 'name', header: 'Name', render: (r) => `${r.data.firstName} ${r.data.lastName}` },
    { key: 'email', header: 'Email', render: (r) => r.data.email },
    { key: 'empId', header: 'ID', render: (r) => r.data.employeeId },
    { key: 'dept', header: 'Department', render: (r) => r.data.department },
    { key: 'role', header: 'Role', render: (r) => <Badge tone="neutral">{r.data.role}</Badge> },
    {
      key: 'errors',
      header: 'Validation Notes',
      render: (r) => r.isValid ? (
        <span style={{ color: 'var(--text-success)', fontSize: '0.75rem' }}>Ready for import</span>
      ) : (
        <span style={{ color: 'var(--text-danger)', fontSize: '0.75rem', fontWeight: 600 }}>{r.errors.join(' ')}</span>
      ),
    },
  ];

  return (
    <Modal open={isOpen} onClose={onClose} title="Bulk Add Employees" width={850}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Step 1: Upload Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-subtle)', padding: '1rem', borderRadius: 'var(--radius-lg)' }}>
          <div>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>1. Prepare & Upload CSV</h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
              Download our template or upload a populated employee CSV file.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button variant="ghost" onClick={handleDownloadTemplate} leftIcon={<span>📥</span>}>
              Download CSV Template
            </Button>
            <label className="ui-btn ui-btn-primary" style={{ cursor: 'pointer', margin: 0 }}>
              <span>📁 Browse CSV File</span>
              <input type="file" accept=".csv" onChange={handleFileChange} style={{ display: 'none' }} />
            </label>
          </div>
        </div>

        {parsing && <LoadingBlock label="Parsing and validating CSV rows against production schema..." />}

        {/* Step 2: Validation Preview Table */}
        {validationResult && !parsing && (
          <>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <Badge tone="info">Total Rows: {validationResult.totalRows}</Badge>
              <Badge tone="success">Valid Rows: {validationResult.validRows}</Badge>
              <Badge tone="danger">Invalid Rows: {validationResult.invalidRows}</Badge>
            </div>

            <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
              <DataTable
                columns={previewColumns}
                rows={validationResult.rows}
                rowKey={(r) => r.rowNumber}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button
                variant="primary"
                onClick={handleExecuteImport}
                loading={importing}
                disabled={validationResult.validRows === 0}
              >
                Import {validationResult.validRows} Valid Employee{validationResult.validRows > 1 ? 's' : ''}
              </Button>
            </div>
          </>
        )}

        {/* Step 3: Success Summary */}
        {importSummary && (
          <Card style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent-primary)' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Import Completed Successfully</h4>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.8rem' }}>
              <span>✅ Created Users: <strong>{importSummary.createdUsers}</strong></span>
              <span>✅ Created Employees: <strong>{importSummary.createdEmployees}</strong></span>
              {importSummary.skippedDuplicates > 0 && <span>⚠️ Skipped Duplicates: <strong>{importSummary.skippedDuplicates}</strong></span>}
            </div>
          </Card>
        )}
      </div>
    </Modal>
  );
}
