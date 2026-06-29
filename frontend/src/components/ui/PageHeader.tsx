'use client';

import React from 'react';

export function PageHeader({ title, subtitle, icon, actions, breadcrumb }: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumb?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {breadcrumb && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{breadcrumb}</div>}
        <div className="page-header-left">
          {icon && <div className="page-header-icon">{icon}</div>}
          <div>
            <h1 className="page-title">{title}</h1>
            {subtitle && <div className="page-subtitle">{subtitle}</div>}
          </div>
        </div>
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  );
}

export default PageHeader;
