'use client';

import { useEffect } from 'react';
import BrandLogo from '@/components/BrandLogo';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global Crash Catch:', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0e1a',
          backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(239, 68, 68, 0.05) 0%, transparent 60%)',
          color: '#ffffff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '24px',
          boxSizing: 'border-box'
        }}
      >
        <div
          style={{
            maxWidth: '480px',
            width: '100%',
            padding: '48px 32px',
            borderRadius: '24px',
            backgroundColor: 'rgba(21, 21, 24, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5), inset 0 0 16px rgba(255, 255, 255, 0.02)',
            backdropFilter: 'blur(20px)',
            textAlign: 'center',
            boxSizing: 'border-box'
          }}
        >
          {/* Brand Header */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
            <BrandLogo variant="dark" height={52} />
          </div>

          {/* Critical Error Icon */}
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
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>

          <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px', color: '#ffffff' }}>
            Critical System Crash
          </h1>
          
          <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)', lineHeight: 1.6, marginBottom: '24px' }}>
            A critical system exception occurred in the root engine layout.
          </p>

          {/* Diagnostic Block */}
          <div
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
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
              wordBreak: 'break-all',
              boxSizing: 'border-box'
            }}
          >
            <span style={{ color: '#ef4444', fontWeight: 600 }}>Crash Details:</span> {error.message || 'Fatal layout crash'}
          </div>

          {/* Action */}
          <button
            onClick={() => reset()}
            style={{
              width: '100%',
              padding: '12px 24px',
              backgroundColor: '#00A7B5',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 4px 16px rgba(0, 167, 181, 0.25)',
              boxSizing: 'border-box'
            }}
          >
            Restart Application
          </button>
        </div>
      </body>
    </html>
  );
}
