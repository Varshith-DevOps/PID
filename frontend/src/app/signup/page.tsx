'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getBillingPlans, signup } from '@/lib/api';
import { useAuth } from '@/lib/authContext';
import BrandLogo from '@/components/BrandLogo';
import ThemeToggle from '@/components/ThemeToggle';
import { Button, Banner, TextField, Select } from '@/components/ui';
import { validateForm, email as vEmail, mobile as vMobile, personName, password as vPassword, required } from '@/lib/validators';

interface Plan {
  id: string;
  name: string;
  price: number;
}

function SignupContent() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [companyName, setCompanyName] = useState('');
  const [companyCode, setCompanyCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [companySize, setCompanySize] = useState('10-50');
  const [industry, setIndustry] = useState('Technology');
  const [selectedPlanId, setSelectedPlanId] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login: authLogin } = useAuth();

  useEffect(() => {
    async function loadPlans() {
      try {
        const data = await getBillingPlans();
        setPlans(data);
        const queryPlanId = searchParams.get('planId');
        if (queryPlanId) {
          setSelectedPlanId(queryPlanId);
        } else if (data.length > 0) {
          const profPlan = data.find((p: any) => p.name === 'Professional') || data[0];
          setSelectedPlanId(profPlan.id);
        }
      } catch (err) {
        console.error(err);
        setPlans([
          { id: '1', name: 'Starter', price: 2999 },
          { id: '2', name: 'Professional', price: 5999 },
          { id: '3', name: 'Enterprise', price: 12999 }
        ]);
        setSelectedPlanId('2');
      }
    }
    loadPlans();
  }, [searchParams]);

  const validateCode = (val: string) => {
    return val.toLowerCase().replace(/[^a-z0-9-]/g, '');
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const { isValid, firstError } = validateForm(
      { companyName, companyCode, name, email, phone, password },
      {
        companyName: required('Company name'),
        companyCode: required('Company tenant code'),
        name: personName('Admin name'),
        email: vEmail,
        phone: vMobile,
        password: vPassword
      }
    );
    if (!isValid) {
      setError(firstError || 'Please correct the highlighted fields.');
      return;
    }
    setError('');
    setLoading(true);

    if (password.length < 12) {
      setError('Password must be at least 12 characters long');
      setLoading(false);
      return;
    }

    try {
      const data = await signup({
        companyName,
        companyCode: companyCode.toLowerCase(),
        email,
        password,
        name,
        phone,
        companySize,
        industry,
        planId: selectedPlanId
      });

      authLogin(data.token, data.user, data.permissions);
      router.push(`/checkout?planId=${selectedPlanId}`);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Registration failed. Check if email/company code is already in use.');
    } finally {
      setLoading(false);
    }
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: '1rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    borderBottom: '1px solid var(--border-subtle)',
    paddingBottom: '0.5rem',
    marginBottom: '1rem',
  };

  return (
    <div
      style={{
        background: 'var(--surface-raised)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-xl)',
        padding: '3rem 2.5rem',
        boxShadow: 'var(--shadow-3)',
      }}
    >
      {error && (
        <div style={{ marginBottom: '1.5rem' }}>
          <Banner tone="danger">{error}</Banner>
        </div>
      )}

      <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <h3 style={sectionTitle}>1. Company Configuration</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <TextField
              label="Company Name"
              required
              placeholder="Acme Corporation"
              value={companyName}
              onChange={setCompanyName}
              validator={required('Company name')}
              forceError={submitted}
            />
            <TextField
              label="Company Tenant Code"
              required
              placeholder="acme"
              value={companyCode}
              onChange={(v) => setCompanyCode(validateCode(v))}
              validator={required('Company tenant code')}
              forceError={submitted}
              help="Lowercase alphanumeric without spaces."
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
            <Select
              label="Company Size"
              value={companySize}
              onChange={setCompanySize}
              options={[
                { value: '1-9', label: '1-9 employees' },
                { value: '10-50', label: '10-50 employees' },
                { value: '51-200', label: '51-200 employees' },
                { value: '201-500', label: '201-500 employees' },
                { value: '500+', label: '500+ employees' },
              ]}
            />
            <TextField
              label="Industry"
              value={industry}
              onChange={setIndustry}
              placeholder="Technology / Retail"
            />
          </div>
        </div>

        <div>
          <h3 style={sectionTitle}>2. Account Owner Access</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <TextField
              label="Admin Name"
              required
              placeholder="John Doe"
              value={name}
              onChange={setName}
              validator={personName('Admin name')}
              restrict="alpha"
              forceError={submitted}
            />
            <TextField
              label="Admin Work Email"
              type="email"
              required
              placeholder="admin@acme.com"
              value={email}
              onChange={setEmail}
              validator={vEmail}
              forceError={submitted}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
            <TextField
              label="Admin Phone"
              type="tel"
              placeholder="9999999999"
              value={phone}
              onChange={setPhone}
              validator={vMobile}
              restrict="digits"
              maxLength={10}
              forceError={submitted}
            />
            <TextField
              label="Password"
              type="password"
              required
              placeholder="At least 12 chars"
              value={password}
              onChange={setPassword}
              validator={vPassword}
              forceError={submitted}
            />
          </div>
        </div>

        <Select
          label="Select Platform Subscription Plan"
          value={selectedPlanId}
          onChange={setSelectedPlanId}
          options={plans.map((p) => ({
            value: p.id,
            label: `${p.name} - ₹${p.price.toLocaleString()} / month (30-day Free Trial)`,
          }))}
        />

        <Button type="submit" loading={loading} fullWidth style={{ marginTop: '0.5rem' }}>
          {loading ? 'Registering Workspace...' : 'Create Account & Continue'}
        </Button>
      </form>

      <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Already registered? </span>
        <Link href="/login" style={{ fontSize: '0.85rem', color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Sign In</Link>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--surface-canvas)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
        position: 'relative',
        overflowX: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, var(--accent-soft), transparent 70%)', top: '-10%', right: '-10%', pointerEvents: 'none', opacity: 0.6 }} />
      <div style={{ position: 'absolute', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, var(--accent-soft), transparent 70%)', bottom: '-10%', left: '-10%', pointerEvents: 'none', opacity: 0.4 }} />

      <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 2 }}>
        <ThemeToggle />
      </div>

      <div style={{ width: '100%', maxWidth: '650px', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', justifyContent: 'center', marginBottom: '1rem' }}>
            <BrandLogo variant="primary" height={70} />
          </Link>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Create Your PID hcms Organization</h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Setup tenant workspaces, scoping variables, and administrative access</p>
        </div>

        <Suspense fallback={<div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Loading onboarding configuration...</div>}>
          <SignupContent />
        </Suspense>
      </div>
    </div>
  );
}
