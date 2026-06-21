'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { getJobOpenings, createJobOpening, getDepartments } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import { ValidatedInput, ValidatedTextarea } from '@/components/ValidatedField';
import { validateForm, required } from '@/lib/validators';

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

export default function RecruitmentDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitted, setSubmitted] = useState(false);
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
    try {
      const [jobsData, deptsData] = await Promise.all([
        getJobOpenings(),
        getDepartments(),
      ]);
      setJobs(jobsData);
      setDepartments(deptsData);
    } catch (err) {
      console.error(err);
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
    }
  };

  if (authLoading || !user) {
    return <div className="loading-container"><div className="loading-spinner" />Loading...</div>;
  }

  // Aggregate Stats
  const activeJobs = jobs.filter(j => j.status === 'OPEN').length;
  const totalApplicants = jobs.reduce((acc, j) => acc + (j._count?.applicants || 0), 0);

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        {/* Header */}
        <div className="page-header">
          <div className="page-header-left">
            <div className="page-header-icon" style={{ background: 'linear-gradient(135deg, #00A7B5, #00A7B5)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))' }}>
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 11v6"/><path d="M16 14h6"/>
              </svg>
            </div>
            <div>
              <h1 className="page-title">Recruitment & ATS</h1>
              <p className="page-subtitle">Manage jobs, requisitions, and applicant pipeline stages</p>
            </div>
          </div>
          <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #00A7B5, #00A7B5)', display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none', boxShadow: '0 4px 15px rgba(0,167,181,0.35)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Create Job Requisition
          </button>
        </div>

        {/* Aggregate Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="glass-card" style={{ padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Active Job Positions</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.5rem' }}>{activeJobs}</div>
            <div style={{ position: 'absolute', right: '10px', bottom: '10px', opacity: 0.1, color: 'var(--accent-blue)' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
            </div>
          </div>
          <div className="glass-card" style={{ padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Active Applicants</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.5rem' }}>{totalApplicants}</div>
            <div style={{ position: 'absolute', right: '10px', bottom: '10px', opacity: 0.1, color: 'var(--accent-green)' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
          </div>
          <div className="glass-card" style={{ padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Closed Requisitions</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.5rem' }}>{jobs.filter(j => j.status === 'CLOSED').length}</div>
            <div style={{ position: 'absolute', right: '10px', bottom: '10px', opacity: 0.1, color: 'var(--text-muted)' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
            </div>
          </div>
        </div>

        {/* Jobs List Grid */}
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem' }}>Active Job Requisitions</h2>

        {loading ? (
          <div className="loading-container"><div className="loading-spinner" />Loading Job Positions...</div>
        ) : jobs.length === 0 ? (
          <div className="empty-state" style={{ minHeight: '200px' }}>No active job openings found. Click the button above to post one!</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
            {jobs.map(job => (
              <div key={job.id} className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', border: '1px solid rgba(255,255,255,0.05)', transition: 'transform 0.3s, box-shadow 0.3s' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span className={`badge ${job.status === 'OPEN' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.65rem' }}>
                    {job.status}
                  </span>
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

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <span className="badge badge-info" style={{ fontSize: '0.65rem', background: 'rgba(0,167,181,0.1)', color: '#00A7B5', border: 'none' }}>
                    {job.employmentType.replace('_', ' ')}
                  </span>
                  {job.salaryRange && (
                    <span className="badge badge-info" style={{ fontSize: '0.65rem', background: 'rgba(0,167,181,0.1)', color: '#00A7B5', border: 'none' }}>
                      {job.salaryRange}
                    </span>
                  )}
                </div>

                <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>{job._count?.applicants || 0}</strong> applicants
                  </div>
                  <button onClick={() => router.push(`/recruitment/jobs/${job.id}`)} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}>
                    View Board
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Requisition Drawer/Modal */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '520px', padding: '2rem', animation: 'scaleUp 0.3s ease', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'white' }}>Create Job Requisition</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Publish a new job opening position</p>
              </div>

              {formError && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', padding: '0.75rem 1rem', borderRadius: '10px', fontSize: '0.8rem' }}>
                  {formError}
                </div>
              )}

              <form onSubmit={handleCreateJob} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Job Title</label>
                    <ValidatedInput type="text" placeholder="e.g. Frontend Engineer" required value={newJob.title} onChange={v => setNewJob({ ...newJob, title: v })} validator={required('Job title')} forceError={submitted} className="input-field" />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Department</label>
                    <select required value={newJob.departmentId} onChange={e => setNewJob({ ...newJob, departmentId: e.target.value })} className="select-field">
                      <option value="">Select Dept...</option>
                      {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Location</label>
                    <ValidatedInput type="text" placeholder="e.g. Remote / Mumbai" required value={newJob.location} onChange={v => setNewJob({ ...newJob, location: v })} validator={required('Location')} forceError={submitted} className="input-field" />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Employment Type</label>
                    <select value={newJob.employmentType} onChange={e => setNewJob({ ...newJob, employmentType: e.target.value })} className="select-field">
                      <option value="FULL_TIME">Full Time</option>
                      <option value="PART_TIME">Part Time</option>
                      <option value="CONTRACT">Contract</option>
                      <option value="INTERN">Intern</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Salary Range</label>
                    <ValidatedInput type="text" placeholder="e.g. ₹10L - ₹15L" value={newJob.salaryRange} onChange={v => setNewJob({ ...newJob, salaryRange: v })} className="input-field" />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Status</label>
                    <select value={newJob.status} onChange={e => setNewJob({ ...newJob, status: e.target.value })} className="select-field">
                      <option value="OPEN">Open</option>
                      <option value="DRAFT">Draft</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Job Description</label>
                  <ValidatedTextarea placeholder="Outline roles and responsibilities..." required value={newJob.description} onChange={v => setNewJob({ ...newJob, description: v })} validator={required('Job description')} forceError={submitted} className="input-field" style={{ minHeight: '80px', fontFamily: 'inherit' }} />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Job Requirements</label>
                  <ValidatedTextarea placeholder="Skills, years of experience, qualifications..." required value={newJob.requirements} onChange={v => setNewJob({ ...newJob, requirements: v })} validator={required('Job requirements')} forceError={submitted} className="input-field" style={{ minHeight: '80px', fontFamily: 'inherit' }} />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #00A7B5, #00A7B5)', border: 'none' }}>
                    Publish Requisition
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
