'use client';

import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';

export default function PrivacyPage() {
  return (
    <div style={{ background: 'var(--surface-canvas)', color: 'var(--text-primary)', minHeight: '100vh', overflowX: 'hidden' }}>
      <MarketingNav />

      {/* Main Content */}
      <section style={{ maxWidth: '800px', margin: '0 auto', padding: '5rem 1.5rem 8rem', lineHeight: 1.8 }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '2rem', color: 'var(--text-primary)' }}>Privacy Policy</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>Last updated: June 14, 2026</p>

        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2.5rem', marginBottom: '1rem' }}>1. Data Storage & Multi-Tenancy</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          PID hcms is built on a secure multi-tenant SQLite/Prisma architecture. Tenant isolation middlewares strictly scope query executions so your company's digital employee records, payroll, shifts, and leaves are completely partitioned from other organizations.
        </p>

        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2.5rem', marginBottom: '1rem' }}>2. Information We Collect</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          To operate the SaaS service, we collect account details (company name, employee emails, directory metadata) and billing transaction tokens. Biometric punch logs and geofencing coordinates are only ingested to enable shift regularizations when explicitly configured by your HR administrators.
        </p>

        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2.5rem', marginBottom: '1rem' }}>3. Data Retentions</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Upon subscription expiration or account cancellation, your tenant database state is retained for 30 days before being purged permanently from our backup registries.
        </p>
      </section>

      <MarketingFooter />
    </div>
  );
}

function MarketingNav() {
  return (
    <nav style={{ background: 'var(--surface-nav)' }}>
      <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.5rem', position: 'relative', zIndex: 10 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }}>
          <BrandLogo variant="dark" height={42} />
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <Link href="/features" style={{ color: 'var(--text-on-nav-muted)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}>Features</Link>
          <Link href="/pricing" style={{ color: 'var(--text-on-nav-muted)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}>Pricing</Link>
          <Link href="/contact" style={{ color: 'var(--text-on-nav-muted)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}>Contact</Link>
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
