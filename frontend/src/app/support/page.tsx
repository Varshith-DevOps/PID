'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/lib/authContext';
import { getMySupportAssignments, updateTenantSubdomain } from '@/lib/api';
import { enterSupportView } from '@/lib/supportView';
import { BASE_DOMAIN } from '@/lib/tenant';
import BrandLogo from '@/components/BrandLogo';
import ThemeToggle from '@/components/ThemeToggle';
import { Card, Button, Badge, StatusChip, LoadingBlock, EmptyState, PermissionDenied, Modal, Banner } from '@/components/ui';

interface Assignment {
  companyId: string;
  name: string;
  code: string;
  subdomain: string;
  status: string;
  kycStatus: string;
}

function SupportConsole() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [subTarget, setSubTarget] = useState<Assignment | null>(null);
  const [subValue, setSubValue] = useState('');
  const [savingSub, setSavingSub] = useState(false);
  const [subError, setSubError] = useState('');

  const load = () => getMySupportAssignments().then(setAssignments).catch(() => setAssignments([]));

  useEffect(() => {
    if (user?.role !== 'SUPPORT') { setLoading(false); return; }
    load().finally(() => setLoading(false));
  }, [user?.role]);

  const saveSubdomain = async () => {
    if (!subTarget) return;
    setSavingSub(true); setSubError('');
    try {
      await updateTenantSubdomain(subTarget.companyId, subValue.trim().toLowerCase());
      setSubTarget(null);
      await load();
    } catch (err: any) {
      setSubError(err?.response?.data?.error || 'Failed to update subdomain.');
    } finally {
      setSavingSub(false);
    }
  };

  if (user && user.role !== 'SUPPORT') {
    return (
      <div style={{ padding: '3rem' }}>
        <PermissionDenied message="The support console is only available to support staff accounts." />
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <Button variant="ghost" href="/dashboard">Go to dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-canvas)' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 2rem', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-nav)' }}>
        <BrandLogo variant="dark" height={30} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <ThemeToggle compact />
          <span style={{ color: 'var(--text-on-nav-muted)', fontSize: '0.8rem' }}>{user?.name} · Support</span>
          <Button size="sm" variant="ghost" onClick={() => { logout(); router.push('/'); }}>Log out</Button>
        </div>
      </header>

      <main style={{ maxWidth: 920, margin: '0 auto', padding: '2.5rem 1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Assigned customers</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.75rem' }}>
          Select a customer to open their workspace in <strong>read-only</strong> support mode. You can view their data but cannot make changes.
        </p>

        {loading ? (
          <LoadingBlock label="Loading your assigned customers…" />
        ) : assignments.length === 0 ? (
          <EmptyState title="No customers assigned yet" message="A platform administrator hasn’t assigned any customers to you. Check back once you’ve been granted access." />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {assignments.map((a) => (
              <Card key={a.companyId}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{a.name}</div>
                    <code style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{a.code}</code>
                  </div>
                  <StatusChip status={a.status} />
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
                  <Badge tone={a.kycStatus === 'APPROVED' ? 'success' : 'warning'} dot>KYC {a.kycStatus}</Badge>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '1rem' }}>
                  <code style={{ fontSize: '0.75rem', color: 'var(--accent)' }}>{a.subdomain}.{BASE_DOMAIN}</code>
                  <button onClick={() => { setSubTarget(a); setSubValue(a.subdomain); setSubError(''); }}
                    style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, textDecoration: 'underline' }}>
                    Edit subdomain
                  </button>
                </div>
                <Button fullWidth onClick={() => enterSupportView(a.companyId, a.name)}>View (read-only)</Button>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Modal
        open={!!subTarget}
        onClose={() => setSubTarget(null)}
        title="Change workspace subdomain"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSubTarget(null)}>Cancel</Button>
            <Button onClick={saveSubdomain} loading={savingSub}>Save subdomain</Button>
          </>
        }
      >
        {subTarget && (
          <div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Set the workspace URL for <strong>{subTarget.name}</strong>.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <input className="input-field" value={subValue} onChange={(e) => setSubValue(e.target.value.toLowerCase())} placeholder="acme" style={{ maxWidth: 220 }} autoFocus />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>.{BASE_DOMAIN}</span>
            </div>
            {subError && <div style={{ marginTop: '0.75rem' }}><Banner tone="danger">{subError}</Banner></div>}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default function SupportPage() {
  return (
    <ProtectedRoute>
      <SupportConsole />
    </ProtectedRoute>
  );
}
