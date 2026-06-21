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
  HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#10b981',
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
            background: overCol === col.status ? 'rgba(0,167,181,0.10)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${overCol === col.status ? 'rgba(0,167,181,0.5)' : 'rgba(255,255,255,0.08)'}`,
            transition: 'background 0.15s, border 0.15s',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '2px 4px' }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: '#9aa6c0' }}>
              {STATUS_LABEL[col.status] || col.status}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#73E0E7', background: 'rgba(0,167,181,0.15)', borderRadius: 999, padding: '1px 8px' }}>
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
                background: 'linear-gradient(135deg, rgba(24,43,109,0.16), rgba(0,167,181,0.08))',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 12, marginBottom: 10,
                cursor: 'grab', opacity: dragId === t.id ? 0.5 : 1,
              }}
            >
              <div style={{ fontSize: 13.5, fontWeight: 600, color: '#e7ecf6', marginBottom: 8, lineHeight: 1.35 }}>{t.title}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                {t.priority && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: PRIORITY_COLOR[t.priority] || '#9aa6c0', border: `1px solid ${PRIORITY_COLOR[t.priority] || '#9aa6c0'}`, borderRadius: 4, padding: '1px 6px' }}>
                    {t.priority}
                  </span>
                )}
                {typeof t.storyPoints === 'number' && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: '#182B6D', borderRadius: 999, padding: '1px 7px' }}>{t.storyPoints} SP</span>
                )}
                {t.billable === false && (
                  <span style={{ fontSize: 10, color: '#9aa6c0', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: '1px 6px' }}>non-billable</span>
                )}
                <span style={{ fontSize: 11, color: '#9aa6c0', marginLeft: 'auto' }}>
                  {(t.actualHours ?? 0)}h{t.estimatedHours ? ` / ${t.estimatedHours}h` : ''}
                </span>
              </div>
              {t.assignee && (
                <div style={{ marginTop: 8, fontSize: 11, color: '#73E0E7' }}>
                  {t.assignee.firstName} {t.assignee.lastName}
                </div>
              )}
            </div>
          ))}
          {col.tasks.length === 0 && (
            <div style={{ fontSize: 12, color: '#6b7490', textAlign: 'center', padding: '16px 0' }}>Drop tasks here</div>
          )}
        </div>
      ))}
    </div>
  );
}
