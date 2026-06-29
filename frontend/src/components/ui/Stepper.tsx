'use client';

import React from 'react';

export type StepStatus = 'done' | 'active' | 'pending' | 'skipped' | 'blocked';

export interface Step {
  key: string;
  label: string;
  description?: string;
  status: StepStatus;
  content?: React.ReactNode;
}

const dot: Record<StepStatus, { bg: string; fg: string; border: string }> = {
  done: { bg: 'var(--success)', fg: '#fff', border: 'var(--success)' },
  active: { bg: 'var(--accent)', fg: '#fff', border: 'var(--accent)' },
  pending: { bg: 'transparent', fg: 'var(--text-muted)', border: 'var(--border-strong)' },
  skipped: { bg: 'var(--surface-sunken)', fg: 'var(--text-muted)', border: 'var(--border-strong)' },
  blocked: { bg: 'var(--danger-bg)', fg: 'var(--danger-fg)', border: 'var(--danger-border)' },
};

export function Stepper({ steps, orientation = 'vertical' }: { steps: Step[]; orientation?: 'vertical' | 'horizontal' }) {
  const vertical = orientation === 'vertical';
  return (
    <div style={{ display: 'flex', flexDirection: vertical ? 'column' : 'row', gap: vertical ? 0 : '0.5rem' }}>
      {steps.map((s, i) => {
        const c = dot[s.status];
        const last = i === steps.length - 1;
        return (
          <div key={s.key} style={{ display: 'flex', flexDirection: vertical ? 'row' : 'column', gap: '0.75rem', flex: vertical ? undefined : 1 }}>
            <div style={{ display: 'flex', flexDirection: vertical ? 'column' : 'row', alignItems: 'center' }}>
              <span
                style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: c.bg, color: c.fg, border: `2px solid ${c.border}`,
                  fontSize: '0.75rem', fontWeight: 700,
                }}
              >
                {s.status === 'done' ? '✓' : s.status === 'skipped' ? '–' : i + 1}
              </span>
              {!last && (
                <span style={{ background: 'var(--border-subtle)', ...(vertical ? { width: 2, flex: 1, minHeight: 24, margin: '4px 0' } : { height: 2, flex: 1, minWidth: 24 }) }} />
              )}
            </div>
            <div style={{ paddingBottom: vertical && !last ? '1.25rem' : 0, flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: s.status === 'pending' ? 'var(--text-muted)' : 'var(--text-primary)' }}>{s.label}</div>
              {s.description && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{s.description}</div>}
              {s.content && <div style={{ marginTop: '0.75rem' }}>{s.content}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default Stepper;
