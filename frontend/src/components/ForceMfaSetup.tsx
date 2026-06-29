'use client';

/**
 * @fileoverview Forced MFA enrolment gate for owner-side accounts.
 * When the backend flags `mustSetupMfa` (REQUIRE_PLATFORM_MFA=true and the platform
 * account has no MFA), this blocks the app until the user enrols an authenticator.
 * @module components/ForceMfaSetup
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/authContext';
import { setupMfa, enableMfa } from '@/lib/api';
import { Modal, Button, Banner } from '@/components/ui';

export default function ForceMfaSetup() {
  const { user } = useAuth();
  const [secret, setSecret] = useState('');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const active = !!user?.mustSetupMfa;

  useEffect(() => {
    if (!active || secret) return;
    setupMfa()
      .then((d) => { setSecret(d.secret); setOtpauthUrl(d.otpauthUrl); })
      .catch(() => setError('Could not start MFA setup. Refresh and try again.'));
  }, [active, secret]);

  if (!active) return null;

  const handleEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(code)) { setError('Enter the 6-digit code from your authenticator app.'); return; }
    setSubmitting(true);
    try {
      const res = await enableMfa(code);
      setRecoveryCodes(res.recoveryCodes || []);
    } catch {
      setError('That code was not valid. Check the time on your device and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open title="Set up two-factor authentication" width={460}>
      {recoveryCodes ? (
        <div>
          <Banner tone="success" title="MFA enabled">Save these one-time recovery codes somewhere safe — each works once if you lose your device.</Banner>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', margin: '1rem 0', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
            {recoveryCodes.map((c) => <code key={c} style={{ background: 'var(--surface-sunken)', padding: '0.3rem 0.5rem', borderRadius: 6 }}>{c}</code>)}
          </div>
          <Button fullWidth onClick={() => window.location.reload()}>Continue</Button>
        </div>
      ) : (
        <form onSubmit={handleEnable}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
            Your platform account requires two-factor authentication. Add this secret to an authenticator
            app (Google Authenticator, Authy, 1Password), then enter the 6-digit code.
          </p>
          <div style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '0.85rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Setup key</div>
            <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.95rem', wordBreak: 'break-all', color: 'var(--text-primary)' }}>{secret || '…'}</code>
            {otpauthUrl && <div style={{ marginTop: 6 }}><a href={otpauthUrl} style={{ fontSize: '0.72rem', color: 'var(--accent)' }}>Open in authenticator</a></div>}
          </div>
          <div className="form-group">
            <label className="form-label">6-digit code</label>
            <input className="input-field" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="123456" autoFocus />
          </div>
          {error && <div style={{ marginBottom: '1rem' }}><Banner tone="danger">{error}</Banner></div>}
          <Button type="submit" fullWidth loading={submitting} disabled={!secret}>Verify & enable</Button>
        </form>
      )}
    </Modal>
  );
}
