'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/api';
import { useAuth } from '@/lib/authContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login: authLogin } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(email, password);
      authLogin(data.token, data.user, data.permissions);
      router.push('/dashboard');
    } catch (err) {
      setError('Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0e1a', position: 'relative', overflow: 'hidden' }}>
      {/* Animated background elements */}
      <div style={{ position: 'absolute', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.12), transparent 70%)', top: '-100px', right: '-100px', animation: 'float 8s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.1), transparent 70%)', bottom: '-50px', left: '-50px', animation: 'float 10s ease-in-out infinite reverse' }} />
      <div style={{ position: 'absolute', width: '200px', height: '200px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.08), transparent 70%)', top: '40%', left: '20%', animation: 'float 12s ease-in-out infinite' }} />

      {/* Grid lines background */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)', backgroundSize: '60px 60px', opacity: 0.5 }} />

      <div style={{ width: '100%', maxWidth: '420px', padding: '0 1rem', position: 'relative', zIndex: 1, animation: 'fadeInUp 0.6s ease' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ width: 64, height: 64, margin: '0 auto 1rem', borderRadius: '16px', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px rgba(59,130,246,0.3)' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.5px' }}>NexusHR</h1>
          <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.25rem', letterSpacing: '2px', textTransform: 'uppercase' }}>Human Resource Management</p>
        </div>

        {/* Login Card */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '2.5rem', backdropFilter: 'blur(20px)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', textAlign: 'center', color: 'rgba(255,255,255,0.95)' }}>Welcome Back</h2>
          <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: '2rem' }}>Sign in to access your dashboard</p>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', marginBottom: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              <span style={{ fontSize: '0.85rem', color: '#f87171' }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'rgba(255,255,255,0.6)', marginBottom: '0.4rem' }}>Email Address</label>
              <div style={{ position: 'relative' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                  <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="admin@hrms.com" style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.75rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: 'rgba(255,255,255,0.95)', fontSize: '0.9rem', outline: 'none', transition: 'all 0.3s ease', fontFamily: 'inherit' }} onFocus={(e) => { e.target.style.borderColor = 'rgba(59,130,246,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; }} onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }} />
              </div>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'rgba(255,255,255,0.6)', marginBottom: '0.4rem' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.75rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: 'rgba(255,255,255,0.95)', fontSize: '0.9rem', outline: 'none', transition: 'all 0.3s ease', fontFamily: 'inherit' }} onFocus={(e) => { e.target.style.borderColor = 'rgba(59,130,246,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; }} onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }} />
              </div>
            </div>

            <button type="submit" disabled={loading} style={{ width: '100%', padding: '0.85rem', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: 'white', border: 'none', borderRadius: '10px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.95rem', transition: 'all 0.3s ease', opacity: loading ? 0.7 : 1, boxShadow: '0 4px 16px rgba(59,130,246,0.3)', fontFamily: 'inherit', letterSpacing: '0.5px' }} onMouseEnter={(e) => { if (!loading) { (e.target as HTMLButtonElement).style.boxShadow = '0 8px 24px rgba(59,130,246,0.5)'; (e.target as HTMLButtonElement).style.transform = 'translateY(-1px)'; }}} onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(59,130,246,0.3)'; (e.target as HTMLButtonElement).style.transform = 'translateY(0)'; }}>
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <span style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin-slow 0.8s linear infinite' }} />
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Footer hint - Development only */}
        {process.env.NODE_ENV === 'development' && (
          <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '2rem' }}>
            <strong>Admin:</strong> admin@hrms.com / admin123<br/>
            <strong>Employees:</strong> &lt;name&gt;@company.com / employee123
          </p>
        )}
      </div>
    </div>
  );
}