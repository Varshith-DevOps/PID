'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/authContext';
import { createAsset, getAssets } from '@/lib/api';
import { ValidatedInput } from '@/components/ValidatedField';
import { validateForm, required } from '@/lib/validators';

export default function AssetsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [assets, setAssets] = useState<any[]>([]);
  const [form, setForm] = useState({ assetTag: '', name: '', category: 'Laptop', serialNumber: '' });
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading, router]);

  const loadAssets = async () => {
    setLoading(true);
    try {
      setAssets(await getAssets());
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
    const { isValid, firstError } = validateForm(
      { assetTag: form.assetTag, name: form.name },
      { assetTag: required('Asset tag'), name: required('Asset name') }
    );
    if (!isValid) {
      setError(firstError || 'Please correct the highlighted fields.');
      return;
    }
    setError('');
    await createAsset(form);
    setForm({ assetTag: '', name: '', category: 'Laptop', serialNumber: '' });
    setSubmitted(false);
    loadAssets();
  };

  if (!user) return null;

  const canManageAssets = ['SUPER_ADMIN', 'ADMIN', 'HR'].includes(user.role);

  return (
    <div className="app-layout">
      <Sidebar activePath="/assets" />
      <main className="main-content">
        <div className="page-header"><h1>Asset Management</h1></div>
        <div className="grid grid-2">
          {canManageAssets && (
            <section className="card">
              <h2>Register Asset</h2>
              {error && <p style={{ color: '#f87171', fontSize: '0.85rem', margin: '0 0 0.5rem' }}>{error}</p>}
              <form onSubmit={submit} className="form-grid">
                <ValidatedInput className="form-control" placeholder="Asset tag" value={form.assetTag} onChange={v => setForm({ ...form, assetTag: v })} validator={required('Asset tag')} forceError={submitted} required />
                <ValidatedInput className="form-control" placeholder="Asset name" value={form.name} onChange={v => setForm({ ...form, name: v })} validator={required('Asset name')} forceError={submitted} required />
                <select className="form-control" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  <option>Laptop</option><option>Phone</option><option>ID Card</option><option>Vehicle</option><option>Equipment</option>
                </select>
                <ValidatedInput className="form-control" placeholder="Serial number" value={form.serialNumber} onChange={v => setForm({ ...form, serialNumber: v })} />
                <button className="btn btn-primary" type="submit">Save Asset</button>
              </form>
            </section>
          )}
          <section className={`card ${canManageAssets ? '' : 'full-width'}`}>
            <h2>Inventory</h2>
            {loading ? <p>Loading...</p> : (
              <div className="table-container">
                <table className="data-table">
                  <thead><tr><th>Tag</th><th>Name</th><th>Category</th><th>Status</th><th>Assigned To</th></tr></thead>
                  <tbody>{assets.map(asset => (
                    <tr key={asset.id}>
                      <td>{asset.assetTag}</td><td>{asset.name}</td><td>{asset.category}</td><td><span className="badge">{asset.status}</span></td>
                      <td>{asset.assignedTo ? `${asset.assignedTo.firstName} ${asset.assignedTo.lastName}` : '-'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
