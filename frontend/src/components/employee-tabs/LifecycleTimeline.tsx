import React from 'react';
import { Card } from '../ui';

interface LifecycleTimelineProps {
  employee: any;
}

export default function LifecycleTimeline({ employee }: LifecycleTimelineProps) {
  if (!employee) return null;

  // Compile timeline events
  const events: Array<{
    date: Date;
    title: string;
    description: string;
    icon: string;
    badgeText?: string;
    badgeColor?: string;
  }> = [];

  // 1. Join event
  if (employee.joinDate) {
    // Initial salary is the starting previousSalary of the oldest revision, or the current salary if no revisions
    const sortedRevisions = employee.salaryRevisions
      ? [...employee.salaryRevisions].sort((a: any, b: any) => new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime())
      : [];
    const startingSalary = sortedRevisions.length > 0 ? sortedRevisions[0].previousSalary : employee.salary;

    events.push({
      date: new Date(employee.joinDate),
      title: 'Joined Company',
      description: `Officially hired as ${employee.jobTitle || 'Associate'}. Starting compensation set at ₹${startingSalary?.toLocaleString()}/month.`,
      icon: '🎉',
      badgeText: 'Onboarding',
      badgeColor: 'var(--trust)'
    });
  }

  // 2. Salary Revisions & Promotions
  if (employee.salaryRevisions && employee.salaryRevisions.length > 0) {
    employee.salaryRevisions.forEach((rev: any) => {
      events.push({
        date: new Date(rev.effectiveDate),
        title: `Compensation Revised: ${rev.reason || 'Appraisal'}`,
        description: `Salary adjusted to ₹${rev.revisedSalary?.toLocaleString()}/month (previous salary: ₹${rev.previousSalary?.toLocaleString()}/month).`,
        icon: '📈',
        badgeText: 'Promotion',
        badgeColor: 'var(--success-fg)'
      });
    });
  }

  // 3. Deactivation (Exit) Event
  if (!employee.isActive && employee.deactivatedAt) {
    events.push({
      date: new Date(employee.deactivatedAt),
      title: `Deactivated: ${employee.deactivationReason?.replace(/_/g, ' ') || 'Exit'}`,
      description: `Employment status changed to INACTIVE. Effective Date: ${employee.deactivationEffectiveDate ? new Date(employee.deactivationEffectiveDate).toLocaleDateString() : 'N/A'}. ${employee.deactivationRemarks ? `Remarks: ${employee.deactivationRemarks}` : ''}`,
      icon: '🚪',
      badgeText: 'Exit',
      badgeColor: 'var(--danger-fg)'
    });
  }

  // Sort events chronologically (newest first for standard visual flow)
  events.sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div>
      <div className="section-header" style={{ marginBottom: '2rem' }}>
        <h2 className="section-title">
          <span aria-hidden="true" style={{ marginRight: '0.5rem' }}>📈</span>
          Employee Career Lifecycle Timeline
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--neutral-muted)' }}>
          Detailed audit trail of promotions, lifecycle stages, and employment status history.
        </p>
      </div>

      {events.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--neutral-muted)' }}>
          No career timeline records found.
        </div>
      ) : (
        <div style={{ position: 'relative', paddingLeft: '2rem', borderLeft: '2px solid var(--border-color)' }}>
          {events.map((event, idx) => (
            <div key={idx} style={{ position: 'relative', marginBottom: '2.5rem' }}>
              {/* Timeline Bullet */}
              <div
                style={{
                  position: 'absolute',
                  left: 'calc(-2rem - 9px)',
                  top: '0',
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: 'var(--card-bg)',
                  border: '3px solid var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  boxShadow: 'var(--shadow-sm)'
                }}
              />

              {/* Event Card */}
              <div
                className="glass-card"
                style={{
                  padding: '1.25rem 1.5rem',
                  borderRadius: 'var(--radius-lg)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid var(--border-color)',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.1rem' }} aria-hidden="true">{event.icon}</span>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0, color: 'var(--foreground)' }}>
                      {event.title}
                    </h3>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--neutral-muted)', fontWeight: 500 }}>
                    {event.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>

                <p style={{ fontSize: '0.85rem', color: 'var(--neutral-muted)', margin: '0 0 0.75rem 0', lineHeight: 1.5 }}>
                  {event.description}
                </p>

                {event.badgeText && (
                  <span
                    style={{
                      display: 'inline-block',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      padding: '0.15rem 0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(255, 255, 255, 0.1)',
                      color: event.badgeColor || 'var(--foreground)',
                      border: `1px solid ${event.badgeColor || 'var(--border-color)'}`
                    }}
                  >
                    {event.badgeText}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
