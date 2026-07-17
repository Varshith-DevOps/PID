'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCareerPortalJobs } from '@/lib/api';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, StatusChip } from '@/components/ui';

interface CareerJob {
  id: string;
  title: string;
  department?: { name: string };
  location: string;
  employmentType: string;
  salaryRange?: string;
  status: string;
  createdAt?: string;
}

export default function CareerPortalPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<CareerJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadJobs = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await getCareerPortalJobs();
      setJobs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  return (
    <main className="main-content" style={{ minHeight: '100vh', marginLeft: 0 }}>
      <div style={{ maxWidth: 1040, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div>
          <h1 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.8rem' }}>Career Portal</h1>
          <p style={{ margin: '0.45rem 0 0', color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
            Explore current open positions and apply for roles that match your profile.
          </p>
        </div>

        {loading ? (
          <LoadingBlock label="Loading open jobs..." />
        ) : loadError ? (
          <ErrorState onRetry={loadJobs} />
        ) : jobs.length === 0 ? (
          <EmptyState title="No open jobs" message="There are no open roles accepting applications right now." />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            {jobs.map((job) => (
              <Card key={job.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <div>
                    <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.05rem' }}>{job.title}</h2>
                    <p style={{ margin: '0.35rem 0 0', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                      {job.department?.name || 'General'} · {job.location}
                    </p>
                  </div>
                  <StatusChip status={job.status} />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Badge tone="info">{job.employmentType?.replace('_', ' ') || 'Full time'}</Badge>
                  <Badge tone="neutral">{job.salaryRange || 'Salary not disclosed'}</Badge>
                </div>
                <div style={{ marginTop: 'auto' }}>
                  <Button type="button" size="sm" onClick={() => router.push(`/career-portal/jobs/${job.id}/apply`)}>
                    Apply Now
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
