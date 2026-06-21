'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getBillingPlans, signup } from '@/lib/api';
import { useAuth } from '@/lib/authContext';
import BrandLogo from '@/components/BrandLogo';
import { ValidatedInput } from '@/components/ValidatedField';
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

  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', padding: '3rem 2.5rem', backdropFilter: 'blur(20px)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', marginBottom: '1.5rem', color: '#f87171', fontSize: '0.85rem' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#73E0E7', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>1. Company Configuration</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.4rem' }}>Company Name *</label>
              <ValidatedInput type="text" required placeholder="Acme Corporation" value={companyName} onChange={setCompanyName} validator={required('Company name')} forceError={submitted} style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#fff', fontSize: '0.9rem', outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.4rem' }}>Company Tenant Code *</label>
              <ValidatedInput type="text" required placeholder="acme" value={companyCode} onChange={(v) => setCompanyCode(validateCode(v))} validator={required('Company tenant code')} forceError={submitted} style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#fff', fontSize: '0.9rem', outline: 'none' }} />
              <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginTop: '2px', display: 'block' }}>Lowercase alphanumeric without spaces.</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.4rem' }}>Company Size</label>
              <select value={companySize} onChange={(e) => setCompanySize(e.target.value)} style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#fff', fontSize: '0.9rem', outline: 'none' }}>
                <option value="1-9" style={{ color: '#000' }}>1-9 employees</option>
                <option value="10-50" style={{ color: '#000' }}>10-50 employees</option>
                <option value="51-200" style={{ color: '#000' }}>51-200 employees</option>
                <option value="201-500" style={{ color: '#000' }}>201-500 employees</option>
                <option value="500+" style={{ color: '#000' }}>500+ employees</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.4rem' }}>Industry</label>
              <input type="text" value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Technology / Retail" style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#fff', fontSize: '0.9rem', outline: 'none' }} />
            </div>
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#182B6D', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>2. Account Owner Access</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.4rem' }}>Admin Name *</label>
              <ValidatedInput type="text" required placeholder="John Doe" value={name} onChange={setName} validator={personName('Admin name')} restrict="alpha" forceError={submitted} style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#fff', fontSize: '0.9rem', outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.4rem' }}>Admin Work Email *</label>
              <ValidatedInput type="email" required placeholder="admin@acme.com" value={email} onChange={setEmail} validator={vEmail} forceError={submitted} style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#fff', fontSize: '0.9rem', outline: 'none' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.4rem' }}>Admin Phone</label>
              <ValidatedInput type="tel" inputMode="numeric" placeholder="9999999999" value={phone} onChange={setPhone} validator={vMobile} restrict="digits" maxLength={10} forceError={submitted} style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#fff', fontSize: '0.9rem', outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.4rem' }}>Password *</label>
              <ValidatedInput type="password" required placeholder="At least 12 chars" value={password} onChange={setPassword} validator={vPassword} forceError={submitted} style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#fff', fontSize: '0.9rem', outline: 'none' }} />
            </div>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.4rem' }}>Select Platform Subscription Plan</label>
          <select value={selectedPlanId} onChange={(e) => setSelectedPlanId(e.target.value)} style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#fff', fontSize: '0.9rem', outline: 'none' }}>
            {plans.map((p) => (
              <option key={p.id} value={p.id} style={{ color: '#000' }}>
                {p.name} - ₹{p.price.toLocaleString()} / month (30-day Free Trial)
              </option>
            ))}
          </select>
        </div>

        <button type="submit" disabled={loading} style={{ width: '100%', padding: '0.9rem', marginTop: '1rem', background: 'linear-gradient(135deg, #00A7B5, #182B6D)', color: 'white', border: 'none', borderRadius: '10px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.95rem', boxShadow: '0 4px 16px rgba(0,167,181,0.3)' }}>
          {loading ? 'Registering Workspace...' : 'Create Account & Continue'}
        </button>
      </form>

      <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
        <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)' }}>Already registered? </span>
        <Link href="/login" style={{ fontSize: '0.85rem', color: '#00A7B5', textDecoration: 'none', fontWeight: 600 }}>Sign In</Link>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0e1a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem', fontFamily: 'system-ui, sans-serif', relative: 'true', overflowX: 'hidden' } as any}>
      <div style={{ position: 'absolute', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,167,181,0.1), transparent 70%)', top: '-10%', right: '-10%', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(24,43,109,0.08), transparent 70%)', bottom: '-10%', left: '-10%', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: '650px', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', justifyContent: 'center', marginBottom: '1rem' }}>
            <BrandLogo variant="dark" height={70} />
          </Link>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>Create Your PID hcms Organization</h1>
          <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.25rem' }}>Setup tenant workspaces, scoping variables, and administrative access</p>
        </div>

        <Suspense fallback={<div style={{ textAlign: 'center', color: '#fff' }}>Loading onboarding configuration...</div>}>
          <SignupContent />
        </Suspense>
      </div>
    </div>
  );
}
