'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/authContext';
import { getNotificationPreferences, updateNotificationPreferences } from '@/lib/api';
import { Button, Card, LoadingBlock, PageHeader, Toggle } from '@/components/ui';

export default function NotificationPreferencesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [preferences, setPreferences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    getNotificationPreferences()
      .then(setPreferences)
      .finally(() => setLoading(false));
  }, [user]);

  const updateRow = (module: string, patch: Record<string, boolean>) => {
    setPreferences((prev) => prev.map((item) => item.module === module ? { ...item, ...patch } : item));
  };

  const save = async () => {
    setSaving(true);
    try {
      setPreferences(await updateNotificationPreferences(preferences));
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !user) {
    return <div className="app-layout"><Sidebar activePath="/notifications" /><main className="main-content"><LoadingBlock label="Loading preferences..." /></main></div>;
  }

  return (
    <div className="app-layout">
      <Sidebar activePath="/notifications" />
      <main className="main-content">
        <PageHeader
          title="Notification Preferences"
          subtitle="Choose how each module can contact you"
          actions={<Button href="/notifications" variant="ghost" size="sm">Back to center</Button>}
        />
        <Card title="Preferences" actions={<Button size="sm" loading={saving} onClick={save}>Save</Button>}>
          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {preferences.map((item) => (
                <div
                  key={item.module}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr repeat(3, minmax(110px, auto))',
                    gap: '0.75rem',
                    alignItems: 'center',
                    padding: '0.85rem',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <strong>{item.module}</strong>
                  <Toggle label="Email" checked={Boolean(item.emailEnabled)} onChange={(v) => updateRow(item.module, { emailEnabled: v })} />
                  <Toggle label="SMS" checked={Boolean(item.smsEnabled)} onChange={(v) => updateRow(item.module, { smsEnabled: v })} />
                  <Toggle label="In-app" checked={Boolean(item.inAppEnabled)} onChange={(v) => updateRow(item.module, { inAppEnabled: v })} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
