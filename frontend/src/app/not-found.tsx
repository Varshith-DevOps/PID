'use client';

import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--surface-canvas)',
        backgroundImage: 'radial-gradient(circle at 50% 50%, var(--accent-soft) 0%, transparent 60%)',
        color: 'var(--text-primary)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '24px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Decorative gradient glow bubbles */}
      <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '40vw', height: '40vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0, 167, 181, 0.15), transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '45vw', height: '45vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(24, 43, 109, 0.2), transparent 70%)', pointerEvents: 'none' }} />

      <div
        style={{
          maxWidth: '480px',
          width: '100%',
          padding: '48px 32px',
          borderRadius: '24px',
          backgroundColor: 'rgba(21, 21, 24, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.4), inset 0 0 16px rgba(255, 255, 255, 0.02)',
          backdropFilter: 'blur(20px)',
          zIndex: 1,
          animation: 'slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}
      >
        {/* Brand Header */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
          <BrandLogo variant="primary" height={52} />
        </div>

        {/* 404 Status Code Graphic */}
        <div
          style={{
            fontSize: '96px',
            fontWeight: 900,
            lineHeight: 1,
            background: 'linear-gradient(135deg, #00A7B5 30%, #73E0E7 70%, #182B6D)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-2px',
            marginBottom: '16px',
            filter: 'drop-shadow(0 4px 12px rgba(0, 167, 181, 0.3))'
          }}
        >
          404
        </div>

        <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)' }}>
          Page Not Found
        </h1>
        
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '32px' }}>
          The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
        </p>

        {/* Navigation Quick Links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Link
            href="/dashboard"
            style={{
              padding: '12px 24px',
              backgroundColor: '#00A7B5',
              color: '#fff',
              textDecoration: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              transition: 'all 0.2s',
              boxShadow: '0 4px 16px rgba(0, 167, 181, 0.25)',
              display: 'inline-block'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#008a96'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#00A7B5'; e.currentTarget.style.transform = 'none'; }}
          >
            Back to Dashboard
          </Link>
          
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '8px' }}>
            <Link
              href="/learning"
              style={{
                flex: 1,
                padding: '10px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: 'var(--text-primary)',
                textDecoration: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 500,
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'; }}
            >
              LMS Portal
            </Link>
            
            <Link
              href="/helpdesk"
              style={{
                flex: 1,
                padding: '10px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: 'var(--text-primary)',
                textDecoration: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 500,
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'; }}
            >
              Helpdesk
            </Link>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes slideUpFade {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
