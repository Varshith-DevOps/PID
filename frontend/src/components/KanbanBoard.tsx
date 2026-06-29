'use client';

/**
 * @fileoverview Jira-style Kanban board. Columns are task statuses; cards are
 * draggable (native HTML5 DnD, no extra dependency). Dropping a card on a column
 * calls onMove(taskId, newStatus). Styled to match the app's glassmorphism theme.
 * @module components/KanbanBoard
 */

import { useState } from 'react';

export interface BoardTask {
  id: string;
  title: string;
  priority?: string;
  status: string;
  storyPoints?: number | null;
  actualHours?: number;
  estimatedHours?: number | null;
  billable?: boolean;
  assignee?: { firstName: string; lastName: string } | null;
}
export interface BoardColumn { status: string; tasks: BoardTask[]; }

const STATUS_LABEL: Record<string, string> = {
  TODO: 'To Do', IN_PROGRESS: 'In Progress', AWAITING_APPROVAL: 'Review', REWORK: 'Rework', COMPLETED: 'Done', OTHER: 'Other',
};
const PRIORITY_COLOR: Record<string, string> = {
  HIGH: 'var(--danger-fg)', MEDIUM: 'var(--warning-fg)', LOW: 'var(--success-fg)',
};

export default function KanbanBoard({
  columns,
  onMove,
  onCardClick,
}: {
  columns: BoardColumn[];
  onMove: (taskId: string, newStatus: string) => void;
  onCardClick?: (task: BoardTask) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  return (
    <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8, alignItems: 'flex-start' }}>
      {columns.map((col) => (
        <div
          key={col.status}
          onDragOver={(e) => { e.preventDefault(); setOverCol(col.status); }}
          onDragLeave={() => setOverCol((c) => (c === col.status ? null : c))}
          onDrop={() => { if (dragId) onMove(dragId, col.status); setDragId(null); setOverCol(null); }}
          style={{
            flex: '0 0 270px', minHeight: 120, borderRadius: 12, padding: 10,
            background: overCol === col.status ? 'var(--accent-soft)' : 'var(--surface-sunken)',
            border: `1px solid ${overCol === col.status ? 'var(--accent)' : 'var(--border-subtle)'}`,
            transition: 'background 0.15s, border 0.15s',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '2px 4px' }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              {STATUS_LABEL[col.status] || col.status}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-on-soft)', background: 'var(--accent-soft)', borderRadius: 999, padding: '1px 8px' }}>
              {col.tasks.length}
            </span>
          </div>

          {col.tasks.map((t) => (
            <div
              key={t.id}
              draggable
              onDragStart={() => setDragId(t.id)}
              onDragEnd={() => setDragId(null)}
              onClick={() => onCardClick?.(t)}
              style={{
                background: 'var(--surface-raised)',
                border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 12, marginBottom: 10,
                boxShadow: 'var(--shadow-1)',
                cursor: 'grab', opacity: dragId === t.id ? 0.5 : 1,
              }}
            >
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, lineHeight: 1.35 }}>{t.title}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                {t.priority && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: PRIORITY_COLOR[t.priority] || '#9aa6c0', border: `1px solid ${PRIORITY_COLOR[t.priority] || '#9aa6c0'}`, borderRadius: 4, padding: '1px 6px' }}>
                    {t.priority}
                  </span>
                )}
                {typeof t.storyPoints === 'number' && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: 'var(--trust)', borderRadius: 999, padding: '1px 7px' }}>{t.storyPoints} SP</span>
                )}
                {t.billable === false && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, padding: '1px 6px' }}>non-billable</span>
                )}
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  {(t.actualHours ?? 0)}h{t.estimatedHours ? ` / ${t.estimatedHours}h` : ''}
                </span>
              </div>
              {t.assignee && (
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--accent)' }}>
                  {t.assignee.firstName} {t.assignee.lastName}
                </div>
              )}
            </div>
          ))}
          {col.tasks.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>Drop tasks here</div>
          )}
        </div>
      ))}
    </div>
  );
}
