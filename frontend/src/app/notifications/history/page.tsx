'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/authContext';
import { getNotificationHistory } from '@/lib/api';
import { Badge, Button, Card, EmptyState, LoadingBlock, PageHeader } from '@/components/ui';

export default function NotificationHistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const limit = 20;

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    getNotificationHistory({ page, limit })
      .then((data) => {
        setItems(data.notifications || []);
        setTotal(data.total || 0);
      })
      .finally(() => setLoading(false));
  }, [user, page]);

  if (authLoading || !user) {
    return <div className="app-layout"><Sidebar activePath="/notifications" /><main className="main-content"><LoadingBlock label="Loading history..." /></main></div>;
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="app-layout">
      <Sidebar activePath="/notifications" />
      <main className="main-content">
        <PageHeader
          title="Notification History"
          subtitle="Delivery statuses and provider responses"
          actions={<Button href="/notifications" variant="ghost" size="sm">Back to center</Button>}
        />
        <Card title="Delivery History">
          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
          ) : items.length === 0 ? (
            <EmptyState title="No history" message="No notifications have been sent yet." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {items.map((item) => (
                <div key={item.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '0.9rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                    <strong>{item.title}</strong>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <Badge tone={item.status === 'FAILED' ? 'warning' : 'neutral'}>{item.status}</Badge>
                      <Badge tone="neutral">{item.channel}</Badge>
                    </div>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', marginTop: 4 }}>{String(item.message || '').replace(/<[^>]+>/g, ' ')}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 8 }}>
                    Created {new Date(item.createdAt).toLocaleString()}
                    {item.sentAt ? ` • Sent ${new Date(item.sentAt).toLocaleString()}` : ''}
                    {item.deliveredAt ? ` • Delivered ${new Date(item.deliveredAt).toLocaleString()}` : ''}
                  </div>
                  {item.logs?.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {item.logs.slice(0, 3).map((log: any) => (
                        <small key={log.id} style={{ color: 'var(--text-muted)' }}>{log.provider}: {log.status} retry {log.retryCount}</small>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Page {page} of {totalPages}</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <Button size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
