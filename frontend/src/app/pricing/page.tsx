'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getBillingPlans } from '@/lib/api';

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
          <Link href="/pricing" style={{ color: '#fff', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600 }}>Pricing</Link>
          <Link href="/contact" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}>Contact</Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/login" style={{ color: '#fff', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600, padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}>Sign In</Link>
          <Link href="/signup" style={{ textDecoration: 'none', fontSize: '0.9rem', fontWeight: 700, padding: '0.5rem 1.25rem', borderRadius: '8px', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: '#fff' }}>Start Trial</Link>
        </div>
      </nav>

      {/* Header */}
      <section style={{ maxWidth: '800px', margin: '0 auto', padding: '5rem 1.5rem 2rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 900, marginBottom: '1.5rem', background: 'linear-gradient(to right, #fff, #93c5fd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Flexible Plans For Every Stage</h1>
        <p style={{ fontSize: '1.15rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
          All plans start with a 30-day free trial on our sandbox servers. Switch or cancel your subscription at any time.
        </p>
      </section>

      {/* Cards */}
      <section style={{ maxWidth: '1200px', margin: '0 auto', padding: '3rem 1.5rem 8rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
        {loading ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem 0' }}>
            <span style={{ display: 'inline-block', width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#3b82f6', animation: 'spin 1s linear infinite' }} />
            <p style={{ marginTop: '1rem', color: 'rgba(255,255,255,0.4)' }}>Fetching current subscription rates...</p>
          </div>
        ) : (
          plans.map((p) => {
            const isProfessional = p.name === 'Professional';
            const features = getPlanFeatures(p.name);
            return (
              <div
                key={p.id}
                style={{
                  background: isProfessional ? 'rgba(59,130,246,0.05)' : 'rgba(255,255,255,0.02)',
                  border: isProfessional ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '24px',
                  padding: '3rem 2.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative'
                }}
              >
                {isProfessional && (
                  <div style={{ position: 'absolute', top: 20, right: 24, background: '#3b82f6', color: '#fff', fontSize: '0.75rem', fontWeight: 800, padding: '0.25rem 0.75rem', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Most Popular
                  </div>
                )}
                
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', marginBottom: '0.5rem' }}>{p.name}</h3>
                <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1.5rem' }}>
                  Up to {p.employeeLimit} employees
                </p>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '2rem' }}>
                  <span style={{ fontSize: '2.5rem', fontWeight: 900, color: '#fff' }}>₹{p.price.toLocaleString()}</span>
                  <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.4)' }}>/ month</span>
                </div>

                <Link
                  href={`/signup?planId=${p.id}`}
                  style={{
                    textDecoration: 'none',
                    textAlign: 'center',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    padding: '0.85rem',
                    borderRadius: '12px',
                    background: isProfessional ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)' : 'rgba(255,255,255,0.05)',
                    color: '#fff',
                    border: isProfessional ? 'none' : '1px solid rgba(255,255,255,0.1)',
                    marginBottom: '2.5rem',
                    boxShadow: isProfessional ? '0 4px 20px rgba(59,130,246,0.3)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  Start 30-Day Free Trial
                </Link>

                <div style={{ marginTop: 'auto' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff', marginBottom: '1rem' }}>Included Features:</div>
                  <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {features.map((f, fIdx) => (
                      <li key={fIdx} style={{ display: 'flex', alignItems: 'start', gap: '0.5rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" style={{ marginTop: '2px', flexShrink: 0 }}><polyline points="20 6 9 17 4 12" /></svg>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          }).concat(
            <div
              key="custom-sales"
              style={{
                background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(59,130,246,0.08))',
                border: '1px dashed rgba(139,92,246,0.3)',
                borderRadius: '24px',
                padding: '3rem 2.5rem',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative'
              }}
            >
              <div style={{ position: 'absolute', top: 20, right: 24, background: '#8b5cf6', color: '#fff', fontSize: '0.75rem', fontWeight: 800, padding: '0.25rem 0.75rem', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Tailored Fit
              </div>
              
              <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', marginBottom: '0.5rem' }}>Custom Plan</h3>
              <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1.5rem' }}>
                Custom enterprise scale
              </p>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '2rem' }}>
                <span style={{ fontSize: '2.25rem', fontWeight: 900, color: '#fff' }}>Contact Sales</span>
              </div>

              <Link
                href="/contact?plan=custom"
                style={{
                  textDecoration: 'none',
                  textAlign: 'center',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  padding: '0.85rem',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.1)',
                  marginBottom: '2.5rem',
                  transition: 'all 0.2s'
                }}
              >
                Contact Sales Team
              </Link>

              <div style={{ marginTop: 'auto' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff', marginBottom: '1rem' }}>Tailored Benefits:</div>
                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <li style={{ display: 'flex', alignItems: 'start', gap: '0.5rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" style={{ marginTop: '2px', flexShrink: 0 }}><polyline points="20 6 9 17 4 12" /></svg>
                    <span>Unlimited Employee Limits</span>
                  </li>
                  <li style={{ display: 'flex', alignItems: 'start', gap: '0.5rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" style={{ marginTop: '2px', flexShrink: 0 }}><polyline points="20 6 9 17 4 12" /></svg>
                    <span>Granular Feature Access Selection</span>
                  </li>
                  <li style={{ display: 'flex', alignItems: 'start', gap: '0.5rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" style={{ marginTop: '2px', flexShrink: 0 }}><polyline points="20 6 9 17 4 12" /></svg>
                    <span>Full AI Agents Suite (Jarvis, Winston, Sherlock, Athena)</span>
                  </li>
                  <li style={{ display: 'flex', alignItems: 'start', gap: '0.5rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" style={{ marginTop: '2px', flexShrink: 0 }}><polyline points="20 6 9 17 4 12" /></svg>
                    <span>Custom Billing & SLA Agreements</span>
                  </li>
                </ul>
              </div>
            </div>
          )
        )}
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
