'use client';

import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';

export default function TermsPage() {
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
          <Link href="/contact" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}>Contact</Link>
        </div>
      </nav>

      {/* Main Content */}
      <section style={{ maxWidth: '800px', margin: '0 auto', padding: '5rem 1.5rem 8rem', lineHeight: 1.8 }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '2rem', color: '#fff' }}>Terms of Service</h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', marginBottom: '2rem' }}>Last updated: June 14, 2026</p>

        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', marginTop: '2.5rem', marginBottom: '1rem' }}>1. Services Agreement</h2>
        <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '1.5rem' }}>
          By creating a tenant company and initiating a subscription on PID hcms, you agree to comply with our fair-use employee quotas. The maximum active employee limits per plan are: Starter (15), Professional (50), and Enterprise (500). Exceeding these limits blocks new file additions.
        </p>

        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', marginTop: '2.5rem', marginBottom: '1rem' }}>2. Subscription Billing & Trials</h2>
        <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '1.5rem' }}>
          Each tenant registration starts with a 30-day sandbox trial. Thereafter, the account is converted to active status upon processing mock/real transactions. Subscriptions auto-renew monthly unless suspended.
        </p>

        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', marginTop: '2.5rem', marginBottom: '1rem' }}>3. Service Availability</h2>
        <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '1.5rem' }}>
          We aim to provide 99.99% service availability. Maintenance slots are restricted to weekend windows and communicated in advance via the tenant dashboard notifications center.
        </p>
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
