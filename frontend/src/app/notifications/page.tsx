'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/authContext';
import { createNotification, getNotifications, markNotificationRead } from '@/lib/api';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Select,
  TextField,
  Textarea,
} from '@/components/ui';
import type { Tone } from '@/components/ui';

const NOTIF_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const typeTone = (t: string): Tone => {
  switch (t?.toUpperCase()) {
    case 'WARNING': return 'warning';
    case 'ACTION': return 'info';
    case 'PAYROLL': return 'payroll';
    default: return 'neutral';
  }
};

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [form, setForm] = useState({ title: '', message: '', type: 'INFO' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading, router]);

  const loadNotifications = async () => {
    setLoading(true);
    setError('');
    try {
      setNotifications(await getNotifications());
    } catch (err) {
      console.error(err);
      setError('Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (user) loadNotifications(); }, [user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.message.trim()) return;
    setSaving(true);
    try {
      await createNotification(form);
      setForm({ title: '', message: '', type: 'INFO' });
      loadNotifications();
    } finally {
      setSaving(false);
    }
  };

  const markRead = async (id: string) => {
    await markNotificationRead(id);
    loadNotifications();
  };

  const markAllRead = async () => {
    const unread = notifications.filter((n) => !n.isRead);
    await Promise.all(unread.map((n) => markNotificationRead(n.id)));
    loadNotifications();
  };

  if (!user) return null;

  const canBroadcast = ['SUPER_ADMIN', 'ADMIN', 'HR'].includes(user.role);
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="app-layout">
      <Sidebar activePath="/notifications" />
      <main className="main-content">
        <PageHeader
          title="Notifications"
          subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          icon={<div className="page-header-icon" style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }}>{NOTIF_ICON}</div>}
        />
        <div className="grid grid-2">
          {canBroadcast && (
            <Card title="Broadcast">
              <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <TextField
                  label="Title"
                  placeholder="Title"
                  value={form.title}
                  onChange={(v) => setForm({ ...form, title: v })}
                  required
                />
                <Select
                  label="Type"
                  value={form.type}
                  onChange={(v) => setForm({ ...form, type: v })}
                  options={[
                    { value: 'INFO', label: 'INFO' },
                    { value: 'ACTION', label: 'ACTION' },
                    { value: 'WARNING', label: 'WARNING' },
                    { value: 'PAYROLL', label: 'PAYROLL' },
                  ]}
                />
                <Textarea
                  label="Message"
                  placeholder="Message"
                  value={form.message}
                  onChange={(v) => setForm({ ...form, message: v })}
                  required
                />
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
              {error ? (
                <EmptyState title="Could not load inbox" message={error} action={<Button size="sm" variant="primary" onClick={loadNotifications}>Retry</Button>} />
              ) : loading ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading…</p>
              ) : notifications.length === 0 ? (
                <EmptyState title="No notifications" message="You're all caught up." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {notifications.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => markRead(item.id)}
                      style={{
                        textAlign: 'left',
                        width: '100%',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        padding: '0.85rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        border: `1px solid ${item.isRead ? 'var(--border-subtle)' : 'var(--accent)'}`,
                        background: item.isRead ? 'var(--surface-sunken)' : 'var(--surface-raised)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.3rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <strong style={{ color: 'var(--text-primary)', fontWeight: item.isRead ? 600 : 700 }}>
                          {!item.isRead && <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', marginRight: 6, verticalAlign: 'middle' }} />}
                          {item.title}
                        </strong>
                        <Badge tone={typeTone(item.type)} dot>{item.type}</Badge>
                      </div>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{item.message}</span>
                      <small style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{item.isRead ? 'Read' : 'Unread'}</small>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
