'use client';

import React from 'react';

export function SearchInput({ value, onChange, placeholder = 'Search…', width = 260 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; width?: number | string;
}) {
  return (
    <div style={{ position: 'relative', width }}>
      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </span>
      <input
        className="input-field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ paddingLeft: 36 }}
      />
    </div>
  );
}

export function FilterBar({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        flexWrap: 'wrap',
        marginBottom: '1.25rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', flex: 1 }}>{children}</div>
      {right && <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>{right}</div>}
    </div>
  );
}

export function FilterSelect({ value, onChange, options, ariaLabel }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; ariaLabel?: string;
}) {
  return (
    <select className="select-field" aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} style={{ width: 'auto', minWidth: 160 }}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export default FilterBar;
