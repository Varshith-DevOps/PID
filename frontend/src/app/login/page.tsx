'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { login, getPublicTenant } from '@/lib/api';
import { useAuth } from '@/lib/authContext';
import { useToast } from '@/lib/toastContext';
import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';
import ThemeToggle from '@/components/ThemeToggle';
import { Button, Banner, TextField } from '@/components/ui';
import { validateForm, email as vEmail, required } from '@/lib/validators';
import { getTenantSubdomain, workspaceUrl, BASE_DOMAIN } from '@/lib/tenant';
import { isOwnerRole } from '@/lib/platformRoles';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [wrongWorkspace, setWrongWorkspace] = useState<{ subdomain?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [subdomain, setSubdomain] = useState('');
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const router = useRouter();
  const { login: authLogin } = useAuth();
  const { showToast } = useToast();

  const handleSsoSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      // Simulate SAML / OIDC callback validation. 
      // If we attempt login with an unassigned user, it fails and redirects to the SSO request access form.
      const payload = {
        idToken: 'mock-token-azure',
        email: email || 'jit.user@company.com',
        name: 'JIT SSO User'
      };

      const res = await fetch('/api/auth/sso/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok) {
        authLogin(data.token, data.user, data.permissions);
        router.push('/dashboard');
      } else {
        showToast('SSO account is unassigned to any company workspace.', 'error');
        router.push(`/sso-blocked?email=${encodeURIComponent(payload.email)}`);
      }
    } catch (err: any) {
      setError('SSO Sign-in failed. Please try again or contact support.');
    } finally {
      setLoading(false);
    }
  };

  // Resolve the workspace from the host and fetch its public branding.
  useEffect(() => {
    const sub = getTenantSubdomain();
    setSubdomain(sub);
    if (sub) {
      getPublicTenant(sub)
        .then((t) => setWorkspaceName(t?.name || null))
        .catch(() => setWorkspaceName(null));
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setWrongWorkspace(null);
    const { isValid, firstError } = validateForm(
      { email, password },
      { email: vEmail, password: required('Password') }
    );
    if (!isValid) {
      setError(firstError || 'Please correct the highlighted fields.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const data = await login(email, password);
      authLogin(data.token, data.user, data.permissions);
      // Route each kind of account to its own home: app owner → Admin Portal,
      // support → customer picker, tenant users → their dashboard.
      const role = data.user?.role;
      const dest = role === 'SUPPORT' ? '/support'
        : isOwnerRole(role) ? '/platform-admin'
        : '/dashboard';
      router.push(dest);
    } catch (err: any) {
      const resp = err?.response?.data;
      if (resp?.wrongWorkspace) {
        setWrongWorkspace({ subdomain: resp.subdomain });
        setError(resp.error || 'This account does not belong to this workspace.');
      } else {
        // Show the backend's descriptive error (e.g. "Incorrect password",
        // "Account deactivated", "Too many attempts") instead of a generic message.
        setError(resp?.error || 'Login failed. Please check your credentials and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--surface-canvas)',
        position: 'relative',
        overflow: 'hidden',
        padding: '2rem 1rem',
      }}
    >
      {/* Soft brand glow accents (token-driven, subtle in both themes) */}
      <div style={{ position: 'absolute', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, var(--accent-soft), transparent 70%)', top: '-100px', right: '-100px', pointerEvents: 'none', opacity: 0.6 }} />
      <div style={{ position: 'absolute', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, var(--accent-soft), transparent 70%)', bottom: '-50px', left: '-50px', pointerEvents: 'none', opacity: 0.4 }} />

      {/* Theme toggle */}
      <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 2 }}>
        <ThemeToggle />
      </div>

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', justifyContent: 'center', marginBottom: '1rem' }}>
            <BrandLogo variant="primary" height={72} />
          </Link>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: 0 }}>PID hcms</h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem', letterSpacing: '1px', textTransform: 'uppercase' }}>Human Capital Management System</p>
        </div>

        {/* Login Card */}
        <div
          style={{
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-xl)',
            padding: '2.5rem',
            boxShadow: 'var(--shadow-3)',
          }}
        >
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', textAlign: 'center', color: 'var(--text-primary)' }}>
            {subdomain ? `Sign in to ${workspaceName || subdomain}` : 'Welcome Back'}
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '2rem' }}>
            {subdomain ? (
              <>Workspace <strong style={{ color: 'var(--text-secondary)' }}>{subdomain}.{BASE_DOMAIN}</strong></>
            ) : (
              'Sign in to access your dashboard'
            )}
          </p>

          {error && (
            <div style={{ marginBottom: '1.5rem' }}>
              <Banner tone="danger" title={wrongWorkspace ? 'Wrong workspace' : undefined}>
                {error}
                {wrongWorkspace?.subdomain && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <a href={workspaceUrl(wrongWorkspace.subdomain)} style={{ color: 'var(--accent)', fontWeight: 600 }}>
                      Go to {wrongWorkspace.subdomain}.{BASE_DOMAIN} →
                    </a>
                  </div>
                )}
              </Banner>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <TextField
              label="Email Address"
              type="email"
              value={email}
              onChange={setEmail}
              validator={vEmail}
              forceError={submitted}
              required
              placeholder="admin@hrms.com"
            />

            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              validator={required('Password')}
              forceError={submitted}
              required
              placeholder="••••••••"
            />

            <Button type="submit" loading={loading} fullWidth style={{ marginTop: '0.75rem' }}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div style={{ position: 'relative', textAlign: 'center', margin: '1.25rem 0' }}>
            <hr style={{ border: '0', borderTop: '1px solid var(--border-subtle)' }} />
            <span style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', background: 'var(--surface-raised)', padding: '0 0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>OR</span>
          </div>

          <Button 
            type="button" 
            variant="ghost" 
            fullWidth 
            onClick={handleSsoSignIn}
            leftIcon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"/><path d="M12 6V18"/><path d="M6 12H18"/></svg>}
          >
            Sign in with Corporate SSO (SAML)
          </Button>

          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>New to PID hcms? </span>
            <Link href="/signup" style={{ fontSize: '0.85rem', color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Get Started</Link>
          </div>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2rem' }}>
            <strong>Admin:</strong> admin@hrms.com / admin123<br />
            <strong>Employees:</strong> &lt;name&gt;@company.com / employee123
          </p>
        )}
      </div>
    </div>
  );
}
