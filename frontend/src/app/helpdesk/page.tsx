'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import AssetRequestDashboard from '@/components/AssetRequestDashboard';
import { useAuth } from '@/lib/authContext';
import { createHelpdeskTicket, getHelpdeskTickets } from '@/lib/api';
import { required } from '@/lib/validators';
import {
  Badge,
  Button,
  Card,
  DataTable,
  Banner,
  PageHeader,
  Select,
  StatusChip,
  TextField,
  Textarea,
} from '@/components/ui';
import type { Column, Tone } from '@/components/ui';

interface TicketRow extends Record<string, unknown> {
  id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
}

const HELPDESK_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const priorityTone = (p: string): Tone => {
  switch (p?.toUpperCase()) {
    case 'URGENT': return 'danger';
    case 'HIGH': return 'warning';
    case 'MEDIUM': return 'info';
    default: return 'neutral';
  }
};

export default function HelpdeskPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [form, setForm] = useState({ category: 'HR', subject: '', description: '', priority: 'MEDIUM' });
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'tickets' | 'assets'>('tickets');
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.role === 'HR';

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading, router]);

  const loadTickets = async () => {
    setLoading(true);
    setError('');
    try {
      setTickets(await getHelpdeskTickets());
    } catch (err) {
      console.error(err);
      setError('Failed to load tickets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (user) loadTickets(); }, [user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!form.subject.trim()) { setFormError('Subject is required.'); return; }
    if (!form.description.trim()) { setFormError('Description is required.'); return; }
    setFormError('');
    setSaving(true);
    try {
      await createHelpdeskTicket(form);
      setForm({ category: 'HR', subject: '', description: '', priority: 'MEDIUM' });
      setSubmitted(false);
      loadTickets();
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  const columns: Column<TicketRow>[] = [
    { key: 'subject', header: 'Subject', render: (t) => <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.subject}</span> },
    { key: 'category', header: 'Category' },
    { key: 'priority', header: 'Priority', align: 'center', render: (t) => <Badge tone={priorityTone(t.priority)} dot>{t.priority}</Badge> },
    { key: 'status', header: 'Status', align: 'center', render: (t) => <StatusChip status={t.status} /> },
  ];

  return (
    <div className="app-layout">
      <Sidebar activePath="/helpdesk" />
      <main className="main-content">
        <PageHeader
          title="HR Helpdesk"
          subtitle="Raise and track support tickets"
          icon={<div className="page-header-icon" style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }}>{HELPDESK_ICON}</div>}
        />

        {/* Tab Headers */}
        <div style={{ display: 'flex', gap: '1.5rem', borderBottom: '1px solid var(--border-subtle)', marginBottom: '1.5rem', paddingBottom: '0.5rem' }}>
          <button onClick={() => setActiveTab('tickets')} style={{ background: 'transparent', border: 'none', color: activeTab === 'tickets' ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', paddingBottom: '0.25rem', borderBottom: activeTab === 'tickets' ? '2px solid var(--accent)' : 'none', outline: 'none' }}>Support Tickets</button>
          <button onClick={() => setActiveTab('assets')} style={{ background: 'transparent', border: 'none', color: activeTab === 'assets' ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', paddingBottom: '0.25rem', borderBottom: activeTab === 'assets' ? '2px solid var(--accent)' : 'none', outline: 'none' }}>Asset Requests</button>
        </div>

        {activeTab === 'tickets' && (
          <div className="grid grid-2">
            <Card title="New Ticket">
              {formError && <Banner tone="danger" title={formError} />}
              <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: formError ? '0.75rem' : 0 }}>
                <Select
                  label="Category"
                  value={form.category}
                  onChange={(v) => setForm({ ...form, category: v })}
                  options={[
                    { value: 'HR', label: 'HR' },
                    { value: 'Payroll', label: 'Payroll' },
                    { value: 'IT', label: 'IT' },
                    { value: 'Admin', label: 'Admin' },
                  ]}
                />
                <Select
                  label="Priority"
                  value={form.priority}
                  onChange={(v) => setForm({ ...form, priority: v })}
                  options={[
                    { value: 'LOW', label: 'LOW' },
                    { value: 'MEDIUM', label: 'MEDIUM' },
                    { value: 'HIGH', label: 'HIGH' },
                    { value: 'URGENT', label: 'URGENT' },
                  ]}
                />
                <TextField
                  label="Subject"
                  placeholder="Subject"
                  value={form.subject}
                  onChange={(v) => setForm({ ...form, subject: v })}
                  validator={required('Subject')}
                  forceError={submitted}
                  required
                />
                <Textarea
                  label="Description"
                  placeholder="Describe the issue"
                  value={form.description}
                  onChange={(v) => setForm({ ...form, description: v })}
                  validator={required('Description')}
                  forceError={submitted}
                  required
                />
                <div>
                  <Button type="submit" variant="primary" loading={saving}>Create Ticket</Button>
                </div>
              </form>
            </Card>
            <div>
              <Card title="Tickets" padded={false}>
                <DataTable
                  columns={columns}
                  rows={tickets}
                  loading={loading}
                  rowKey={(t) => t.id}
                  emptyTitle="No tickets"
                  emptyMessage="Submitted tickets will appear here."
                />
              </Card>
              {error && !loading && (
                <div style={{ marginTop: '0.75rem' }}>
                  <Banner tone="danger" title={error} action={<Button size="sm" variant="ghost" onClick={loadTickets}>Retry</Button>} />
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'assets' && (
          <AssetRequestDashboard isAdmin={isAdmin} />
        )}
      </main>
    </div>
  );
}
