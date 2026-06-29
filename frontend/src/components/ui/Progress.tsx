'use client';

import React from 'react';

export function ProgressBar({ value, max = 100, tone, height = 8, label }: {
  value: number;
  max?: number;
  tone?: 'accent' | 'success' | 'warning' | 'danger';
  height?: number;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const auto = pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : 'success';
  const t = tone || auto;
  const fill =
    t === 'accent' ? 'var(--gradient-primary)'
    : t === 'success' ? 'var(--success)'
    : t === 'warning' ? 'var(--warning)'
    : 'var(--danger)';
  return (
    <div>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>
          <span>{label}</span>
          <span>{Math.round(pct)}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{ width: '100%', height, borderRadius: 'var(--radius-full)', background: 'var(--surface-sunken)', overflow: 'hidden' }}
      >
        <div style={{ width: `${pct}%`, height: '100%', background: fill, borderRadius: 'var(--radius-full)', transition: 'width var(--motion-slow) var(--ease-out)' }} />
      </div>
    </div>
  );
}

export default ProgressBar;
