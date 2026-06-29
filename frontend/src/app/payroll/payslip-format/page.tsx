'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import Sidebar from '@/components/Sidebar';
import { getPayslipTemplate, updatePayslipTemplate } from '@/lib/api';
import {
  PageHeader, Banner, Button, Card, ColorField, Checkbox, TextField,
  LoadingBlock,
} from '@/components/ui';

interface Template {
  id: string;
  name: string;
  description: string;
  accent: string;
  header: string;
  table: string;
  density: string;
  zebra: boolean;
  showLogo: boolean;
}

interface Config {
  accent: string | null;
  showLogo: boolean;
  showBankDetails: boolean;
  showAttendance: boolean;
  showYearToDate: boolean;
  headerNote: string;
  signatoryLabel: string;
}

export default function PayslipFormatPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<string>('classic');
  const [config, setConfig] = useState<Config>({
    accent: null, showLogo: true, showBankDetails: true, showAttendance: true,
    showYearToDate: false, headerNote: '', signatoryLabel: '',
  });
  const [locked, setLocked] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [lockedMessage, setLockedMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') { router.push('/dashboard'); return; }
    (async () => {
      try {
        const data = await getPayslipTemplate();
        setTemplates(data.templates || []);
        setSelectedId(data.selected?.templateId || 'classic');
        if (data.selected?.config) setConfig((c) => ({ ...c, ...data.selected.config }));
        setLocked(Boolean(data.selected?.locked));
        setCanEdit(Boolean(data.canEdit));
        setLockedMessage(data.lockedMessage || null);
      } catch {
        /* interceptor shows the error toast */
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading, user, router]);

  const selected = useMemo(() => templates.find((t) => t.id === selectedId), [templates, selectedId]);
  const accent = config.accent || selected?.accent || '#1f2937';

  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const res = await updatePayslipTemplate({ templateId: selectedId, config });
      setLocked(Boolean(res.selected?.locked));
      // After an Admin saves, the format locks — refresh edit rights accordingly.
      if (!isSuperAdmin) {
        setCanEdit(false);
        setLockedMessage('This payslip format is locked. Contact the PID hcms Super Admin team to make further changes.');
      }
    } catch {
      /* interceptor shows the error toast */
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="app-layout">
        <Sidebar activePath="/payroll/payslip-format" />
        <main className="main-content"><LoadingBlock label="Loading payslip formats…" /></main>
      </div>
    );
  }

  const lockIcon = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
  );

  return (
    <div className="app-layout">
      <Sidebar activePath="/payroll/payslip-format" />
      <main className="main-content">
        <PageHeader
          title="Payslip Format"
          subtitle="Choose one of 8 formats for your company payslips. Every format shows all mandatory payroll data."
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>}
        />

        {/* Lock / permission banner */}
        {locked && (
          <div style={{ marginBottom: '1.25rem' }}>
            <Banner tone={canEdit ? 'info' : 'warning'} icon={lockIcon}>
              {canEdit
                ? 'This format is locked for the company Admin. As PID hcms Super Admin, you can still change it.'
                : (lockedMessage || 'This payslip format is locked. Contact the PID hcms Super Admin team to make further changes.')}
            </Banner>
          </div>
        )}
        {!locked && canEdit && (
          <div style={{ marginBottom: '1.25rem' }}>
            <Banner tone="info">
              You can choose and customize the payslip format <strong>once</strong>. After you save, further changes will require the PID hcms Super Admin team.
            </Banner>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
          {/* Template chooser */}
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.85rem' }}>
              {templates.map((t) => {
                const active = t.id === selectedId;
                return (
                  <button
                    key={t.id}
                    onClick={() => canEdit && setSelectedId(t.id)}
                    disabled={!canEdit}
                    style={{
                      textAlign: 'left', padding: '0.9rem', borderRadius: 'var(--radius-md)', cursor: canEdit ? 'pointer' : 'not-allowed',
                      background: active ? 'var(--accent-soft, var(--surface-sunken))' : 'var(--surface-raised)',
                      border: `2px solid ${active ? 'var(--accent)' : 'var(--border-subtle)'}`,
                      opacity: canEdit || active ? 1 : 0.7, transition: 'all var(--motion-base) var(--ease-out)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                      <span style={{ width: 14, height: 14, borderRadius: 4, background: t.accent, display: 'inline-block', border: '1px solid var(--border-subtle)' }} />
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{t.name}</span>
                      {active && <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: '0.75rem', fontWeight: 700 }}>SELECTED</span>}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{t.description}</div>
                  </button>
                );
              })}
            </div>

            {/* Customization */}
            <Card title="Customize" style={{ marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <ColorField
                  label="Accent colour"
                  value={accent}
                  onChange={(v) => canEdit && setConfig({ ...config, accent: v })}
                  onReset={canEdit ? () => setConfig({ ...config, accent: null }) : undefined}
                />

                {([
                  ['showLogo', 'Show company logo'],
                  ['showBankDetails', 'Show bank details'],
                  ['showAttendance', 'Show attendance / paid days'],
                  ['showYearToDate', 'Show year-to-date summary'],
                ] as [keyof Config, string][]).map(([key, label]) => (
                  <Checkbox
                    key={key}
                    label={label}
                    checked={Boolean(config[key])}
                    disabled={!canEdit}
                    onChange={(v) => setConfig({ ...config, [key]: v })}
                  />
                ))}

                <TextField
                  label="Header note (address / tagline)"
                  value={config.headerNote}
                  disabled={!canEdit}
                  maxLength={120}
                  onChange={(v) => setConfig({ ...config, headerNote: v })}
                  placeholder="e.g. 12 MG Road, Bengaluru 560001"
                />
                <TextField
                  label="Signatory label (optional)"
                  value={config.signatoryLabel}
                  disabled={!canEdit}
                  maxLength={80}
                  onChange={(v) => setConfig({ ...config, signatoryLabel: v })}
                  placeholder="e.g. For Acme Pvt Ltd"
                />
              </div>

              <Button
                variant="primary"
                fullWidth
                onClick={handleSave}
                disabled={!canEdit || saving}
                loading={saving}
                style={{ marginTop: '1.1rem' }}
              >
                {saving ? 'Saving…' : (isSuperAdmin ? 'Save format (Super Admin)' : 'Save format (one-time)')}
              </Button>
            </Card>
          </div>

          {/* Live preview */}
          <PayslipPreview accent={accent} config={config} template={selected} />
        </div>
      </main>
    </div>
  );
}

function PayslipPreview({ accent, config, template }: { accent: string; config: Config; template?: Template }) {
  const row = (label: string, value: string, bold = false) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', padding: '2px 0', fontWeight: bold ? 700 : 400, color: bold ? '#111' : '#333' }}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
  return (
    <div style={{ position: 'sticky', top: '1rem' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Live preview — {template?.name || 'Format'}</div>
      <div style={{ background: '#fff', color: '#111', borderRadius: 8, padding: '1rem', boxShadow: 'var(--shadow-3)', fontFamily: 'Helvetica, Arial, sans-serif' }}>
        {/* header */}
        <div style={{ background: template?.header === 'band' ? accent : 'transparent', color: template?.header === 'band' ? '#fff' : accent, padding: template?.header === 'band' ? '0.6rem' : 0, borderRadius: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: template?.header === 'band' ? 'none' : `2px solid ${accent}`, paddingBottom: 6, marginBottom: 8 }}>
          <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>Your Company</div>
          <div style={{ fontSize: '0.7rem', fontWeight: 700 }}>PAYSLIP · Jun 2026</div>
        </div>
        {config.headerNote && <div style={{ fontSize: '0.62rem', color: '#666', marginBottom: 6 }}>{config.headerNote}</div>}
        {/* info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px', fontSize: '0.62rem', color: '#444', marginBottom: 8 }}>
          <span>Emp ID: EMP001</span><span>PAN: ABCDE1234F</span>
          <span>Name: Rajesh Kumar</span><span>UAN: 100200300400</span>
          <span>Designation: Engineer</span>{config.showBankDetails && <span>A/C: XXXX0123</span>}
          {config.showAttendance && <span>Paid Days: 30/30</span>}
        </div>
        {/* earnings / deductions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <div style={{ background: accent, color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '2px 5px', borderRadius: 3 }}>Earnings</div>
            {row('Basic', '50,000.00')}{row('HRA', '20,000.00')}{row('Special', '8,000.00')}
            {row('Gross', '89,350.00', true)}
          </div>
          <div>
            <div style={{ background: accent, color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '2px 5px', borderRadius: 3 }}>Deductions</div>
            {row('PF', '6,000.00')}{row('TDS', '7,500.00')}{row('PT', '200.00')}
            {row('Total', '14,200.00', true)}
          </div>
        </div>
        {/* net */}
        <div style={{ background: accent, color: '#fff', display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.6rem', borderRadius: 4, marginTop: 8, fontWeight: 800, fontSize: '0.8rem' }}>
          <span>NET PAY</span><span>Rs. 75,150.00</span>
        </div>
        <div style={{ fontSize: '0.58rem', fontStyle: 'italic', color: '#444', marginTop: 4 }}>Rupees Seventy Five Thousand One Hundred and Fifty Only</div>
        {config.signatoryLabel && <div style={{ textAlign: 'right', fontSize: '0.6rem', color: '#333', marginTop: 10 }}>{config.signatoryLabel}</div>}
        {/* footer (mandatory) */}
        <div style={{ borderTop: '1px solid #ddd', marginTop: 10, paddingTop: 5 }}>
          <div style={{ textAlign: 'center', fontSize: '0.55rem', fontStyle: 'italic', color: '#666' }}>This is a computer-generated payslip and does not require a signature.</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
            <span style={{ fontSize: '0.52rem', color: '#999' }}>Generated on 21/06/2026</span>
            <span style={{ fontSize: '0.52rem', color: '#00A7B5', fontWeight: 700 }}>Generated from PID HCMS application</span>
          </div>
        </div>
      </div>
    </div>
  );
}
