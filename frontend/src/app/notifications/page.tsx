'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/authContext';
import { createNotification, getNotifications, markNotificationRead } from '@/lib/api';

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [form, setForm] = useState({ title: '', message: '', type: 'INFO' });

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading, router]);

  const loadNotifications = async () => setNotifications(await getNotifications());
  useEffect(() => { if (user) loadNotifications(); }, [user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createNotification(form);
    setForm({ title: '', message: '', type: 'INFO' });
    loadNotifications();
  };

  if (!user) return null;

  const canBroadcast = ['SUPER_ADMIN', 'ADMIN', 'HR'].includes(user.role);

  return (
    <div className="app-layout">
      <Sidebar activePath="/notifications" />
      <main className="main-content">
        <div className="page-header"><h1>Notifications</h1></div>
        <div className="grid grid-2">
          {canBroadcast && (
            <section className="card">
              <h2>Broadcast</h2>
              <form onSubmit={submit} className="form-grid">
                <input className="form-control" placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
                <select className="form-control" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  <option>INFO</option><option>ACTION</option><option>WARNING</option><option>PAYROLL</option>
                </select>
                <textarea className="form-control" placeholder="Message" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} required />
                <button className="btn btn-primary" type="submit">Send</button>
              </form>
            </section>
          )}
          <section className={`card ${canBroadcast ? '' : 'full-width'}`}>
            <h2>Inbox</h2>
            <div className="stack">
              {notifications.map(item => (
                <button key={item.id} className="list-item" onClick={async () => { await markNotificationRead(item.id); loadNotifications(); }}>
                  <strong>{item.title}</strong>
                  <span>{item.message}</span>
                  <small>{item.type} &middot; {item.isRead ? 'Read' : 'Unread'}</small>
                </button>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
