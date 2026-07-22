'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/authContext';
import {
  createNotificationTemplate,
  deleteNotificationTemplate,
  getNotificationTemplates,
  seedNotificationTemplates,
  updateNotificationTemplate,
} from '@/lib/api';
import { Button, Card, EmptyState, LoadingBlock, PageHeader, Select, TextField, Textarea, Toggle } from '@/components/ui';

const blank = { id: '', name: '', event: '', subject: '', body: '', channel: 'EMAIL', active: true, locale: 'en-IN' };

export default function NotificationTemplatesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [templates, setTemplates] = useState<any[]>([]);
  const [form, setForm] = useState<any>(blank);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [authLoading, router, user]);

  const load = async () => {
    setLoading(true);
    try {
      setTemplates(await getNotificationTemplates());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (user) load(); }, [user]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (form.id) await updateNotificationTemplate(form.id, form);
      else await createNotificationTemplate(form);
      setForm(blank);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const seedDefaults = async () => {
    await seedNotificationTemplates();
    await load();
  };

  if (authLoading || !user) {
    return <div className="app-layout"><Sidebar activePath="/notifications" /><main className="main-content"><LoadingBlock label="Loading templates..." /></main></div>;
  }

  return (
    <div className="app-layout">
      <Sidebar activePath="/notifications" />
      <main className="main-content">
        <PageHeader
          title="Notification Templates"
          subtitle="Reusable email, SMS and in-app message templates"
          actions={<Button href="/notifications" variant="ghost" size="sm">Back to center</Button>}
        />
        <div className="grid grid-2">
          <Card title={form.id ? 'Edit Template' : 'New Template'}>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <TextField label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
              <TextField label="Event" value={form.event} onChange={(v) => setForm({ ...form, event: v.toUpperCase() })} required />
              <Select
                label="Channel"
                value={form.channel}
                onChange={(v) => setForm({ ...form, channel: v })}
                options={[
                  { value: 'EMAIL', label: 'Email' },
                  { value: 'SMS', label: 'SMS' },
                  { value: 'IN_APP', label: 'In-app' },
                ]}
              />
              <TextField label="Subject" value={form.subject || ''} onChange={(v) => setForm({ ...form, subject: v })} />
              <Textarea label="Body" value={form.body} onChange={(v) => setForm({ ...form, body: v })} required />
              <TextField label="Locale" value={form.locale || 'en-IN'} onChange={(v) => setForm({ ...form, locale: v })} />
              <Toggle label="Active" checked={form.active !== false} onChange={(v) => setForm({ ...form, active: v })} />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button type="submit" loading={saving}>Save</Button>
                {form.id && <Button type="button" variant="ghost" onClick={() => setForm(blank)}>Cancel</Button>}
              </div>
            </form>
          </Card>
          <Card title="Templates" actions={<Button size="sm" variant="ghost" onClick={seedDefaults}>Seed defaults</Button>}>
            {loading ? (
              <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
            ) : templates.length === 0 ? (
              <EmptyState title="No templates" message="Create a template or seed the defaults." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {templates.map((template) => (
                  <div key={template.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <strong>{template.name}</strong>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{template.channel}</span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 4 }}>{template.event}</div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.7rem' }}>
                      <Button size="sm" variant="ghost" onClick={() => setForm(template)}>Edit</Button>
                      <Button size="sm" variant="danger" onClick={() => deleteNotificationTemplate(template.id).then(load)}>Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
