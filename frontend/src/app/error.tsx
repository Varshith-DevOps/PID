'use client';

import { useEffect } from 'react';
import BrandLogo from '@/components/BrandLogo';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error details to console/service
    console.error('App Boundary Catch:', error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--surface-canvas)',
        backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(239, 68, 68, 0.05) 0%, transparent 60%)',
        color: 'var(--text-primary)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '24px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Decorative gradient glow bubbles */}
      <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '40vw', height: '40vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(239, 68, 68, 0.08), transparent 70%)', pointerEvents: 'none' }} />
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

        {/* Warning Icon */}
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '2px solid rgba(239, 68, 68, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px auto',
            boxShadow: '0 8px 24px rgba(239, 68, 68, 0.15)'
          }}
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)' }}>
          Something Went Wrong
        </h1>
        
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '24px' }}>
          The application encountered an unexpected runtime error. Our systems have logged the diagnostics report.
        </p>

        {/* Diagnostic Block */}
        <div
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '10px',
            padding: '12px 16px',
            textAlign: 'left',
            fontFamily: 'monospace',
            fontSize: '11px',
            color: 'rgba(255, 255, 255, 0.65)',
            marginBottom: '32px',
            maxHeight: '120px',
            overflowY: 'auto',
            wordBreak: 'break-all'
          }}
        >
          <span style={{ color: '#ef4444', fontWeight: 600 }}>Error:</span> {error.message || 'Unknown runtime error'}
          {error.digest && (
            <div style={{ marginTop: '4px' }}>
              <span style={{ color: '#00A7B5' }}>Digest:</span> {error.digest}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => reset()}
            style={{
              flex: 1,
              padding: '12px 24px',
              backgroundColor: '#00A7B5',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 4px 16px rgba(0, 167, 181, 0.25)'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#008a96'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#00A7B5'; e.currentTarget.style.transform = 'none'; }}
          >
            Retry Section
          </button>
          
          <button
            onClick={() => window.location.href = '/'}
            style={{
              flex: 1,
              padding: '12px 24px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: 'var(--text-primary)',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500,
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'; }}
          >
            Go to Home
          </button>
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
