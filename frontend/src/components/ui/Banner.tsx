'use client';

import React from 'react';
import type { Tone } from './Badge';

const toneStyle: Record<string, { fg: string; bg: string; border: string }> = {
  info: { fg: 'var(--info-fg)', bg: 'var(--info-bg)', border: 'var(--info-border)' },
  success: { fg: 'var(--success-fg)', bg: 'var(--success-bg)', border: 'var(--success-border)' },
  warning: { fg: 'var(--warning-fg)', bg: 'var(--warning-bg)', border: 'var(--warning-border)' },
  danger: { fg: 'var(--danger-fg)', bg: 'var(--danger-bg)', border: 'var(--danger-border)' },
  neutral: { fg: 'var(--neutral-fg)', bg: 'var(--neutral-bg)', border: 'var(--neutral-border)' },
};

export function Banner({ tone = 'info', title, children, icon, action, style, className }: {
  tone?: Extract<Tone, 'info' | 'success' | 'warning' | 'danger' | 'neutral'>;
  title?: React.ReactNode;
  children?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  const c = toneStyle[tone];
  return (
    <div
      role="status"
      className={className}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        padding: '0.85rem 1rem',
        borderRadius: 'var(--radius-md)',
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.fg,
        ...style,
      }}
    >
      {icon && <span style={{ flexShrink: 0, marginTop: 1 }}>{icon}</span>}
      <div style={{ flex: 1, fontSize: '0.85rem', lineHeight: 1.45 }}>
        {title && <div style={{ fontWeight: 700, marginBottom: children ? 2 : 0 }}>{title}</div>}
        {children}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}

export default Banner;
