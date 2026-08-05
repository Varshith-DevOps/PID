'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/authContext';
import { 
  getAssets, 
  createAsset, 
  assignAsset, 
  returnAsset, 
  maintenanceAsset, 
  retireAsset, 
  getAssetHistory, 
  getAssetDashboard 
} from '@/lib/api';
import { required } from '@/lib/validators';
import {
  Button, Card, DataTable, Banner, PageHeader, Select, StatusChip, TextField,
  Modal, FilterBar, SearchInput, FilterSelect, StatCard, Timeline, SegmentedTabs
} from '@/components/ui';
import type { Column } from '@/components/ui';

interface AssetRow extends Record<string, unknown> {
  id: string;
  assetTag: string;
  name: string;
  category: string;
  status: string;
  condition: string;
  location?: string;
  warrantyExpiry?: string;
  assignedTo?: { id: string; firstName: string; lastName: string } | null;
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
  const [dashboard, setDashboard] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('inventory');
  
  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Modals state
  const [showRegister, setShowRegister] = useState(false);
  const [actionAsset, setActionAsset] = useState<AssetRow | null>(null);
  const [modalType, setModalType] = useState<'ASSIGN' | 'RETURN' | 'MAINTENANCE' | 'RETIRE' | 'HISTORY' | 'QR' | null>(null);
  
  // Forms
  const [registerForm, setRegisterForm] = useState({ assetTag: '', name: '', category: 'Laptop', serialNumber: '', condition: 'GOOD', location: '', purchaseCost: '', purchaseDate: '', warrantyExpiry: '' });
  const [assignForm, setAssignForm] = useState({ employeeId: '', assignedAt: '', notes: '' });
  const [returnForm, setReturnForm] = useState({ condition: 'GOOD', returnedAt: '', notes: '' });
  const [maintenanceForm, setMaintenanceForm] = useState({ action: 'SEND_MAINTENANCE' as any, vendor: '', cost: '', notes: '' });
  const [retireForm, setRetireForm] = useState({ reason: 'Obsolete', notes: '' });
  
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Dropdown data (in a real app, employees should be fetched. We'll use a text field for Employee ID for simplicity or just a select if we had them)
  const [employees, setEmployees] = useState<any[]>([]); // We would fetch this, but we'll leave it as a text field for Employee ID for now.

  const canManageAssets = user && ['SUPER_ADMIN', 'ADMIN', 'HR'].includes(user.role);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading, router]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      if (canManageAssets) {
        const [assetsData, dashData] = await Promise.all([
          getAssets(),
          getAssetDashboard()
        ]);
        setAssets(assetsData);
        setDashboard(dashData);
      } else {
        // Standard employee views only their assigned assets
        const assetsData = await getAssets({ assignedToId: user.id });
        setAssets(assetsData);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load asset data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const filteredAssets = useMemo(() => {
    return assets.filter(a => {
      const matchSearch = search ? 
        a.name.toLowerCase().includes(search.toLowerCase()) || 
        a.assetTag.toLowerCase().includes(search.toLowerCase()) : true;
      const matchStatus = statusFilter === 'ALL' ? true : a.status === statusFilter;
      const matchCategory = categoryFilter === 'ALL' ? true : a.category === categoryFilter;
      return matchSearch && matchStatus && matchCategory;
    });
  }, [assets, search, statusFilter, categoryFilter]);

  const exportCSV = () => {
    const headers = ['Tag', 'Name', 'Category', 'Status', 'Condition', 'Assigned To'];
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(',') + '\n'
      + filteredAssets.map(a => `${a.assetTag},${a.name},${a.category},${a.status},${a.condition},${a.assignedTo ? a.assignedTo.firstName + ' ' + a.assignedTo.lastName : 'None'}`).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "assets_inventory.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerForm.assetTag.trim() || !registerForm.name.trim()) { setFormError('Asset tag and name are required.'); return; }
    setFormError('');
    setSaving(true);
    try {
      await createAsset({
        ...registerForm,
        purchaseCost: registerForm.purchaseCost ? parseFloat(registerForm.purchaseCost) : undefined
      });
      setShowRegister(false);
      setRegisterForm({ assetTag: '', name: '', category: 'Laptop', serialNumber: '', condition: 'GOOD', location: '', purchaseCost: '', purchaseDate: '', warrantyExpiry: '' });
      loadData();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Registration failed');
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionAsset || !modalType) return;
    setFormError('');
    setSaving(true);
    try {
      if (modalType === 'ASSIGN') {
        if (!assignForm.employeeId) throw new Error('Employee ID is required');
        await assignAsset(actionAsset.id, assignForm);
      } else if (modalType === 'RETURN') {
        await returnAsset(actionAsset.id, returnForm);
      } else if (modalType === 'MAINTENANCE') {
        await maintenanceAsset(actionAsset.id, {
          action: maintenanceForm.action,
          vendor: maintenanceForm.vendor,
          cost: maintenanceForm.cost ? parseFloat(maintenanceForm.cost) : undefined,
          notes: maintenanceForm.notes
        });
      } else if (modalType === 'RETIRE') {
        await retireAsset(actionAsset.id, retireForm);
      }
      setModalType(null);
      setActionAsset(null);
      loadData();
    } catch (err: any) {
      setFormError(err.response?.data?.error || err.message || 'Action failed');
    } finally {
      setSaving(false);
    }
  };

  const openHistory = async (asset: AssetRow) => {
    setActionAsset(asset);
    setModalType('HISTORY');
    setLoading(true);
    try {
      const hist = await getAssetHistory(asset.id);
      setHistoryItems(hist);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const inventoryColumns: Column<AssetRow>[] = [
    { key: 'assetTag', header: 'Tag', render: (a) => <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{a.assetTag}</span> },
    { key: 'name', header: 'Name' },
    { key: 'category', header: 'Category' },
    { key: 'status', header: 'Status', align: 'center', render: (a) => <StatusChip status={a.status} /> },
    { key: 'condition', header: 'Condition' },
    { key: 'warranty', header: 'Warranty', render: (a) => a.warrantyExpiry ? new Date(a.warrantyExpiry).toLocaleDateString() : '—' },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (a) => (
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <Button size="sm" variant="ghost" onClick={() => { setActionAsset(a); setModalType('QR'); }}>QR</Button>
          <Button size="sm" variant="ghost" onClick={() => openHistory(a)}>History</Button>
          {canManageAssets && (a.status === 'AVAILABLE' || a.status === 'MAINTENANCE') && (
            <Button size="sm" variant="ghost" onClick={() => { 
              setActionAsset(a); 
              setMaintenanceForm(prev => ({ ...prev, action: a.status === 'MAINTENANCE' ? 'FINISH_MAINTENANCE' : 'SEND_MAINTENANCE' }));
              setModalType('MAINTENANCE'); 
            }}>
              {a.status === 'MAINTENANCE' ? 'Finish Maint.' : 'Maint.'}
            </Button>
          )}
          {canManageAssets && (a.status === 'AVAILABLE' || a.status === 'DAMAGED') && (
            <Button size="sm" variant="danger" onClick={() => { setActionAsset(a); setModalType('RETIRE'); }}>Retire</Button>
          )}
        </div>
      )
    }
  ];

  const assignmentColumns: Column<AssetRow>[] = [
    { key: 'assetTag', header: 'Tag', render: (a) => <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{a.assetTag}</span> },
    { key: 'name', header: 'Name' },
    { key: 'status', header: 'Status', align: 'center', render: (a) => <StatusChip status={a.status} /> },
    { key: 'assignedTo', header: 'Assigned Employee', render: (a) => (a.assignedTo ? `${a.assignedTo.firstName} ${a.assignedTo.lastName}` : '—') },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (a) => (
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <Button size="sm" variant="ghost" onClick={() => openHistory(a)}>History</Button>
          {canManageAssets && a.status === 'AVAILABLE' && <Button size="sm" variant="ghost" onClick={() => { setActionAsset(a); setModalType('ASSIGN'); }}>Assign</Button>}
          {canManageAssets && a.status === 'ASSIGNED' && <Button size="sm" variant="ghost" onClick={() => { setActionAsset(a); setModalType('RETURN'); }}>Return</Button>}
        </div>
      )
    }
  ];

  if (!user) return null;

  return (
    <div className="app-layout">
      <Sidebar activePath="/assets" />
      <main className="main-content">
        <PageHeader
          title={canManageAssets ? "Asset Management" : "My Assets"}
          subtitle="Track and manage assets"
          icon={<div className="page-header-icon" style={{ background: 'linear-gradient(135deg, #14b8a6, #0ea5e9)' }}>{ASSET_ICON}</div>}
          actions={canManageAssets && <Button variant="primary" onClick={() => setShowRegister(true)}>Register Asset</Button>}
        />

        {canManageAssets && (
          <div className="grid grid-4" style={{ marginBottom: '1.5rem' }}>
            <StatCard label="Total Assets" value={dashboard.TOTAL || 0} />
            <StatCard label="Available" value={dashboard.AVAILABLE || 0} trend={{ value: '100', direction: 'up' }} />
            <StatCard label="Assigned" value={dashboard.ASSIGNED || 0} />
            <StatCard label="In Maintenance" value={dashboard.MAINTENANCE || 0} trend={dashboard.MAINTENANCE > 0 ? { value: '1', direction: 'down' } : undefined} />
          </div>
        )}

        {canManageAssets && (
          <div style={{ marginBottom: '1.5rem' }}>
            <SegmentedTabs 
              value={activeTab} 
              onChange={setActiveTab} 
              items={[
                { key: 'inventory', label: 'Inventory (Register Assets)' },
                { key: 'assignments', label: 'Asset Assignments' }
              ]} 
            />
          </div>
        )}

        <Card title={activeTab === 'inventory' ? "Inventory" : "Assignments"} padded={false} actions={canManageAssets && <Button size="sm" variant="ghost" onClick={exportCSV}>Export CSV</Button>}>
          {canManageAssets && (
            <FilterBar>
              <SearchInput placeholder="Search assets..." value={search} onChange={setSearch} />
              <FilterSelect value={statusFilter} onChange={setStatusFilter} options={[
                { value: 'ALL', label: 'All Statuses' },
                { value: 'AVAILABLE', label: 'Available' },
                { value: 'ASSIGNED', label: 'Assigned' },
                { value: 'MAINTENANCE', label: 'Maintenance' },
                { value: 'RETIRED', label: 'Retired' },
              ]} />
              <FilterSelect value={categoryFilter} onChange={setCategoryFilter} options={[
                { value: 'ALL', label: 'All Categories' },
                { value: 'Laptop', label: 'Laptop' },
                { value: 'Phone', label: 'Phone' },
                { value: 'Equipment', label: 'Equipment' },
              ]} />
            </FilterBar>
          )}
          <DataTable
            columns={activeTab === 'inventory' ? inventoryColumns : assignmentColumns}
            rows={filteredAssets}
            loading={loading}
            rowKey={(a) => a.id}
            emptyTitle="No assets found"
            emptyMessage={canManageAssets ? "Register a new asset or adjust filters." : "You have no assets assigned."}
          />
        </Card>

        {/* Modals */}
        <Modal open={showRegister} onClose={() => setShowRegister(false)} title="Register Asset">
          {formError && <Banner tone="danger" title={formError} />}
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
            <div className="grid grid-2">
              <TextField label="Asset Tag *" value={registerForm.assetTag} onChange={v => setRegisterForm({ ...registerForm, assetTag: v })} required />
              <TextField label="Asset Name *" value={registerForm.name} onChange={v => setRegisterForm({ ...registerForm, name: v })} required />
            </div>
            <div className="grid grid-2">
              <Select label="Category *" value={registerForm.category} onChange={v => setRegisterForm({ ...registerForm, category: v })} options={[{ value: 'Laptop', label: 'Laptop' }, { value: 'Phone', label: 'Phone' }, { value: 'Vehicle', label: 'Vehicle' }, { value: 'Equipment', label: 'Equipment' }]} />
              <TextField label="Serial Number" value={registerForm.serialNumber} onChange={v => setRegisterForm({ ...registerForm, serialNumber: v })} />
            </div>
            <div className="grid grid-2">
              <Select label="Condition" value={registerForm.condition} onChange={v => setRegisterForm({ ...registerForm, condition: v })} options={[{ value: 'GOOD', label: 'Good' }, { value: 'FAIR', label: 'Fair' }, { value: 'NEW', label: 'New' }]} />
              <TextField label="Location" value={registerForm.location} onChange={v => setRegisterForm({ ...registerForm, location: v })} />
            </div>
            <div className="grid grid-3">
              <TextField type="date" label="Purchase Date" value={registerForm.purchaseDate} onChange={v => setRegisterForm({ ...registerForm, purchaseDate: v })} />
              <TextField type="number" label="Purchase Cost" value={registerForm.purchaseCost} onChange={v => setRegisterForm({ ...registerForm, purchaseCost: v })} />
              <TextField type="date" label="Warranty Expiry" value={registerForm.warrantyExpiry} onChange={v => setRegisterForm({ ...registerForm, warrantyExpiry: v })} />
            </div>
            <Button type="submit" variant="primary" loading={saving}>Register Asset</Button>
          </form>
        </Modal>

        <Modal open={modalType === 'ASSIGN'} onClose={() => setModalType(null)} title={`Assign ${actionAsset?.name}`}>
          {formError && <Banner tone="danger" title={formError} />}
          <form onSubmit={handleAction} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
            <TextField label="Employee ID *" placeholder="Paste employee UUID" value={assignForm.employeeId} onChange={v => setAssignForm({ ...assignForm, employeeId: v })} required />
            <TextField type="date" label="Assigned Date" value={assignForm.assignedAt} onChange={v => setAssignForm({ ...assignForm, assignedAt: v })} />
            <TextField label="Notes" value={assignForm.notes} onChange={v => setAssignForm({ ...assignForm, notes: v })} />
            <Button type="submit" variant="primary" loading={saving}>Assign</Button>
          </form>
        </Modal>

        <Modal open={modalType === 'RETURN'} onClose={() => setModalType(null)} title={`Return ${actionAsset?.name}`}>
          {formError && <Banner tone="danger" title={formError} />}
          <form onSubmit={handleAction} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
            <Select label="Condition on Return" value={returnForm.condition} onChange={v => setReturnForm({ ...returnForm, condition: v })} options={[{ value: 'GOOD', label: 'Good' }, { value: 'DAMAGED', label: 'Damaged' }, { value: 'LOST', label: 'Lost' }]} />
            <TextField type="date" label="Return Date" value={returnForm.returnedAt} onChange={v => setReturnForm({ ...returnForm, returnedAt: v })} />
            <TextField label="Notes" value={returnForm.notes} onChange={v => setReturnForm({ ...returnForm, notes: v })} />
            <Button type="submit" variant="primary" loading={saving}>Return Asset</Button>
          </form>
        </Modal>

        <Modal open={modalType === 'MAINTENANCE'} onClose={() => setModalType(null)} title={`Maintenance: ${actionAsset?.name}`}>
          {formError && <Banner tone="danger" title={formError} />}
          <form onSubmit={handleAction} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
            <p style={{ color: 'var(--text-muted)' }}>{maintenanceForm.action === 'SEND_MAINTENANCE' ? 'Send this asset for maintenance or repair.' : 'Mark this asset as returned from maintenance.'}</p>
            <TextField label="Vendor / Technician" value={maintenanceForm.vendor} onChange={v => setMaintenanceForm({ ...maintenanceForm, vendor: v })} />
            <TextField type="number" label="Cost" value={maintenanceForm.cost} onChange={v => setMaintenanceForm({ ...maintenanceForm, cost: v })} />
            <TextField label="Notes" value={maintenanceForm.notes} onChange={v => setMaintenanceForm({ ...maintenanceForm, notes: v })} />
            <Button type="submit" variant="primary" loading={saving}>{maintenanceForm.action === 'SEND_MAINTENANCE' ? 'Send to Maintenance' : 'Finish Maintenance'}</Button>
          </form>
        </Modal>

        <Modal open={modalType === 'RETIRE'} onClose={() => setModalType(null)} title={`Retire Asset: ${actionAsset?.name}`}>
          {formError && <Banner tone="danger" title={formError} />}
          <form onSubmit={handleAction} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
            <p style={{ color: 'var(--text-muted)' }}>Retiring an asset permanently removes it from circulation.</p>
            <Select label="Reason" value={retireForm.reason} onChange={v => setRetireForm({ ...retireForm, reason: v })} options={[{ value: 'Obsolete', label: 'Obsolete' }, { value: 'Damaged Beyond Repair', label: 'Damaged Beyond Repair' }, { value: 'Sold', label: 'Sold' }, { value: 'Lost/Stolen', label: 'Lost/Stolen' }]} />
            <TextField label="Notes" value={retireForm.notes} onChange={v => setRetireForm({ ...retireForm, notes: v })} />
            <Button type="submit" variant="primary" loading={saving}>Retire Asset</Button>
          </form>
        </Modal>

        <Modal open={modalType === 'HISTORY'} onClose={() => setModalType(null)} title={`Asset History: ${actionAsset?.name}`}>
          <div style={{ marginTop: '1rem' }}>
            <Timeline items={historyItems.map((h: any) => ({
              key: h.id,
              title: h.action,
              detail: h.details,
              meta: new Date(h.date).toLocaleString(),
              tone: h.action === 'CREATE' ? 'success' : h.action === 'MAINTENANCE' ? 'warning' : h.action === 'RETIRE' ? 'danger' : 'neutral'
            }))} />
            {historyItems.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No history available for this asset.</p>}
          </div>
        </Modal>

        <Modal open={modalType === 'QR'} onClose={() => setModalType(null)} title={`Barcode: ${actionAsset?.assetTag}`}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginTop: '2rem', paddingBottom: '2rem' }}>
            <div style={{ padding: '1rem', background: 'white', border: '2px solid black', fontFamily: 'monospace', fontSize: '2rem', letterSpacing: '0.5rem' }}>
              ||| |||| || ||| ||||
            </div>
            <span style={{ fontFamily: 'monospace', fontSize: '1.2rem', color: 'var(--text-primary)' }}>{actionAsset?.assetTag}</span>
            <Button variant="ghost" onClick={() => window.print()}>Print Label</Button>
          </div>
        </Modal>

      </main>
    </div>
  );
}
