'use client';

import React from 'react';

export interface TabItem {
  key: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

export function Tabs({ items, value, onChange, style }: {
  items: TabItem[];
  value: string;
  onChange: (key: string) => void;
  style?: React.CSSProperties;
}) {
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        gap: '0.25rem',
        borderBottom: '1px solid var(--border-subtle)',
        overflowX: 'auto',
        ...style,
      }}
    >
      {items.map((item) => {
        const active = item.key === value;
        return (
          <button
            key={item.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.key)}
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.6rem 0.9rem',
              border: 'none',
              background: 'transparent',
              color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: active ? 700 : 500,
              fontSize: '0.85rem',
              fontFamily: 'inherit',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'color var(--motion-base) var(--ease-out)',
            }}
          >
            {item.icon}
            {item.label}
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: '0.6rem',
                right: '0.6rem',
                bottom: -1,
                height: 2,
                borderRadius: 2,
                background: active ? 'var(--accent)' : 'transparent',
                transition: 'background var(--motion-base) var(--ease-out)',
              }}
            />
          </button>
        );
      })}
    </div>
  );
}

/** Pill-style segmented control (reuses the legacy .tab-group look). */
export function SegmentedTabs({ items, value, onChange }: {
  items: TabItem[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="tab-group" role="tablist">
      {items.map((item) => (
        <button
          key={item.key}
          role="tab"
          aria-selected={item.key === value}
          className={`tab-btn ${item.key === value ? 'active' : ''}`}
          onClick={() => onChange(item.key)}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}

export default Tabs;
