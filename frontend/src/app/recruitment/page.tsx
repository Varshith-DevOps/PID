'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { getJobOpenings, createJobOpening, getDepartments } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import { validateForm, required } from '@/lib/validators';
import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingBlock,
  Modal,
  PageHeader,
  Select,
  StatCard,
  StatusChip,
  TextField,
  Textarea,
} from '@/components/ui';

interface Job {
  id: string;
  title: string;
  department: { id: string; name: string };
  location: string;
  employmentType: string;
  salaryRange?: string;
  status: string;
  createdAt: string;
  _count: { applicants: number };
}

const RECRUIT_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 11v6"/><path d="M16 14h6"/>
  </svg>
);

const PlusIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
);

const JobIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
);

const ApplicantsIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
);

const ClosedIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
);

export default function RecruitmentDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // New Job Opening State
  const [newJob, setNewJob] = useState({
    title: '',
    departmentId: '',
    description: '',
    requirements: '',
    location: '',
    employmentType: 'FULL_TIME',
    salaryRange: '',
    status: 'OPEN',
  });

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [jobsData, deptsData] = await Promise.all([
        getJobOpenings(),
        getDepartments(),
      ]);
      setJobs(jobsData);
      setDepartments(deptsData);
    } catch (err) {
      console.error(err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const { isValid, firstError } = validateForm(
      {
        title: newJob.title,
        departmentId: newJob.departmentId,
        location: newJob.location,
        description: newJob.description,
        requirements: newJob.requirements,
      },
      {
        title: required('Job title'),
        departmentId: required('Department'),
        location: required('Location'),
        description: required('Job description'),
        requirements: required('Job requirements'),
      }
    );
    if (!isValid) {
      setFormError(firstError || 'Please correct the highlighted fields.');
      return;
    }
    setFormError('');
    setSubmitting(true);
    try {
      await createJobOpening(newJob);
      setShowModal(false);
      setSubmitted(false);
      setNewJob({
        title: '',
        departmentId: '',
        description: '',
        requirements: '',
        location: '',
        employmentType: 'FULL_TIME',
        salaryRange: '',
        status: 'OPEN',
      });
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to create job requisition');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || !user) {
    return <LoadingBlock label="Loading…" />;
  }

  // Aggregate Stats
  const activeJobs = jobs.filter(j => j.status === 'OPEN').length;
  const totalApplicants = jobs.reduce((acc, j) => acc + (j._count?.applicants || 0), 0);
  const closedJobs = jobs.filter(j => j.status === 'CLOSED').length;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <PageHeader
          title="Recruitment & ATS"
          subtitle="Manage jobs, requisitions, and applicant pipeline stages"
          icon={RECRUIT_ICON}
          actions={
            <Button leftIcon={PlusIcon} onClick={() => { setSubmitted(false); setFormError(''); setShowModal(true); }}>
              Create Job Requisition
            </Button>
          }
        />

        {/* Aggregate Stats Cards */}
        <div className="stat-grid" style={{ marginBottom: '1.5rem' }}>
          <StatCard label="Active Job Positions" value={activeJobs} icon={JobIcon} />
          <StatCard label="Active Applicants" value={totalApplicants} icon={ApplicantsIcon} />
          <StatCard label="Closed Requisitions" value={closedJobs} icon={ClosedIcon} />
        </div>

        <div className="section-header">
          <h2 className="section-title">Active Job Requisitions</h2>
        </div>

        {loading ? (
          <LoadingBlock label="Loading Job Positions…" />
        ) : loadError ? (
          <ErrorState onRetry={loadData} />
        ) : jobs.length === 0 ? (
          <EmptyState
            title="No active job openings"
            message="No active job openings found. Post your first requisition to start building a pipeline."
            action={<Button leftIcon={PlusIcon} onClick={() => { setSubmitted(false); setFormError(''); setShowModal(true); }}>Create Job Requisition</Button>}
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
            {jobs.map(job => (
              <Card key={job.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <StatusChip status={job.status} />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {new Date(job.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{job.title}</h3>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>{job.department?.name}</span>
                    <span style={{ opacity: 0.3 }}>|</span>
                    <span>{job.location}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                  <Badge tone="info">{job.employmentType.replace('_', ' ')}</Badge>
                  {job.salaryRange && <Badge tone="info">{job.salaryRange}</Badge>}
                </div>

                <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>{job._count?.applicants || 0}</strong> applicants
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => router.push(`/recruitment/jobs/${job.id}`)}>
                    View Board
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Create Requisition Modal */}
        <Modal
          open={showModal}
          onClose={() => setShowModal(false)}
          title="Create Job Requisition"
          width={560}
        >
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '-0.5rem', marginBottom: '1rem' }}>
            Publish a new job opening position
          </p>

          {formError && (
            <div style={{ marginBottom: '1rem' }}>
              <Banner tone="danger">{formError}</Banner>
            </div>
          )}

          <form onSubmit={handleCreateJob}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <TextField
                label="Job Title"
                placeholder="e.g. Frontend Engineer"
                required
                value={newJob.title}
                onChange={v => setNewJob({ ...newJob, title: v })}
                validator={required('Job title')}
                forceError={submitted}
              />
              <Select
                label="Department"
                required
                placeholder="Select Dept…"
                value={newJob.departmentId}
                onChange={v => setNewJob({ ...newJob, departmentId: v })}
                options={departments.map((d: any) => ({ value: d.id, label: d.name }))}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <TextField
                label="Location"
                placeholder="e.g. Remote / Mumbai"
                required
                value={newJob.location}
                onChange={v => setNewJob({ ...newJob, location: v })}
                validator={required('Location')}
                forceError={submitted}
              />
              <Select
                label="Employment Type"
                value={newJob.employmentType}
                onChange={v => setNewJob({ ...newJob, employmentType: v })}
                options={[
                  { value: 'FULL_TIME', label: 'Full Time' },
                  { value: 'PART_TIME', label: 'Part Time' },
                  { value: 'CONTRACT', label: 'Contract' },
                  { value: 'INTERN', label: 'Intern' },
                ]}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <TextField
                label="Salary Range"
                placeholder="e.g. ₹10L - ₹15L"
                value={newJob.salaryRange}
                onChange={v => setNewJob({ ...newJob, salaryRange: v })}
              />
              <Select
                label="Status"
                value={newJob.status}
                onChange={v => setNewJob({ ...newJob, status: v })}
                options={[
                  { value: 'OPEN', label: 'Open' },
                  { value: 'DRAFT', label: 'Draft' },
                ]}
              />
            </div>

            <Textarea
              label="Job Description"
              placeholder="Outline roles and responsibilities…"
              required
              value={newJob.description}
              onChange={v => setNewJob({ ...newJob, description: v })}
              validator={required('Job description')}
              forceError={submitted}
            />

            <Textarea
              label="Job Requirements"
              placeholder="Skills, years of experience, qualifications…"
              required
              value={newJob.requirements}
              onChange={v => setNewJob({ ...newJob, requirements: v })}
              validator={required('Job requirements')}
              forceError={submitted}
            />

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <Button type="button" variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit" loading={submitting}>Publish Requisition</Button>
            </div>
          </form>
        </Modal>
      </main>
    </div>
  );
}
