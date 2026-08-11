'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';
import { Button, TextField, Banner } from '@/components/ui';
import { email as vEmail } from '@/lib/validators';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setError(null);
    setMessage(null);

    const emailErr = vEmail(email);
    if (emailErr) return;

    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage(data.message || 'If an account exists for this email, a password reset link has been sent.');
      } else {
        setError(data.error || 'Failed to request password reset. Please try again.');
      }
    } catch {
      setError('Connection error. Please check your network and try again.');
    } finally {
      setLoading(false);
    }
  };

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
      <div style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', justifyContent: 'center', marginBottom: '1rem' }}>
            <BrandLogo variant="primary" height={72} />
          </Link>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: 0 }}>PID hcms</h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem', letterSpacing: '1px', textTransform: 'uppercase' }}>Human Capital Management System</p>
        </div>

        <div
          style={{
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-xl)',
            padding: '2.5rem',
            boxShadow: 'var(--shadow-3)',
          }}
        >
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', textAlign: 'center', color: 'var(--text-primary)' }}>
            Reset Password
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '2rem' }}>
            Enter your email address and we will send you instructions to reset your password.
          </p>

          {error && (
            <div style={{ marginBottom: '1.5rem' }}>
              <Banner tone="danger">{error}</Banner>
            </div>
          )}

          {message ? (
            <div style={{ textAlign: 'center' }}>
              <Banner tone="success">{message}</Banner>
              <div style={{ marginTop: '1.5rem' }}>
                <Link href="/login">
                  <Button variant="ghost" fullWidth>Return to Sign In</Button>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <TextField
                label="Email Address"
                type="email"
                value={email}
                onChange={setEmail}
                validator={vEmail}
                forceError={submitted}
                required
                placeholder="aarav.sharma@hrms.com"
              />

              <Button type="submit" loading={loading} fullWidth style={{ marginTop: '1rem' }}>
                {loading ? 'Sending Link...' : 'Send Reset Link'}
              </Button>

              <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
                <Link href="/login" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
                  ← Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
