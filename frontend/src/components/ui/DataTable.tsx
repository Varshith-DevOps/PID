'use client';

import React from 'react';
import { SkeletonTable } from './States';
import { EmptyState } from './States';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render?: (row: T, index: number) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: number | string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  rowKey?: (row: T, index: number) => string | number;
  onRowClick?: (row: T) => void;
  empty?: React.ReactNode;
  emptyTitle?: string;
  emptyMessage?: string;
  stickyFirst?: boolean;
}

export function DataTable<T>({
  columns, rows, loading, rowKey, onRowClick, empty, emptyTitle, emptyMessage, stickyFirst,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <SkeletonTable cols={columns.length} />
      </div>
    );
  }

  if (!rows.length) {
    return <div className="glass-card" style={{ padding: '1rem' }}>{empty || <EmptyState title={emptyTitle || 'No records found'} message={emptyMessage} />}</div>;
  }

  return (
    <div className="glass-card" style={{ overflow: 'hidden' }}>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th
                  key={c.key}
                  style={{
                    textAlign: c.align || 'left',
                    width: c.width,
                    ...(stickyFirst && i === 0 ? { position: 'sticky', left: 0, zIndex: 2 } : {}),
                  }}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={rowKey ? rowKey(row, idx) : idx}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                style={{ cursor: onRowClick ? 'pointer' : 'default' }}
              >
                {columns.map((c, i) => (
                  <td
                    key={c.key}
                    style={{
                      textAlign: c.align || 'left',
                      ...(stickyFirst && i === 0 ? { position: 'sticky', left: 0, background: 'inherit' } : {}),
                    }}
                  >
                    {c.render ? c.render(row, idx) : ((row as Record<string, unknown>)[c.key] as React.ReactNode)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DataTable;
