'use client';

import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';
import { Card } from '@/components/ui';

export default function FeaturesPage() {
  const categories = [
    {
      title: 'Workforce & Directory',
      features: [
        'Secure digital employee records with self-service profiles.',
        'Custom onboarding checklists, automatic welcome packets, and document upload.',
        'Dynamic org chart with real-time reporting hierarchies.',
        'Custom workflow triggers for employee life events (promotion, exit, probation).'
      ],
      color: 'var(--accent)'
    },
    {
      title: 'Time & Productivity',
      features: [
        'Real-time biometric log ingestion and device drift management.',
        'Geofencing limits and IP-restrictions for mobile check-ins.',
        'Flexible leave quota assignments, auto-accrual engines, and approval workflows.',
        'Interactive roster builders, night shift differentials, and weekly holiday calendars.'
      ],
      color: 'var(--trust)'
    },
    {
      title: 'Finance & Compliance',
      features: [
        'Statutory deduction calculators (PF, Professional Tax, ESI, and TDS formulas).',
        'Bulk payroll runs with step-by-step reviews and approvals audits.',
        'Employee expense claim scanning and travel advance advances.',
        'Interactive compliance obligations calendar with built-in templates.'
      ],
      color: 'var(--success-fg)'
    },
    {
      title: 'Performance & Talent',
      features: [
        '360-degree peer feedback reviews with custom review questions.',
        'Key Result Areas (KRAs) mapping per role/department with target weights.',
        'ATS module with job postings, candidate pipelines, and scheduling.',
        'Structured learning courses with custom lessons and certification.'
      ],
      color: 'var(--warning-fg)'
    },
    {
      title: 'AI Agents & Intelligence',
      features: [
        'Jarvis AI: Deep-scan monthly payroll and timesheets to flag statutory compliance anomalies.',
        'Sherlock AI: Automate TDS proof auditing and validation to eliminate fraud leakage.',
        'Athena NLP: Provide instant natural language responses to complex employee policy queries.',
        'Winston AI: Intelligent attendance tracking with smart auto-regularization triggers.'
      ],
      color: 'var(--accent)'
    }
  ];

  return (
    <div style={{ background: 'var(--surface-canvas)', color: 'var(--text-primary)', minHeight: '100vh', overflowX: 'hidden' }}>
      <MarketingNav active="features" />

      {/* Hero */}
      <section style={{ maxWidth: '800px', margin: '0 auto', padding: '5rem 1.5rem 4rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 900, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Powerful Enterprise Features</h1>
        <p style={{ fontSize: '1.15rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Designed to automate every pillar of modern HR. Fully integrated, cloud-isolated, and scalable for international workspaces.
        </p>
      </section>

      {/* Features Grid */}
      <section style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem 8rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem' }}>
        {categories.map((c, idx) => (
          <Card key={idx} padded style={{ borderRadius: '20px', padding: '3rem 2.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-primary)' }}>
              <span style={{ width: 12, height: 12, borderRadius: '4px', background: c.color, display: 'inline-block' }} />
              {c.title}
            </h2>
            <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.6 }}>
              {c.features.map((f, fIdx) => (
                <li key={fIdx}>{f}</li>
              ))}
            </ul>
          </Card>
        ))}
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
