'use client';

import React from 'react';
import type { Tone } from './Badge';

export interface TimelineItem {
  key: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  detail?: React.ReactNode;
  tone?: Tone;
  icon?: React.ReactNode;
}

const toneColor: Partial<Record<Tone, string>> = {
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
  info: 'var(--info)',
  neutral: 'var(--text-muted)',
};

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <div key={it.key} style={{ display: 'flex', gap: '0.85rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: toneColor[it.tone || 'neutral'] || 'var(--accent)', marginTop: 4, flexShrink: 0, boxShadow: '0 0 0 3px var(--surface-raised)' }} />
              {!last && <span style={{ width: 2, flex: 1, background: 'var(--border-subtle)', minHeight: 24 }} />}
            </div>
            <div style={{ paddingBottom: last ? 0 : '1.1rem', flex: 1 }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{it.title}</div>
              {it.meta && <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 1 }}>{it.meta}</div>}
              {it.detail && <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 4 }}>{it.detail}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default Timeline;
