'use client';

import Link from 'next/link';
import { useState } from 'react';
import { submitContactRequest } from '@/lib/api';
import BrandLogo from '@/components/BrandLogo';
import { Button, Card, Banner, TextField, Textarea } from '@/components/ui';
import { validateForm, email as vEmail, phone as vPhone, personName, required } from '@/lib/validators';

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const { isValid, firstError } = validateForm(
      { name, email, phone, message },
      { name: personName('Full name'), email: vEmail, phone: vPhone, message: required('Message') }
    );
    if (!isValid) {
      setError(firstError || 'Please correct the highlighted fields.');
      setSuccess(false);
      return;
    }
    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      await submitContactRequest({ name, email, phone, companyName, message });
      setSuccess(true);
      setName('');
      setEmail('');
      setPhone('');
      setCompanyName('');
      setMessage('');
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to submit contact request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: 'var(--surface-canvas)', color: 'var(--text-primary)', minHeight: '100vh', overflowX: 'hidden' }}>
      <MarketingNav active="contact" />

      {/* Main Content */}
      <section style={{ maxWidth: '1000px', margin: '0 auto', padding: '5rem 1.5rem 8rem', display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '4rem' }}>
        {/* Text Area */}
        <div>
          <h1 style={{ fontSize: '2.8rem', fontWeight: 900, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Connect With Our HR Specialists</h1>
          <p style={{ fontSize: '1.05rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '2.5rem' }}>
            Looking for custom pricing for 500+ employees, an on-premise cloud deployment architecture, or a tailored product demo? Let us know.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accent-soft)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Phone Support</div>
                <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 600 }}>+91 (80) 4928-1029</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accent-soft)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--trust)" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sales Email</div>
                <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 600 }}>sales@pid-hcms.com</div>
              </div>
            </div>
          </div>
        </div>

        {/* Form Card */}
        <Card padded style={{ borderRadius: '24px', padding: '3rem 2.5rem' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1.5rem' }}>Book a Demo Request</h2>

          {success && (
            <Banner tone="success" title="Thank you!" style={{ marginBottom: '1.5rem' }}>
              Your request has been logged successfully. An HR consultant will contact you via email within 24 hours.
            </Banner>
          )}

          {error && (
            <Banner tone="danger" style={{ marginBottom: '1.5rem' }}>
              {error}
            </Banner>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <TextField
              label="Full Name"
              required
              type="text"
              value={name}
              onChange={setName}
              validator={personName('Full name')}
              restrict="alpha"
              forceError={submitted}
            />

            <TextField
              label="Work Email"
              required
              type="email"
              value={email}
              onChange={setEmail}
              validator={vEmail}
              forceError={submitted}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <TextField
                label="Phone Number"
                type="tel"
                value={phone}
                onChange={setPhone}
                validator={vPhone}
                restrict="digits"
                maxLength={15}
                forceError={submitted}
              />
              <TextField
                label="Company Name"
                type="text"
                value={companyName}
                onChange={setCompanyName}
              />
            </div>

            <Textarea
              label="What requirements are you looking for?"
              required
              value={message}
              onChange={setMessage}
              validator={required('Message')}
              forceError={submitted}
            />

            <Button type="submit" variant="primary" fullWidth loading={loading} style={{ justifyContent: 'center' }}>
              {loading ? 'Submitting request...' : 'Book Product Demo'}
            </Button>
          </form>
        </Card>
      </section>

      <MarketingFooter />
    </div>
  );
}

function MarketingNav({ active }: { active: 'features' | 'pricing' | 'contact' }) {
  const link = (key: 'features' | 'pricing' | 'contact', href: string, label: string) => (
    <Link
      href={href}
      style={{
        color: active === key ? 'var(--text-on-nav)' : 'var(--text-on-nav-muted)',
        textDecoration: 'none',
        fontSize: '0.9rem',
        fontWeight: active === key ? 600 : 500,
      }}
    >
      {label}
    </Link>
  );
  return (
    <nav style={{ background: 'var(--surface-nav)' }}>
      <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.5rem', position: 'relative', zIndex: 10 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }}>
          <BrandLogo variant="dark" height={42} />
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          {link('features', '/features', 'Features')}
          {link('pricing', '/pricing', 'Pricing')}
          {link('contact', '/contact', 'Contact')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/login" style={{ color: 'var(--text-on-nav)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600, padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border-on-nav)', background: 'rgba(255,255,255,0.04)' }}>Sign In</Link>
          <Link href="/signup" style={{ textDecoration: 'none', fontSize: '0.9rem', fontWeight: 700, padding: '0.5rem 1.25rem', borderRadius: '8px', background: 'var(--accent)', color: 'var(--text-on-accent)' }}>Start Trial</Link>
        </div>
      </div>
    </nav>
  );
}

function MarketingFooter() {
  return (
    <footer style={{ borderTop: '1px solid var(--border-on-nav)', background: 'var(--surface-nav)', padding: '4rem 1.5rem 3rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-on-nav-muted)' }}>
        <span>&copy; {new Date().getFullYear()} PID hcms. All rights reserved.</span>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <Link href="/privacy" style={{ color: 'inherit', textDecoration: 'none' }}>Privacy</Link>
          <Link href="/terms" style={{ color: 'inherit', textDecoration: 'none' }}>Terms</Link>
        </div>
      </div>
    </footer>
  );
}
