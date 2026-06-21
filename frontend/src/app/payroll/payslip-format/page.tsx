'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import Sidebar from '@/components/Sidebar';
import { getPayslipTemplate, updatePayslipTemplate } from '@/lib/api';

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
        <main className="main-content"><div style={{ padding: '2rem', color: '#94a3b8' }}>Loading payslip formats…</div></main>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar activePath="/payroll/payslip-format" />
      <main className="main-content" style={{ padding: '1.5rem 2rem 3rem' }}>
        <div style={{ marginBottom: '1.25rem' }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#e5e7eb', margin: 0 }}>Payslip Format</h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '0.35rem' }}>
            Choose one of 8 formats for your company payslips. Every format shows all mandatory payroll data.
          </p>
        </div>

        {/* Lock / permission banner */}
        {locked && (
          <div style={{
            display: 'flex', gap: '0.6rem', alignItems: 'flex-start', padding: '0.9rem 1rem', borderRadius: '10px',
            marginBottom: '1.25rem',
            background: canEdit ? 'rgba(124,58,237,0.1)' : 'rgba(245,158,11,0.1)',
            border: `1px solid ${canEdit ? 'rgba(124,58,237,0.35)' : 'rgba(245,158,11,0.35)'}`,
            color: canEdit ? '#c4b5fd' : '#fcd34d',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <div style={{ fontSize: '0.85rem', lineHeight: 1.4 }}>
              {canEdit
                ? 'This format is locked for the company Admin. As PID hcms Super Admin, you can still change it.'
                : (lockedMessage || 'This payslip format is locked. Contact the PID hcms Super Admin team to make further changes.')}
            </div>
          </div>
        )}
        {!locked && canEdit && (
          <div style={{ padding: '0.9rem 1rem', borderRadius: '10px', marginBottom: '1.25rem', background: 'rgba(0,167,181,0.08)', border: '1px solid rgba(0,167,181,0.3)', color: '#67e8f9', fontSize: '0.85rem', lineHeight: 1.4 }}>
            You can choose and customize the payslip format <strong>once</strong>. After you save, further changes will require the PID hcms Super Admin team.
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
                      textAlign: 'left', padding: '0.9rem', borderRadius: '12px', cursor: canEdit ? 'pointer' : 'not-allowed',
                      background: active ? 'rgba(0,167,181,0.08)' : 'rgba(255,255,255,0.02)',
                      border: `2px solid ${active ? '#00A7B5' : 'rgba(255,255,255,0.08)'}`,
                      opacity: canEdit || active ? 1 : 0.7, transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                      <span style={{ width: 14, height: 14, borderRadius: 4, background: t.accent, display: 'inline-block', border: '1px solid rgba(255,255,255,0.2)' }} />
                      <span style={{ fontWeight: 700, color: '#e5e7eb', fontSize: '0.95rem' }}>{t.name}</span>
                      {active && <span style={{ marginLeft: 'auto', color: '#00A7B5', fontSize: '0.75rem', fontWeight: 700 }}>SELECTED</span>}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.4 }}>{t.description}</div>
                  </button>
                );
              })}
            </div>

            {/* Customization */}
            <div style={{ marginTop: '1.5rem', padding: '1.1rem', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#e5e7eb', margin: '0 0 0.85rem' }}>Customize</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem', color: '#cbd5e1' }}>
                  <span style={{ width: 120 }}>Accent colour</span>
                  <input type="color" value={accent} disabled={!canEdit}
                    onChange={(e) => setConfig({ ...config, accent: e.target.value })}
                    style={{ width: 44, height: 30, background: 'none', border: 'none', cursor: canEdit ? 'pointer' : 'not-allowed' }} />
                  <button type="button" disabled={!canEdit} onClick={() => setConfig({ ...config, accent: null })}
                    style={{ fontSize: '0.72rem', color: '#94a3b8', background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '0.25rem 0.5rem', cursor: canEdit ? 'pointer' : 'not-allowed' }}>
                    Use template default
                  </button>
                </label>

                {([
                  ['showLogo', 'Show company logo'],
                  ['showBankDetails', 'Show bank details'],
                  ['showAttendance', 'Show attendance / paid days'],
                  ['showYearToDate', 'Show year-to-date summary'],
                ] as [keyof Config, string][]).map(([key, label]) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', color: '#cbd5e1' }}>
                    <input type="checkbox" checked={Boolean(config[key])} disabled={!canEdit}
                      onChange={(e) => setConfig({ ...config, [key]: e.target.checked })} />
                    {label}
                  </label>
                ))}

                <label style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                  <div style={{ marginBottom: 4 }}>Header note (address / tagline)</div>
                  <input type="text" value={config.headerNote} disabled={!canEdit} maxLength={120}
                    onChange={(e) => setConfig({ ...config, headerNote: e.target.value })}
                    placeholder="e.g. 12 MG Road, Bengaluru 560001"
                    className="input-field" style={{ width: '100%' }} />
                </label>
                <label style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                  <div style={{ marginBottom: 4 }}>Signatory label (optional)</div>
                  <input type="text" value={config.signatoryLabel} disabled={!canEdit} maxLength={80}
                    onChange={(e) => setConfig({ ...config, signatoryLabel: e.target.value })}
                    placeholder="e.g. For Acme Pvt Ltd"
                    className="input-field" style={{ width: '100%' }} />
                </label>
              </div>

              <button onClick={handleSave} disabled={!canEdit || saving}
                style={{
                  marginTop: '1.1rem', width: '100%', padding: '0.75rem', borderRadius: '10px', border: 'none',
                  fontWeight: 700, fontSize: '0.9rem', color: '#fff',
                  background: canEdit ? 'linear-gradient(135deg, #00A7B5, #182B6D)' : 'rgba(255,255,255,0.1)',
                  cursor: canEdit && !saving ? 'pointer' : 'not-allowed', opacity: saving ? 0.7 : 1,
                }}>
                {saving ? 'Saving…' : (isSuperAdmin ? 'Save format (Super Admin)' : 'Save format (one-time)')}
              </button>
            </div>
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
      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Live preview — {template?.name || 'Format'}</div>
      <div style={{ background: '#fff', color: '#111', borderRadius: 8, padding: '1rem', boxShadow: '0 10px 30px rgba(0,0,0,0.3)', fontFamily: 'Helvetica, Arial, sans-serif' }}>
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
