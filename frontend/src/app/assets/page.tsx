'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/authContext';
import { createAsset, getAssets } from '@/lib/api';

export default function AssetsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [assets, setAssets] = useState<any[]>([]);
  const [form, setForm] = useState({ assetTag: '', name: '', category: 'Laptop', serialNumber: '' });
  const [loading, setLoading] = useState(true);

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
    await createAsset(form);
    setForm({ assetTag: '', name: '', category: 'Laptop', serialNumber: '' });
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
              <form onSubmit={submit} className="form-grid">
                <input className="form-control" placeholder="Asset tag" value={form.assetTag} onChange={e => setForm({ ...form, assetTag: e.target.value })} required />
                <input className="form-control" placeholder="Asset name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                <select className="form-control" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  <option>Laptop</option><option>Phone</option><option>ID Card</option><option>Vehicle</option><option>Equipment</option>
                </select>
                <input className="form-control" placeholder="Serial number" value={form.serialNumber} onChange={e => setForm({ ...form, serialNumber: e.target.value })} />
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
