'use client';

import React from 'react';

export type Tone =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'leave'
  | 'payroll'
  | 'compliance'
  | 'risk';

const toneVars: Record<Tone, { fg: string; bg: string; border?: string }> = {
  success: { fg: 'var(--success-fg)', bg: 'var(--success-bg)', border: 'var(--success-border)' },
  warning: { fg: 'var(--warning-fg)', bg: 'var(--warning-bg)', border: 'var(--warning-border)' },
  danger: { fg: 'var(--danger-fg)', bg: 'var(--danger-bg)', border: 'var(--danger-border)' },
  info: { fg: 'var(--info-fg)', bg: 'var(--info-bg)', border: 'var(--info-border)' },
  neutral: { fg: 'var(--neutral-fg)', bg: 'var(--neutral-bg)', border: 'var(--neutral-border)' },
  leave: { fg: 'var(--leave-fg)', bg: 'var(--leave-bg)' },
  payroll: { fg: 'var(--payroll-fg)', bg: 'var(--payroll-bg)' },
  compliance: { fg: 'var(--compliance-fg)', bg: 'var(--compliance-bg)' },
  risk: { fg: 'var(--risk-fg)', bg: 'var(--risk-bg)' },
};

export function Badge({
  tone = 'neutral',
  dot = false,
  children,
  style,
}: {
  tone?: Tone;
  dot?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const c = toneVars[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: '0.2rem 0.6rem',
        borderRadius: 'var(--radius-full)',
        fontSize: 'var(--fs-badge)',
        fontWeight: 600,
        letterSpacing: '0.4px',
        textTransform: 'uppercase',
        color: c.fg,
        background: c.bg,
        border: `1px solid ${c.border || 'transparent'}`,
        ...style,
      }}
    >
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />}
      {children}
    </span>
  );
}

/** Maps common HRMS status strings to a tone + always renders a dot so status
 *  is never communicated by color alone. */
const STATUS_TONE: Record<string, Tone> = {
  APPROVED: 'success', ACTIVE: 'success', PAID: 'success', COMPLETED: 'success', PASSED: 'success',
  PRESENT: 'success', VERIFIED: 'success', SUCCESS: 'success', SETTLED: 'success', HIRED: 'success',
  PENDING: 'warning', REVIEW: 'warning', IN_PROGRESS: 'warning', AWAITING_APPROVAL: 'warning',
  SUBMITTED_SELF: 'warning', PROCESSING: 'warning', DRAFT: 'warning', SCREENING: 'warning',
  REJECTED: 'danger', BLOCKING: 'danger', FAILED: 'danger', OVERDUE: 'danger', ABSENT: 'danger',
  HIGH: 'danger', SUSPENDED: 'danger', CANCELLED: 'neutral', INACTIVE: 'neutral', SKIPPED: 'neutral',
  CLOSED: 'neutral', NOT_SUBMITTED: 'neutral',
  LATE: 'warning', HALF_DAY: 'warning', WFH: 'info', ON_LEAVE: 'leave', OPEN: 'info',
};

export function StatusChip({ status, style }: { status?: string | null; style?: React.CSSProperties }) {
  const key = (status || 'UNKNOWN').toString().toUpperCase().replace(/\s+/g, '_');
  const tone = STATUS_TONE[key] || 'neutral';
  const label = (status || 'Unknown').toString().replace(/_/g, ' ');
  return (
    <Badge tone={tone} dot style={style}>
      {label}
    </Badge>
  );
}

export default Badge;
