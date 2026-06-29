'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getBillingPlans } from '@/lib/api';
import BrandLogo from '@/components/BrandLogo';
import { Button, Card, Spinner } from '@/components/ui';

interface Plan {
  id: string;
  name: string;
  price: number;
  employeeLimit: number;
  isActive: boolean;
}

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPlans() {
      try {
        const data = await getBillingPlans();
        setPlans(data);
      } catch (err) {
        console.error('Failed to load plans from backend:', err);
        // Fallback default plans in case of connection latency
        setPlans([
          { id: '1', name: 'Starter', price: 2999, employeeLimit: 15, isActive: true },
          { id: '2', name: 'Professional', price: 5999, employeeLimit: 50, isActive: true },
          { id: '3', name: 'Enterprise', price: 12999, employeeLimit: 500, isActive: true }
        ]);
      } finally {
        setLoading(false);
      }
    }
    loadPlans();
  }, []);

  const getPlanFeatures = (planName: string) => {
    switch (planName) {
      case 'Starter':
        return [
          'Up to 15 Active Employees',
          'Core HR & Digital Profiles',
          'Shift & Attendance Management',
          'Standard Leave Approvals',
          'Athena AI Policy Assistant',
          'Self-Service Portal'
        ];
      case 'Professional':
        return [
          'Up to 50 Active Employees',
          'Everything in Starter',
          'Automated Statutory Payroll',
          'Winston AI Attendance Agent',
          '360 Review & Performance',
          'Direct Email Payslips'
        ];
      case 'Enterprise':
      default:
        return [
          'Up to 500 Active Employees',
          'Everything in Professional',
          'Jarvis & Sherlock compliance AI agents',
          'Recruitment ATS Pipeline',
          'Custom Workflow Builders',
          'Dedicated Customer Success Manager'
        ];
    }
  };

  const featureItem = (text: string, idx?: number) => (
    <li key={idx} style={{ display: 'flex', alignItems: 'start', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success-fg)" strokeWidth="3" style={{ marginTop: '2px', flexShrink: 0 }}><polyline points="20 6 9 17 4 12" /></svg>
      <span>{text}</span>
    </li>
  );

  return (
    <div style={{ background: 'var(--surface-canvas)', color: 'var(--text-primary)', minHeight: '100vh', overflowX: 'hidden' }}>
      <MarketingNav active="pricing" />

      {/* Header */}
      <section style={{ maxWidth: '800px', margin: '0 auto', padding: '5rem 1.5rem 2rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 900, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Flexible Plans For Every Stage</h1>
        <p style={{ fontSize: '1.15rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          All plans start with a 30-day free trial on our sandbox servers. Switch or cancel your subscription at any time.
        </p>
      </section>

      {/* Cards */}
      <section style={{ maxWidth: '1200px', margin: '0 auto', padding: '3rem 1.5rem 8rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
        {loading ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem 0' }}>
            <Spinner size={32} />
            <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Fetching current subscription rates...</p>
          </div>
        ) : (
          plans.map((p) => {
            const isProfessional = p.name === 'Professional';
            const features = getPlanFeatures(p.name);
            return (
              <Card
                key={p.id}
                padded
                style={{
                  border: isProfessional ? '2px solid var(--accent)' : '1px solid var(--border-subtle)',
                  borderRadius: '24px',
                  padding: '3rem 2.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  background: isProfessional ? 'var(--accent-soft)' : 'var(--surface-raised)'
                }}
              >
                {isProfessional && (
                  <div style={{ position: 'absolute', top: 20, right: 24, background: 'var(--accent)', color: 'var(--text-on-accent)', fontSize: '0.75rem', fontWeight: 800, padding: '0.25rem 0.75rem', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Most Popular
                  </div>
                )}

                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{p.name}</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1.5rem' }}>
                  Up to {p.employeeLimit} employees
                </p>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '2rem' }}>
                  <span style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--text-primary)' }}>₹{p.price.toLocaleString()}</span>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>/ month</span>
                </div>

                <Button
                  href={`/signup?planId=${p.id}`}
                  variant={isProfessional ? 'primary' : 'ghost'}
                  fullWidth
                  style={{ justifyContent: 'center', marginBottom: '2.5rem' }}
                >
                  Start 30-Day Free Trial
                </Button>

                <div style={{ marginTop: 'auto' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>Included Features:</div>
                  <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {features.map((f, fIdx) => featureItem(f, fIdx))}
                  </ul>
                </div>
              </Card>
            );
          }).concat(
            <Card
              key="custom-sales"
              padded
              style={{
                background: 'var(--surface-raised)',
                border: '1px dashed var(--border-subtle)',
                borderRadius: '24px',
                padding: '3rem 2.5rem',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative'
              }}
            >
              <div style={{ position: 'absolute', top: 20, right: 24, background: 'var(--trust)', color: 'var(--text-on-accent)', fontSize: '0.75rem', fontWeight: 800, padding: '0.25rem 0.75rem', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Tailored Fit
              </div>

              <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Custom Plan</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1.5rem' }}>
                Custom enterprise scale
              </p>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '2rem' }}>
                <span style={{ fontSize: '2.25rem', fontWeight: 900, color: 'var(--text-primary)' }}>Contact Sales</span>
              </div>

              <Button
                href="/contact?plan=custom"
                variant="ghost"
                fullWidth
                style={{ justifyContent: 'center', marginBottom: '2.5rem' }}
              >
                Contact Sales Team
              </Button>

              <div style={{ marginTop: 'auto' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>Tailored Benefits:</div>
                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {featureItem('Unlimited Employee Limits')}
                  {featureItem('Granular Feature Access Selection')}
                  {featureItem('Full AI Agents Suite (Jarvis, Winston, Sherlock, Athena)')}
                  {featureItem('Custom Billing & SLA Agreements')}
                </ul>
              </div>
            </Card>
          )
        )}
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
