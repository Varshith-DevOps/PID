'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/authContext';
import { getNotificationSettings, updateNotificationSettings } from '@/lib/api';
import { Button, Card, LoadingBlock, NumberField, PageHeader, Select, TextField, Textarea, Toggle } from '@/components/ui';

export default function NotificationSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [authLoading, router, user]);

  useEffect(() => {
    if (user) getNotificationSettings().then(setSettings);
  }, [user]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      setSettings(await updateNotificationSettings(settings));
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !user || !settings) {
    return <div className="app-layout"><Sidebar activePath="/notifications" /><main className="main-content"><LoadingBlock label="Loading notification settings..." /></main></div>;
  }

  return (
    <div className="app-layout">
      <Sidebar activePath="/notifications" />
      <main className="main-content">
        <PageHeader
          title="Notification Settings"
          subtitle="SMTP, SMS provider, retries and reminder timing"
          actions={<Button href="/notifications" variant="ghost" size="sm">Back to center</Button>}
        />
        <form onSubmit={save} className="grid grid-2">
          <Card title="Email SMTP">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <TextField label="SMTP Host" value={settings.smtpHost || ''} onChange={(v) => setSettings({ ...settings, smtpHost: v })} />
              <NumberField label="SMTP Port" value={String(settings.smtpPort || 587)} onChange={(v) => setSettings({ ...settings, smtpPort: v })} />
              <TextField label="SMTP Username" value={settings.smtpUsername || ''} onChange={(v) => setSettings({ ...settings, smtpUsername: v })} />
              <TextField label="SMTP Password" type="password" value={settings.smtpPassword || ''} onChange={(v) => setSettings({ ...settings, smtpPassword: v })} />
              <Toggle label="SSL/TLS" checked={Boolean(settings.smtpSecure)} onChange={(v) => setSettings({ ...settings, smtpSecure: v })} />
              <TextField label="Sender Name" value={settings.senderName || ''} onChange={(v) => setSettings({ ...settings, senderName: v })} />
              <Textarea label="Email Signature" value={settings.emailSignature || ''} onChange={(v) => setSettings({ ...settings, emailSignature: v })} />
            </div>
          </Card>
          <Card title="SMS and Delivery">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <Select
                label="SMS Provider"
                value={settings.smsProvider || 'MOCK'}
                onChange={(v) => setSettings({ ...settings, smsProvider: v })}
                options={[
                  { value: 'MOCK', label: 'Mock' },
                  { value: 'TWILIO', label: 'Twilio' },
                  { value: 'MSG91', label: 'MSG91' },
                  { value: 'TEXTLOCAL', label: 'TextLocal' },
                  { value: 'AWS_SNS', label: 'AWS SNS' },
                ]}
              />
              <Textarea label="SMS Config JSON" value={settings.smsConfig || '{}'} onChange={(v) => setSettings({ ...settings, smsConfig: v })} />
              <NumberField label="Retry Count" value={String(settings.retryCount ?? 3)} onChange={(v) => setSettings({ ...settings, retryCount: v })} />
              <TextField label="Reminder Timing" value={settings.reminderTimings || '24h,1h,15m'} onChange={(v) => setSettings({ ...settings, reminderTimings: v })} />
              <TextField label="Company Logo URL" value={settings.companyLogo || ''} onChange={(v) => setSettings({ ...settings, companyLogo: v })} />
              <div>
                <Button type="submit" loading={saving}>Save settings</Button>
              </div>
            </div>
          </Card>
        </form>
      </main>
    </div>
  );
}
