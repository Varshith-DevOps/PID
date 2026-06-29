'use client';

import React from 'react';
import { Button } from './Button';

export function Spinner({ size = 32 }: { size?: number }) {
  return (
    <span
      className="loading-spinner"
      style={{ width: size, height: size, margin: 0 }}
      role="status"
      aria-label="Loading"
    />
  );
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loading-container" style={{ flexDirection: 'column', gap: '0.75rem' }}>
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

/** Shimmering placeholder for skeleton screens. */
export function Skeleton({ width = '100%', height = 16, radius = 8, style }: {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'block',
        width,
        height,
        borderRadius: radius,
        background:
          'linear-gradient(90deg, var(--surface-sunken) 25%, var(--surface-raised-hover) 50%, var(--surface-sunken) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s ease infinite',
        ...style,
      }}
    />
  );
}

export function SkeletonTable({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem' }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '1rem' }}>
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} height={14} />
          ))}
        </div>
      ))}
    </div>
  );
}

function StateShell({ icon, title, message, action, tone }: {
  icon: React.ReactNode;
  title: string;
  message?: string;
  action?: React.ReactNode;
  tone?: string;
}) {
  return (
    <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: tone || 'var(--surface-sunken)',
          color: 'var(--text-muted)',
        }}
      >
        {icon}
      </div>
      <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
      {message && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: 420 }}>{message}</div>}
      {action && <div style={{ marginTop: '0.5rem' }}>{action}</div>}
    </div>
  );
}

export function EmptyState({ title = 'Nothing here yet', message, action, icon }: {
  title?: string;
  message?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <StateShell
      title={title}
      message={message}
      action={action}
      icon={icon || (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-3H5a2 2 0 0 0-2 2z" />
        </svg>
      )}
    />
  );
}

export function ErrorState({ title = 'Something went wrong', message = 'We couldn’t load this. Please try again.', onRetry }: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <StateShell
      tone="var(--danger-bg)"
      title={title}
      message={message}
      action={onRetry && <Button variant="ghost" size="sm" onClick={onRetry}>Retry</Button>}
      icon={
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--danger-fg)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      }
    />
  );
}

export function PermissionDenied({ message = 'You don’t have access to this area. Contact your administrator if you believe this is a mistake.' }: { message?: string }) {
  return (
    <StateShell
      tone="var(--warning-bg)"
      title="Access restricted"
      message={message}
      icon={
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--warning-fg)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      }
    />
  );
}
