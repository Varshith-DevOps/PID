'use client';

import React from 'react';

interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  padded?: boolean;
}

export function Card({ title, actions, padded = true, children, style, ...rest }: CardProps) {
  return (
    <div
      className="card"
      style={{ padding: padded ? '1.25rem' : 0, ...style }}
      {...rest}
    >
      {(title || actions) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: padded ? '1rem' : 0,
            padding: padded ? 0 : '1rem 1.25rem',
          }}
        >
          {title && (
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {title}
            </h2>
          )}
          {actions && <div style={{ display: 'flex', gap: '0.5rem' }}>{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  trend?: { value: string; direction: 'up' | 'down' | 'flat' };
  accent?: string;
  onClick?: () => void;
}

export function StatCard({ label, value, icon, trend, accent, onClick }: StatCardProps) {
  const trendColor =
    trend?.direction === 'up'
      ? 'var(--success-fg)'
      : trend?.direction === 'down'
        ? 'var(--danger-fg)'
        : 'var(--text-muted)';
  return (
    <div
      className="stat-card"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default', ...(accent ? { ['--gradient-primary' as string]: accent } : {}) }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="stat-card-value">{value}</div>
          <div className="stat-card-label">{label}</div>
        </div>
        {icon && (
          <span style={{ color: 'var(--accent)', opacity: 0.85, width: 22, height: 22 }}>{icon}</span>
        )}
      </div>
      {trend && (
        <div style={{ marginTop: '0.6rem', fontSize: '0.75rem', fontWeight: 600, color: trendColor }}>
          {trend.direction === 'up' ? '▲' : trend.direction === 'down' ? '▼' : '–'} {trend.value}
        </div>
      )}
    </div>
  );
}

/** A labelled metric tile for dashboards (lighter than StatCard, tappable). */
export function MetricCard({ label, value, icon, hint, onClick }: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  hint?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card"
      style={{
        textAlign: 'left',
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.35rem',
        fontFamily: 'inherit',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {icon}
        {label}
      </div>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>{value}</div>
      {hint && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{hint}</div>}
    </button>
  );
}

export default Card;
