'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/authContext';
import {
  createNotification,
  deleteNotification,
  getNotificationCenter,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/api';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingBlock,
  PageHeader,
  SearchInput,
  Select,
  TextField,
  Textarea,
} from '@/components/ui';
import type { Tone } from '@/components/ui';

const BellIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const typeTone = (value: string): Tone => {
  switch (value?.toUpperCase()) {
    case 'WARNING':
    case 'FAILED':
      return 'warning';
    case 'PAYROLL':
      return 'payroll';
    case 'RECRUITMENT':
    case 'INTERVIEW_SCHEDULED':
      return 'info';
    default:
      return 'neutral';
  }
};

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [form, setForm] = useState({ title: '', message: '', type: 'INFO' });
  const [filters, setFilters] = useState({ search: '', status: '', channel: '', page: 1 });
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const limit = 10;

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading, router]);

  const canBroadcast = useMemo(() => Boolean(user && ['SUPER_ADMIN', 'ADMIN', 'HR', 'HR_ADMIN'].includes(user.role)), [user]);

  const loadNotifications = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getNotificationCenter({
        page: filters.page,
        limit,
        search: filters.search || undefined,
        status: filters.status || undefined,
        channel: filters.channel || undefined,
      });
      setNotifications(data.notifications || []);
      setTotal(data.total || 0);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      console.error(err);
      setError('Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadNotifications();
    const timer = window.setInterval(() => { if (user) loadNotifications(); }, 30000);
    return () => window.clearInterval(timer);
  }, [user, filters.page, filters.search, filters.status, filters.channel]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.message.trim()) return;
    setSaving(true);
    try {
      await createNotification(form);
      setForm({ title: '', message: '', type: 'INFO' });
      setFilters((prev) => ({ ...prev, page: 1 }));
      await loadNotifications();
    } finally {
      setSaving(false);
    }
  };

  const markRead = async (id: string) => {
    await markNotificationRead(id);
    loadNotifications();
  };

  const markAllRead = async () => {
    await markAllNotificationsRead();
    loadNotifications();
  };

  const archive = async (id: string) => {
    await deleteNotification(id);
    loadNotifications();
  };

  if (authLoading || !user) {
    return (
      <div className="app-layout">
        <Sidebar activePath="/notifications" />
        <main className="main-content">
          <LoadingBlock label="Loading notifications..." />
        </main>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="app-layout">
      <Sidebar activePath="/notifications" />
      <main className="main-content">
        <PageHeader
          title="Notifications"
          subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          icon={<div className="page-header-icon" style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }}>{BellIcon}</div>}
          actions={
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Button href="/notifications/preferences" variant="ghost" size="sm">Preferences</Button>
              {canBroadcast && <Button href="/notifications/templates" variant="ghost" size="sm">Templates</Button>}
              {canBroadcast && <Button href="/notifications/settings" variant="ghost" size="sm">Settings</Button>}
              {canBroadcast && <Button href="/notifications/history" variant="ghost" size="sm">History</Button>}
            </div>
          }
        />

        <div className="grid grid-2">
          {canBroadcast && (
            <Card title="Broadcast">
              <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <TextField label="Title" placeholder="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} required />
                <Select
                  label="Type"
                  value={form.type}
                  onChange={(v) => setForm({ ...form, type: v })}
                  options={[
                    { value: 'INFO', label: 'INFO' },
                    { value: 'ACTION', label: 'ACTION' },
                    { value: 'WARNING', label: 'WARNING' },
                    { value: 'PAYROLL', label: 'PAYROLL' },
                    { value: 'RECRUITMENT', label: 'RECRUITMENT' },
                  ]}
                />
                <Textarea label="Message" placeholder="Message" value={form.message} onChange={(v) => setForm({ ...form, message: v })} required />
                <div>
                  <Button type="submit" variant="primary" loading={saving}>Send</Button>
                </div>
              </form>
            </Card>
          )}

          <div className={canBroadcast ? '' : 'full-width'}>
            <Card
              title="Inbox"
              actions={unreadCount > 0 ? <Button size="sm" variant="ghost" onClick={markAllRead}>Mark all read</Button> : undefined}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 150px', gap: '0.75rem', marginBottom: '1rem' }}>
                <SearchInput value={filters.search} onChange={(v) => setFilters({ ...filters, search: v, page: 1 })} placeholder="Search notifications" />
                <Select
                  value={filters.status}
                  onChange={(v) => setFilters({ ...filters, status: v, page: 1 })}
                  placeholder="All status"
                  options={[
                    { value: 'QUEUED', label: 'Queued' },
                    { value: 'SENT', label: 'Sent' },
                    { value: 'DELIVERED', label: 'Delivered' },
                    { value: 'FAILED', label: 'Failed' },
                    { value: 'READ', label: 'Read' },
                  ]}
                />
                <Select
                  value={filters.channel}
                  onChange={(v) => setFilters({ ...filters, channel: v, page: 1 })}
                  placeholder="All channels"
                  options={[
                    { value: 'IN_APP', label: 'In-app' },
                    { value: 'EMAIL', label: 'Email' },
                    { value: 'SMS', label: 'SMS' },
                  ]}
                />
              </div>

              {error ? (
                <EmptyState title="Could not load inbox" message={error} action={<Button size="sm" variant="primary" onClick={loadNotifications}>Retry</Button>} />
              ) : loading ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading...</p>
              ) : notifications.length === 0 ? (
                <EmptyState title="No notifications" message="You're all caught up." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {notifications.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        padding: '0.85rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        border: `1px solid ${item.isRead ? 'var(--border-subtle)' : 'var(--accent)'}`,
                        background: item.isRead ? 'var(--surface-sunken)' : 'var(--surface-raised)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.45rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <strong style={{ color: 'var(--text-primary)', fontWeight: item.isRead ? 600 : 700 }}>
                          {!item.isRead && <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', marginRight: 6, verticalAlign: 'middle' }} />}
                          {item.title}
                        </strong>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Badge tone={typeTone(item.type)} dot>{item.type}</Badge>
                          <Badge tone="neutral">{item.channel}</Badge>
                        </div>
                      </div>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{String(item.message || '').replace(/<[^>]+>/g, ' ')}</span>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
                        <small style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{item.status} • {new Date(item.createdAt).toLocaleString()}</small>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          {!item.isRead && <Button size="sm" variant="ghost" onClick={() => markRead(item.id)}>Mark read</Button>}
                          <Button size="sm" variant="ghost" onClick={() => archive(item.id)}>Archive</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Page {filters.page} of {totalPages}</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button size="sm" variant="ghost" disabled={filters.page <= 1} onClick={() => setFilters((prev) => ({ ...prev, page: prev.page - 1 }))}>Previous</Button>
                  <Button size="sm" variant="ghost" disabled={filters.page >= totalPages} onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}>Next</Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
