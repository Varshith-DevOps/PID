'use client';

import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div style={{ background: '#070a13', color: '#f3f4f6', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', overflowX: 'hidden' }}>
      {/* Navbar */}
      <nav style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.5rem', position: 'relative', zIndex: 10 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', color: '#fff' }}>
          <div style={{ width: 40, height: 40, borderRadius: '10px', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
          </div>
          <span style={{ fontSize: '1.3rem', fontWeight: 800, background: 'linear-gradient(135deg, #fff, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>NexusHR</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <Link href="/features" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}>Features</Link>
          <Link href="/pricing" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}>Pricing</Link>
          <Link href="/contact" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}>Contact</Link>
        </div>
      </nav>

      {/* Main Content */}
      <section style={{ maxWidth: '800px', margin: '0 auto', padding: '5rem 1.5rem 8rem', lineHeight: 1.8 }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '2rem', color: '#fff' }}>Privacy Policy</h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', marginBottom: '2rem' }}>Last updated: June 14, 2026</p>

        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', marginTop: '2.5rem', marginBottom: '1rem' }}>1. Data Storage & Multi-Tenancy</h2>
        <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '1.5rem' }}>
          NexusHR is built on a secure multi-tenant SQLite/Prisma architecture. Tenant isolation middlewares strictly scope query executions so your company's digital employee records, payroll, shifts, and leaves are completely partitioned from other organizations.
        </p>

        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', marginTop: '2.5rem', marginBottom: '1rem' }}>2. Information We Collect</h2>
        <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '1.5rem' }}>
          To operate the SaaS service, we collect account details (company name, employee emails, directory metadata) and billing transaction tokens. Biometric punch logs and geofencing coordinates are only ingested to enable shift regularizations when explicitly configured by your HR administrators.
        </p>

        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', marginTop: '2.5rem', marginBottom: '1rem' }}>3. Data Retentions</h2>
        <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '1.5rem' }}>
          Upon subscription expiration or account cancellation, your tenant database state is retained for 30 days before being purged permanently from our backup registries.
        </p>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: '#05070e', padding: '4rem 1.5rem 3rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)' }}>
          <span>&copy; {new Date().getFullYear()} NexusHR. All rights reserved.</span>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <Link href="/privacy" style={{ color: 'inherit', textDecoration: 'none' }}>Privacy</Link>
            <Link href="/terms" style={{ color: 'inherit', textDecoration: 'none' }}>Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
