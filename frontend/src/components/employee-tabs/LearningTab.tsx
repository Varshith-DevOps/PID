'use client';

import { useEffect, useState } from 'react';
import { getEmployeeLearningSummary } from '@/lib/api';
import { Badge, Card, DataTable, LoadingBlock, ProgressBar, StatCard, StatusChip } from '@/components/ui';
import type { Column } from '@/components/ui';

export default function LearningTab({ employee }: { employee: any }) {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getEmployeeLearningSummary(employee.id)
      .then((data) => mounted && setSummary(data))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [employee.id]);

  if (loading) return <LoadingBlock label="Loading learning profile..." />;

  const courseColumns: Column<any>[] = [
    { key: 'course', header: 'Course', render: (row) => <strong>{row.course?.title || '-'}</strong> },
    { key: 'status', header: 'Status', render: (row) => <StatusChip status={row.status} /> },
    { key: 'progress', header: 'Progress', render: (row) => <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><ProgressBar value={row.progress || 0} height={6} /><span>{row.progress || 0}%</span></div> },
    { key: 'completedAt', header: 'Completed', render: (row) => row.completedAt ? new Date(row.completedAt).toLocaleDateString() : '-' },
  ];

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Learning</h2>
      </div>
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <StatCard label="Completed Courses" value={summary?.completedCourses?.length || 0} />
        <StatCard label="Assigned Courses" value={summary?.assignedCourses?.length || 0} />
        <StatCard label="Certificates" value={summary?.certificates?.length || 0} />
        <StatCard label="Learning Hours" value={summary?.learningHours || 0} />
        <StatCard label="Average Score" value={`${summary?.averageScore || 0}%`} />
      </div>
      <Card title="Assigned Courses" padded={false} style={{ marginTop: '1.5rem' }}>
        <DataTable columns={courseColumns} rows={summary?.assignedCourses || []} rowKey={(row) => row.id} emptyTitle="No assigned courses" />
      </Card>
      <Card title="Certificates" style={{ marginTop: '1.5rem' }}>
        {(summary?.certificates || []).length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {summary.certificates.map((certificate: any) => (
              <div key={certificate.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.65rem' }}>
                <div>
                  <strong>{certificate.courseName}</strong>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{certificate.certificateNumber}</div>
                </div>
                <Badge tone="success">{new Date(certificate.issuedAt).toLocaleDateString()}</Badge>
              </div>
            ))}
          </div>
        ) : <p style={{ color: 'var(--text-muted)' }}>No certificates issued yet.</p>}
      </Card>
    </div>
  );
}
