'use client';

import Link from 'next/link';
import { useState } from 'react';
import { submitContactRequest } from '@/lib/api';
import BrandLogo from '@/components/BrandLogo';
import { ValidatedInput, ValidatedTextarea } from '@/components/ValidatedField';
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
    <div style={{ background: '#070a13', color: '#f3f4f6', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', overflowX: 'hidden' }}>
      {/* Navbar */}
      <nav style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.5rem', position: 'relative', zIndex: 10 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', color: '#fff' }}>
          <BrandLogo variant="dark" height={42} />
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <Link href="/features" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}>Features</Link>
          <Link href="/pricing" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}>Pricing</Link>
          <Link href="/contact" style={{ color: '#fff', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600 }}>Contact</Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/login" style={{ color: '#fff', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600, padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}>Sign In</Link>
          <Link href="/signup" style={{ textDecoration: 'none', fontSize: '0.9rem', fontWeight: 700, padding: '0.5rem 1.25rem', borderRadius: '8px', background: 'linear-gradient(135deg, #00A7B5, #182B6D)', color: '#fff' }}>Start Trial</Link>
        </div>
      </nav>

      {/* Main Content */}
      <section style={{ maxWidth: '1000px', margin: '0 auto', padding: '5rem 1.5rem 8rem', display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '4rem' }}>
        {/* Text Area */}
        <div>
          <h1 style={{ fontSize: '2.8rem', fontWeight: 900, marginBottom: '1.5rem', background: 'linear-gradient(to right, #fff, #BFEFF4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Connect With Our HR Specialists</h1>
          <p style={{ fontSize: '1.05rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, marginBottom: '2.5rem' }}>
            Looking for custom pricing for 500+ employees, an on-premise cloud deployment architecture, or a tailored product demo? Let us know.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(0,167,181,0.1)', border: '1px solid rgba(0,167,181,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00A7B5" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Phone Support</div>
                <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: 600 }}>+91 (80) 4928-1029</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(24,43,109,0.1)', border: '1px solid rgba(24,43,109,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#182B6D" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Sales Email</div>
                <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: 600 }}>sales@pid-hcms.com</div>
              </div>
            </div>
          </div>
        </div>

        {/* Form Card */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px', padding: '3rem 2.5rem' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', marginBottom: '1.5rem' }}>Book a Demo Request</h2>

          {success && (
            <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              <strong>Thank you!</strong> Your request has been logged successfully. An HR consultant will contact you via email within 24 hours.
            </div>
          )}

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.4rem' }}>Full Name *</label>
              <ValidatedInput type="text" required value={name} onChange={setName} validator={personName('Full name')} restrict="alpha" forceError={submitted} style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#fff', fontSize: '0.9rem', outline: 'none' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.4rem' }}>Work Email *</label>
              <ValidatedInput type="email" required value={email} onChange={setEmail} validator={vEmail} forceError={submitted} style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#fff', fontSize: '0.9rem', outline: 'none' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.4rem' }}>Phone Number</label>
                <ValidatedInput type="tel" inputMode="numeric" value={phone} onChange={setPhone} validator={vPhone} restrict="digits" maxLength={15} forceError={submitted} style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#fff', fontSize: '0.9rem', outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.4rem' }}>Company Name</label>
                <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#fff', fontSize: '0.9rem', outline: 'none' }} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.4rem' }}>What requirements are you looking for? *</label>
              <ValidatedTextarea required rows={4} value={message} onChange={setMessage} validator={required('Message')} forceError={submitted} style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#fff', fontSize: '0.9rem', outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
            </div>

            <button type="submit" disabled={loading} style={{ width: '100%', padding: '0.85rem', background: 'linear-gradient(135deg, #00A7B5, #182B6D)', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '0.95rem', cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Submitting request...' : 'Book Product Demo'}
            </button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: '#05070e', padding: '4rem 1.5rem 3rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)' }}>
          <span>&copy; {new Date().getFullYear()} PID hcms. All rights reserved.</span>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <Link href="/privacy" style={{ color: 'inherit', textDecoration: 'none' }}>Privacy</Link>
            <Link href="/terms" style={{ color: 'inherit', textDecoration: 'none' }}>Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
