'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';
import ThemeToggle from '@/components/ThemeToggle';
import { Button, Banner, TextField } from '@/components/ui';
import { validateForm, email as vEmail, required } from '@/lib/validators';
import { submitSsoAccessRequest } from '@/lib/api';

function SsoBlockedForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('');
  const [justification, setJustification] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setError('');

    const { isValid, firstError } = validateForm(
      { email, fullName },
      { email: vEmail, fullName: required('Full Name') }
    );

    if (!isValid) {
      setError(firstError || 'Please correct the highlighted fields.');
      return;
    }

    setLoading(true);
    try {
      await submitSsoAccessRequest({
        email,
        fullName,
        department: department || undefined,
        justification: justification || undefined,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to submit access request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>
          Access Request Submitted
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
          Your request has been successfully queued. The Tenant Administrator has been notified to review and assign your profile credentials. You will receive an email once approved.
        </p>
        <Button variant="ghost" fullWidth onClick={() => router.push('/login')}>
          Back to Login
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', textAlign: 'center', color: 'var(--text-primary)' }}>
        Access Request Gateway
      </h2>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '1.5rem', lineHeight: 1.5 }}>
        SSO authentication completed, but you are not assigned to a company workspace profile. Request access from administrators below.
      </p>

      {error && (
        <div style={{ marginBottom: '1.5rem' }}>
          <Banner tone="danger">{error}</Banner>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <TextField
          label="Corporate Email Address"
          type="email"
          value={email}
          onChange={setEmail}
          validator={vEmail}
          forceError={submitted}
          required
          placeholder="yourname@corporate.com"
        />

        <TextField
          label="Your Full Name"
          type="text"
          value={fullName}
          onChange={setFullName}
          validator={required('Full Name')}
          forceError={submitted}
          required
          placeholder="John Doe"
        />

        <TextField
          label="Department / Team (Optional)"
          type="text"
          value={department}
          onChange={setDepartment}
          placeholder="e.g. Technology, Operations"
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '0.5rem' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Justification / Notes (Optional)</label>
          <textarea
            placeholder="Provide context for your access request..."
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            style={{ minHeight: '80px', padding: '8px', backgroundColor: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.8rem', resize: 'vertical' }}
          />
        </div>

        <Button type="submit" loading={loading} fullWidth style={{ marginTop: '0.5rem' }}>
          Submit Request
        </Button>
      </form>

      <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
        <Link href="/login" style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 600 }}>
          Cancel & Back to Login
        </Link>
      </div>
    </div>
  );
}

export default function SsoBlockedPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--surface-canvas)',
        position: 'relative',
        overflow: 'hidden',
        padding: '2rem 1rem',
      }}
    >
      <div style={{ position: 'absolute', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, var(--accent-soft), transparent 70%)', top: '-100px', right: '-100px', pointerEvents: 'none', opacity: 0.6 }} />
      <div style={{ position: 'absolute', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, var(--accent-soft), transparent 70%)', bottom: '-50px', left: '-50px', pointerEvents: 'none', opacity: 0.4 }} />

      <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 2 }}>
        <ThemeToggle />
      </div>

      <div style={{ width: '100%', maxWidth: '440px', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
            <BrandLogo variant="primary" height={56} />
          </Link>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>PID hcms</h1>
        </div>

        <div
          style={{
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-xl)',
            padding: '2rem 2.25rem',
            boxShadow: 'var(--shadow-3)',
          }}
        >
          <Suspense fallback={<div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading request session...</div>}>
            <SsoBlockedForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
