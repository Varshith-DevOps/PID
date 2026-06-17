'use client';

import Link from 'next/link';

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
      color: '#3b82f6'
    },
    {
      title: 'Time & Productivity',
      features: [
        'Real-time biometric log ingestion and device drift management.',
        'Geofencing limits and IP-restrictions for mobile check-ins.',
        'Flexible leave quota assignments, auto-accrual engines, and approval workflows.',
        'Interactive roster builders, night shift differentials, and weekly holiday calendars.'
      ],
      color: '#8b5cf6'
    },
    {
      title: 'Finance & Compliance',
      features: [
        'Statutory deduction calculators (PF, Professional Tax, ESI, and TDS formulas).',
        'Bulk payroll runs with step-by-step reviews and approvals audits.',
        'Employee expense claim scanning and travel advance advances.',
        'Interactive compliance obligations calendar with built-in templates.'
      ],
      color: '#10b981'
    },
    {
      title: 'Performance & Talent',
      features: [
        '360-degree peer feedback reviews with custom review questions.',
        'Key Result Areas (KRAs) mapping per role/department with target weights.',
        'ATS module with job postings, candidate pipelines, and scheduling.',
        'Structured learning courses with custom lessons and certification.'
      ],
      color: '#f59e0b'
    },
    {
      title: 'AI Agents & Intelligence',
      features: [
        'Jarvis AI: Deep-scan monthly payroll and timesheets to flag statutory compliance anomalies.',
        'Sherlock AI: Automate TDS proof auditing and validation to eliminate fraud leakage.',
        'Athena NLP: Provide instant natural language responses to complex employee policy queries.',
        'Winston AI: Intelligent attendance tracking with smart auto-regularization triggers.'
      ],
      color: '#a78bfa'
    }
  ];

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
          <Link href="/features" style={{ color: '#fff', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600 }}>Features</Link>
          <Link href="/pricing" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}>Pricing</Link>
          <Link href="/contact" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}>Contact</Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/login" style={{ color: '#fff', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600, padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}>Sign In</Link>
          <Link href="/signup" style={{ textDecoration: 'none', fontSize: '0.9rem', fontWeight: 700, padding: '0.5rem 1.25rem', borderRadius: '8px', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: '#fff' }}>Start Trial</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth: '800px', margin: '0 auto', padding: '5rem 1.5rem 4rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 900, marginBottom: '1.5rem', background: 'linear-gradient(to right, #fff, #93c5fd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Powerful Enterprise Features</h1>
        <p style={{ fontSize: '1.15rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
          Designed to automate every pillar of modern HR. Fully integrated, cloud-isolated, and scalable for international workspaces.
        </p>
      </section>

      {/* Features Grid */}
      <section style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem 8rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem' }}>
        {categories.map((c, idx) => (
          <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '20px', padding: '3rem 2.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#fff' }}>
              <span style={{ width: 12, height: 12, borderRadius: '4px', background: c.color, display: 'inline-block' }} />
              {c.title}
            </h2>
            <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem', lineHeight: 1.6 }}>
              {c.features.map((f, fIdx) => (
                <li key={fIdx}>{f}</li>
              ))}
            </ul>
          </div>
        ))}
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
