'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/authContext';
import { createAsset, getAssets } from '@/lib/api';
import { required } from '@/lib/validators';
import {
  Button,
  Card,
  DataTable,
  Banner,
  PageHeader,
  Select,
  StatusChip,
  TextField,
} from '@/components/ui';
import type { Column } from '@/components/ui';

interface AssetRow extends Record<string, unknown> {
  id: string;
  assetTag: string;
  name: string;
  category: string;
  status: string;
  assignedTo?: { firstName: string; lastName: string } | null;
}

const ASSET_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
    <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

export default function AssetsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [form, setForm] = useState({ assetTag: '', name: '', category: 'Laptop', serialNumber: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading, router]);

  const loadAssets = async () => {
    setLoading(true);
    setError('');
    try {
      setAssets(await getAssets());
    } catch (err) {
      console.error(err);
      setError('Failed to load assets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadAssets();
  }, [user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!form.assetTag.trim()) { setFormError('Asset tag is required.'); return; }
    if (!form.name.trim()) { setFormError('Asset name is required.'); return; }
    setFormError('');
    setSaving(true);
    try {
      await createAsset(form);
      setForm({ assetTag: '', name: '', category: 'Laptop', serialNumber: '' });
      setSubmitted(false);
      loadAssets();
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  const canManageAssets = ['SUPER_ADMIN', 'ADMIN', 'HR'].includes(user.role);

  const columns: Column<AssetRow>[] = [
    { key: 'assetTag', header: 'Tag', render: (a) => <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{a.assetTag}</span> },
    { key: 'name', header: 'Name' },
    { key: 'category', header: 'Category' },
    { key: 'status', header: 'Status', align: 'center', render: (a) => <StatusChip status={a.status} /> },
    { key: 'assignedTo', header: 'Assigned To', render: (a) => (a.assignedTo ? `${a.assignedTo.firstName} ${a.assignedTo.lastName}` : '—') },
  ];

  return (
    <div className="app-layout">
      <Sidebar activePath="/assets" />
      <main className="main-content">
        <PageHeader
          title="Asset Management"
          subtitle="Track and assign company assets"
          icon={<div className="page-header-icon" style={{ background: 'linear-gradient(135deg, #14b8a6, #0ea5e9)' }}>{ASSET_ICON}</div>}
        />
        <div className="grid grid-2">
          {canManageAssets && (
            <Card title="Register Asset">
              {formError && <Banner tone="danger" title={formError} />}
              <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: formError ? '0.75rem' : 0 }}>
                <TextField
                  label="Asset Tag"
                  placeholder="Asset tag"
                  value={form.assetTag}
                  onChange={(v) => setForm({ ...form, assetTag: v })}
                  validator={required('Asset tag')}
                  forceError={submitted}
                  required
                />
                <TextField
                  label="Asset Name"
                  placeholder="Asset name"
                  value={form.name}
                  onChange={(v) => setForm({ ...form, name: v })}
                  validator={required('Asset name')}
                  forceError={submitted}
                  required
                />
                <Select
                  label="Category"
                  value={form.category}
                  onChange={(v) => setForm({ ...form, category: v })}
                  options={[
                    { value: 'Laptop', label: 'Laptop' },
                    { value: 'Phone', label: 'Phone' },
                    { value: 'ID Card', label: 'ID Card' },
                    { value: 'Vehicle', label: 'Vehicle' },
                    { value: 'Equipment', label: 'Equipment' },
                  ]}
                />
                <TextField
                  label="Serial Number"
                  placeholder="Serial number"
                  value={form.serialNumber}
                  onChange={(v) => setForm({ ...form, serialNumber: v })}
                />
                <div>
                  <Button type="submit" variant="primary" loading={saving}>Save Asset</Button>
                </div>
              </form>
            </Card>
          )}
          <div className={canManageAssets ? '' : 'full-width'}>
            <Card title="Inventory" padded={false}>
              <DataTable
                columns={columns}
                rows={assets}
                loading={loading}
                rowKey={(a) => a.id}
                emptyTitle="No assets"
                emptyMessage="Registered assets will appear here."
              />
            </Card>
            {error && !loading && (
              <div style={{ marginTop: '0.75rem' }}>
                <Banner tone="danger" title={error} action={<Button size="sm" variant="ghost" onClick={loadAssets}>Retry</Button>} />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
