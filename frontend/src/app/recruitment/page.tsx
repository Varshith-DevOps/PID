'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import {
  getJobOpenings,
  createJobOpening,
  getDepartments,
  getCareerConnectJobs,
} from '@/lib/api';
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
  openings?: number;
  numberOfOpenings?: number;
  vacancies?: number;
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
  const [showCareerConnect, setShowCareerConnect] = useState(false);
  const [careerConnectJobs, setCareerConnectJobs] = useState<Job[]>([]);
  const [careerConnectLoading, setCareerConnectLoading] = useState(false);
  const [careerConnectError, setCareerConnectError] = useState('');

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

  const loadCareerConnectJobs = async () => {
    setCareerConnectLoading(true);
    setCareerConnectError('');
    try {
      const data = await getCareerConnectJobs();
      setCareerConnectJobs(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error(err);
      setCareerConnectError(err?.response?.data?.error || 'Unable to load organization career portal jobs.');
      setCareerConnectJobs([]);
    } finally {
      setCareerConnectLoading(false);
    }
  };

  const openCareerConnect = () => {
    setShowCareerConnect(true);
    loadCareerConnectJobs();
  };

  const getOpeningsCount = (job: Job) => {
    return job.openings ?? job.numberOfOpenings ?? job.vacancies ?? 1;
  };

  if (authLoading || !user) {
    return (
      <div className="app-layout">
        <Sidebar activePath="/recruitment" />
        <main className="main-content">
          <LoadingBlock label="Loading recruitment..." />
        </main>
      </div>
    );
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
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <Button variant="ghost" onClick={openCareerConnect}>
                Career Connect
              </Button>
              <Button leftIcon={PlusIcon} onClick={() => { setSubmitted(false); setFormError(''); setShowModal(true); }}>
                Create Job Requisition
              </Button>
            </div>
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

        {/* Organization Career Portal Modal */}
        <Modal
          open={showCareerConnect}
          onClose={() => setShowCareerConnect(false)}
          title="Organization Career Portal"
          width={980}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {careerConnectError && <Banner tone="danger">{careerConnectError}</Banner>}

            {careerConnectLoading ? (
              <LoadingBlock label="Loading organization jobs..." />
            ) : careerConnectJobs.length === 0 ? (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
                No open or draft organization jobs found.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                {careerConnectJobs.map(job => (
                  <Card key={job.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' }}>
                      <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>{job.title}</h3>
                      <StatusChip status={job.status} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', fontSize: '0.76rem' }}>
                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>Department</div>
                        <strong style={{ color: 'var(--text-primary)' }}>{job.department?.name || 'Unassigned'}</strong>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>Location</div>
                        <strong style={{ color: 'var(--text-primary)' }}>{job.location}</strong>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>Employment type</div>
                        <strong style={{ color: 'var(--text-primary)' }}>{job.employmentType.replace('_', ' ')}</strong>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>Salary range</div>
                        <strong style={{ color: 'var(--text-primary)' }}>{job.salaryRange || 'Not disclosed'}</strong>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>Openings</div>
                        <strong style={{ color: 'var(--text-primary)' }}>{getOpeningsCount(job)}</strong>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>Job status</div>
                        <strong style={{ color: 'var(--text-primary)' }}>{job.status}</strong>
                      </div>
                    </div>

                    <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end' }}>
                      <Button type="button" size="sm" onClick={() => router.push(`/career-portal/jobs/${job.id}/apply`)}>
                        Proceed
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </Modal>

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
