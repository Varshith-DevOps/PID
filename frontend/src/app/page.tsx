'use client';

import Link from 'next/link';
import { useState } from 'react';
import BrandLogo from '@/components/BrandLogo';
import ThemeToggle from '@/components/ThemeToggle';
import { Button } from '@/components/ui';

export default function MarketingHomePage() {
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  const modules = [
    {
      title: 'Core HR & Directory',
      desc: 'Centralized directory, paperless document workflows, and automated employee onboarding.',
      color: 'var(--accent)',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )
    },
    {
      title: 'Attendance & Roster',
      desc: 'Biometric device synchronization, geofencing clock-ins, and automated shift scheduling.',
      color: 'var(--trust)',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      )
    },
    {
      title: 'Compliance & Payroll',
      desc: 'Automated tax deductions (TDS, PF, ESI), salary structure builder, and instant payslips.',
      color: 'var(--success-fg)',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <line x1="12" y1="4" x2="12" y2="20" />
          <line x1="2" y1="12" x2="22" y2="12" />
        </svg>
      )
    },
    {
      title: 'Appraisals & Feedback',
      desc: '360-degree feedback, KRA settings, performance reviews, and employee goal logs.',
      color: 'var(--warning-fg)',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      )
    },
    {
      title: 'Learning & Onboarding',
      desc: 'Create training programs, track progress certificates, and guide new recruits.',
      color: 'var(--accent)',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      )
    },
    {
      title: 'Helpdesk & Assets',
      desc: 'Track office hardware allocations, software licenses, and resolve ticket requests.',
      color: 'var(--trust)',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      )
    },
    {
      title: 'AI Agents & Intelligence',
      desc: 'Audit payroll anomalies with Jarvis, check tax compliance proofs with Sherlock, regularize roster drift with Winston, and query company policies with Athena.',
      color: 'var(--accent)',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a10 10 0 0 1 7.54 16.59l-1.42-1.42A8 8 0 1 0 6.18 7.82L4.76 6.4A10 10 0 0 1 12 2z" />
          <path d="M12 6a6 6 0 0 1 4.52 9.95l-1.42-1.42A4 4 0 1 0 8.9 9.18L7.48 7.76A6 6 0 0 1 12 6z" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      )
    }
  ];

  const navLinkStyle: React.CSSProperties = { color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500, transition: 'color 0.2s' };

  return (
    <div style={{ background: 'var(--surface-canvas)', color: 'var(--text-primary)', minHeight: '100vh', overflowX: 'hidden' }}>
      {/* Decorative brand glow (token-driven, subtle in both themes) */}
      <div style={{ position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)', width: '80%', height: '600px', background: 'radial-gradient(circle, var(--accent-soft), transparent 70%)', pointerEvents: 'none', zIndex: 0, opacity: 0.6 }} />
      <div style={{ position: 'absolute', top: '50%', right: '-10%', width: '600px', height: '600px', background: 'radial-gradient(circle, var(--accent-soft), transparent 70%)', pointerEvents: 'none', zIndex: 0, opacity: 0.4 }} />

      {/* Navigation Header */}
      <nav style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.5rem 1.5rem', position: 'relative', zIndex: 10 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }}>
          <BrandLogo variant="primary" height={42} />
        </Link>

        {/* Links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <Link href="/features" style={navLinkStyle}>Features</Link>
          <Link href="/pricing" style={navLinkStyle}>Pricing</Link>
          <Link href="/contact" style={navLinkStyle}>Contact</Link>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ThemeToggle compact />
          <Button href="/login" variant="ghost" size="sm">Sign In</Button>
          <Button href="/signup" size="sm">Start Trial</Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={{ maxWidth: '1200px', margin: '0 auto', padding: '6rem 1.5rem 4rem', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: 'var(--radius-full)', background: 'var(--accent-soft)', border: '1px solid var(--accent-soft)', marginBottom: '2rem', color: 'var(--accent-on-soft)', fontSize: '0.85rem', fontWeight: 600 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
          <span>People, Intelligence and Development hcms</span>
        </div>

        <h1 style={{ fontSize: '3.5rem', fontWeight: 900, lineHeight: 1.15, letterSpacing: '-1.5px', marginBottom: '1.5rem', color: 'var(--text-primary)', maxWidth: '850px', marginLeft: 'auto', marginRight: 'auto' }}>
          PID hcms for Growing Companies
        </h1>

        <p style={{ fontSize: '1.15rem', color: 'var(--text-secondary)', maxWidth: '650px', margin: '0 auto 3rem', lineHeight: 1.6 }}>
          People, Intelligence and Development human capital management system brings onboarding, attendance, payroll, OKRs, and expenses into one secure portal.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          <Button href="/signup" size="lg">Get Started For Free</Button>
          <Button href="/contact" variant="ghost" size="lg">Book Product Demo</Button>
        </div>

        {/* Mock Graphic Container */}
        <div style={{ marginTop: '5rem', position: 'relative', width: '100%', height: '450px', background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)', padding: '12px', boxShadow: 'var(--shadow-3)', overflow: 'hidden' }}>
          <div style={{ width: '100%', height: '100%', borderRadius: 'var(--radius-lg)', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column' }}>
            {/* Window control dots */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--danger)' }} />
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--warning)' }} />
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--success)' }} />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '12px' }}>portal.pid-hcms.com/dashboard</span>
            </div>

            {/* Dashboard Content Mock */}
            <div style={{ flex: 1, padding: '24px', display: 'flex', gap: '20px', textAlign: 'left' }}>
              <div style={{ width: '220px', borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ height: 28, borderRadius: 'var(--radius-xs)', background: 'var(--accent-soft)', width: '80%' }} />
                <div style={{ height: 18, borderRadius: 'var(--radius-xs)', background: 'var(--surface-raised)', width: '60%' }} />
                <div style={{ height: 18, borderRadius: 'var(--radius-xs)', background: 'var(--surface-raised)', width: '70%' }} />
                <div style={{ height: 18, borderRadius: 'var(--radius-xs)', background: 'var(--surface-raised)', width: '50%' }} />
                <div style={{ height: 18, borderRadius: 'var(--radius-xs)', background: 'var(--surface-raised)', width: '65%' }} />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Employees</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '4px', color: 'var(--accent)' }}>48</div>
                  </div>
                  <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Leaves Pending</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '4px', color: 'var(--warning-fg)' }}>5</div>
                  </div>
                  <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active Tasks</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '4px', color: 'var(--success-fg)' }}>12</div>
                  </div>
                </div>
                <div style={{ flex: 1, borderRadius: 'var(--radius-md)', background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', padding: '20px' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)' }}>Monthly Payroll Distribution</div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', height: '120px', paddingBottom: '10px' }}>
                    <div style={{ width: '40px', height: '40%', background: 'var(--accent)', borderRadius: '4px 4px 0 0' }} />
                    <div style={{ width: '40px', height: '60%', background: 'var(--accent)', borderRadius: '4px 4px 0 0' }} />
                    <div style={{ width: '40px', height: '55%', background: 'var(--accent)', borderRadius: '4px 4px 0 0' }} />
                    <div style={{ width: '40px', height: '85%', background: 'var(--trust)', borderRadius: '4px 4px 0 0' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social proof/Stats section */}
      <section style={{ borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-raised)', padding: '4rem 1.5rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: '3rem', fontWeight: 900, color: 'var(--accent)' }}>20,000+</div>
            <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Active employee files managed</div>
          </div>
          <div>
            <div style={{ fontSize: '3rem', fontWeight: 900, color: 'var(--success-fg)' }}>99.99%</div>
            <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Platform uptime SLA achieved</div>
          </div>
          <div>
            <div style={{ fontSize: '3rem', fontWeight: 900, color: 'var(--warning-fg)' }}>50%+</div>
            <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Reduction in administrative HR hours</div>
          </div>
        </div>
      </section>

      {/* Modules section */}
      <section style={{ maxWidth: '1200px', margin: '0 auto', padding: '8rem 1.5rem', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '5rem' }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-1px', marginBottom: '1rem', color: 'var(--text-primary)' }}>All-In-One Enterprise Architecture</h2>
          <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
            Powering everything from payroll accounting to helpdesk tickets under a unified company dashboard.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
          {modules.map((m, idx) => (
            <div
              key={idx}
              onMouseEnter={() => setHoveredCard(idx)}
              onMouseLeave={() => setHoveredCard(null)}
              style={{
                background: 'var(--surface-raised)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: '2.5rem 2rem',
                transition: 'transform var(--motion-base, 0.3s) var(--ease-out, cubic-bezier(0.4, 0, 0.2, 1)), box-shadow var(--motion-base, 0.3s), border-color var(--motion-base, 0.3s)',
                transform: hoveredCard === idx ? 'translateY(-6px)' : 'translateY(0)',
                boxShadow: hoveredCard === idx ? 'var(--shadow-3)' : 'var(--shadow-1)',
                borderColor: hoveredCard === idx ? 'var(--accent)' : 'var(--border-subtle)',
              }}
            >
              <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)', color: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                {m.icon}
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>{m.title}</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Teaser / CTA */}
      <section style={{ maxWidth: '1200px', margin: '0 auto 8rem', padding: '0 1.5rem', position: 'relative', zIndex: 1 }}>
        <div style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-xl)', padding: '5rem 2rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--text-primary)' }}>Start Modernizing Your HR Operations Today</h2>
          <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto 2.5rem' }}>
            Sign up now for a 30-day free trial on the Professional plan. No credit card required. Cancel anytime.
          </p>
          <Button href="/signup" size="lg">Get Started Free</Button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-nav)', padding: '5rem 1.5rem 3rem', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '3rem', marginBottom: '4rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <BrandLogo variant="dark" height={34} />
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-on-nav-muted)', lineHeight: 1.6, maxWidth: '280px' }}>
              The cloud-hosted HRMS software platform designed to optimize workforce directories, biometrics, compliance, and salaries.
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-on-nav)', marginBottom: '1.25rem' }}>Product</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <Link href="/features" style={{ fontSize: '0.85rem', color: 'var(--text-on-nav-muted)', textDecoration: 'none' }}>Features</Link>
              <Link href="/pricing" style={{ fontSize: '0.85rem', color: 'var(--text-on-nav-muted)', textDecoration: 'none' }}>Pricing Plans</Link>
              <Link href="/login" style={{ fontSize: '0.85rem', color: 'var(--text-on-nav-muted)', textDecoration: 'none' }}>Sign In</Link>
            </div>
          </div>
          <div>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-on-nav)', marginBottom: '1.25rem' }}>Company</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <Link href="/contact" style={{ fontSize: '0.85rem', color: 'var(--text-on-nav-muted)', textDecoration: 'none' }}>Contact Us</Link>
              <Link href="/contact" style={{ fontSize: '0.85rem', color: 'var(--text-on-nav-muted)', textDecoration: 'none' }}>Book Demo</Link>
            </div>
          </div>
          <div>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-on-nav)', marginBottom: '1.25rem' }}>Legal</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <Link href="/privacy" style={{ fontSize: '0.85rem', color: 'var(--text-on-nav-muted)', textDecoration: 'none' }}>Privacy Policy</Link>
              <Link href="/terms" style={{ fontSize: '0.85rem', color: 'var(--text-on-nav-muted)', textDecoration: 'none' }}>Terms of Service</Link>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: '1200px', margin: '0 auto', paddingTop: '2rem', borderTop: '1px solid var(--border-on-nav)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-on-nav-muted)' }}>
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
