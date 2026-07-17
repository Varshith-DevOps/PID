'use client';

import { use, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { applyForJob, getCareerPortalJobById } from '@/lib/api';
import { email as vEmail, mobile as vMobile, personName, validateForm } from '@/lib/validators';
import {
  Badge,
  Banner,
  Button,
  Card,
  Field,
  LoadingBlock,
  StatusChip,
  TextField,
  Textarea,
} from '@/components/ui';

interface JobDetails {
  id: string;
  title: string;
  department: { name: string };
  location: string;
  employmentType: string;
  salaryRange?: string;
  description: string;
  requirements: string;
  status: string;
}

interface SubmittedApplication {
  applicantName: string;
  jobTitle: string;
  applicationId: string | null;
  submittedAt: string;
}

const BackIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
);

const NOTICE_PERIOD_OPTIONS = [
  'Immediate',
  '15 Days',
  '30 Days',
  '45 Days',
  '60 Days',
  '90 Days',
  'More than 90 Days',
].map(value => ({ value, label: value }));

const ctc = (label: string) => (value: string) => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return `${label} is required.`;
  if (/^\s*-/.test(trimmed) || /-\s*\d/.test(trimmed)) return `${label} cannot be negative.`;
  return null;
};

export default function CareerPortalApplyPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params);
  const router = useRouter();
  const successHeadingRef = useRef<HTMLHeadingElement>(null);

  const [job, setJob] = useState<JobDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedApplication, setSubmittedApplication] = useState<SubmittedApplication | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    experience: '',
    skills: '',
    currentCtc: '',
    expectedCtc: '',
    noticePeriod: '',
    coverLetter: '',
  });

  useEffect(() => {
    const loadJob = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const data = await getCareerPortalJobById(jobId);
        setJob(data);
      } catch (err: any) {
        console.error(err);
        setLoadError(err?.response?.data?.error || 'Unable to load job details.');
      } finally {
        setLoading(false);
      }
    };

    loadJob();
  }, [jobId]);

  useEffect(() => {
    if (isSubmitted) {
      successHeadingRef.current?.focus();
    }
  }, [isSubmitted]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || isSubmitted) return;
    setSubmitted(true);

    const { isValid, firstError } = validateForm(
      {
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        currentCtc: form.currentCtc,
        expectedCtc: form.expectedCtc,
        noticePeriod: form.noticePeriod,
      },
      {
        fullName: personName('Full name'),
        email: vEmail,
        phone: vMobile,
        currentCtc: ctc('Current CTC'),
        expectedCtc: ctc('Expected CTC'),
        noticePeriod: value => value.trim() ? null : 'Notice Period is required.',
      }
    );

    if (!isValid) {
      setFormError(firstError || 'Please correct the highlighted fields.');
      return;
    }

    setFormError('');
    setSaving(true);
    try {
      const formData = new FormData();
      const applicantName = form.fullName.trim();
      formData.append('jobOpeningId', jobId);
      formData.append('fullName', applicantName);
      formData.append('email', form.email.trim());
      formData.append('phone', form.phone.trim());
      formData.append('experience', form.experience.trim());
      formData.append('skills', form.skills.trim());
      formData.append('currentCtc', form.currentCtc.trim());
      formData.append('expectedCtc', form.expectedCtc.trim());
      formData.append('noticePeriod', form.noticePeriod.trim());
      formData.append('coverLetter', form.coverLetter.trim());
      formData.append('source', 'CAREER_PORTAL');
      if (resumeFile) formData.append('resume', resumeFile);

      const response = await applyForJob(formData);
      const application = response?.application || response;
      setFormError('');
      setSubmittedApplication({
        applicantName: application?.candidateName || application?.fullName || applicantName,
        jobTitle: application?.jobTitle || job?.title || 'this role',
        applicationId: application?.id || response?.applicationId || null,
        submittedAt: application?.createdAt || new Date().toISOString(),
      });
      setIsSubmitted(true);
    } catch (err: any) {
      console.error(err);
      setFormError(err?.response?.data?.error || 'Unable to submit application.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingBlock label="Loading job application..." />;
  }

  if (loadError || !job) {
    return (
      <main className="main-content" style={{ minHeight: '100vh', marginLeft: 0 }}>
        <Banner tone="danger">{loadError || 'Job opening not found.'}</Banner>
        <div style={{ marginTop: '1rem' }}>
          <Button variant="ghost" leftIcon={BackIcon} onClick={() => router.push('/recruitment')}>
            Back to Recruitment
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="main-content" style={{ minHeight: '100vh', marginLeft: 0 }}>
      <div style={{ maxWidth: 1040, margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(0, 0.9fr) minmax(320px, 1.1fr)', gap: '1.25rem', alignItems: 'start' }}>
        <Card style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Button variant="link" size="sm" leftIcon={BackIcon} onClick={() => router.push('/career-portal')} style={{ alignSelf: 'flex-start', padding: 0 }}>
            Back to Career Portal
          </Button>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.55rem' }}>{job.title}</h1>
              <p style={{ margin: '0.35rem 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                {job.department?.name} · {job.location} · {job.employmentType.replace('_', ' ')}
              </p>
            </div>
            <StatusChip status={job.status} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Badge tone="info">{job.salaryRange || 'Salary not disclosed'}</Badge>
            <Badge tone="neutral">{job.status}</Badge>
          </div>
          <section>
            <h2 style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>Job description</h2>
            <p style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.6 }}>{job.description}</p>
          </section>
          <section>
            <h2 style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>Requirements</h2>
            <p style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.6 }}>{job.requirements}</p>
          </section>
        </Card>

        {isSubmitted && submittedApplication ? (
          <Card role="status" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div
              aria-hidden="true"
              style={{
                width: 54,
                height: 54,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                background: 'var(--success-bg)',
                border: '1px solid var(--success-border)',
                color: 'var(--success-fg)',
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <div>
              <h2
                ref={successHeadingRef}
                tabIndex={-1}
                style={{ margin: 0, fontSize: '1.45rem', color: 'var(--text-primary)', outline: 'none' }}
              >
                Application Submitted Successfully
              </h2>
              <p style={{ margin: '0.75rem 0 0', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Thank you, <strong style={{ color: 'var(--text-primary)' }}>{submittedApplication.applicantName}</strong>.
                {' '}Your application for the position of <strong style={{ color: 'var(--text-primary)' }}>{submittedApplication.jobTitle}</strong> has been registered successfully.
              </p>
              <p style={{ margin: '0.75rem 0 0', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Our recruitment team will review your profile and contact you if your qualifications match the role.
              </p>
            </div>

            <div style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1rem', display: 'grid', gap: '0.65rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Candidate name</span>
                <strong style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>{submittedApplication.applicantName}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Job title</span>
                <strong style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>{submittedApplication.jobTitle}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Application date</span>
                <strong style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>{new Date(submittedApplication.submittedAt).toLocaleString()}</strong>
              </div>
              {submittedApplication.applicationId && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Application reference</span>
                  <strong style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>{submittedApplication.applicationId}</strong>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <Button type="button" onClick={() => router.push('/career-portal')}>View Other Open Jobs</Button>
              <Button type="button" variant="ghost" onClick={() => router.push('/career-portal')}>Back to Career Portal</Button>
            </div>
          </Card>
        ) : (
        <Card>
          <h2 style={{ marginTop: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>Apply for this job</h2>
          {formError && <div style={{ marginBottom: '1rem' }}><Banner tone="danger">{formError}</Banner></div>}

          <form onSubmit={handleSubmit}>
            <TextField
              label="Full Name"
              required
              value={form.fullName}
              onChange={v => setForm({ ...form, fullName: v })}
              validator={personName('Full name')}
              restrict="alpha"
              forceError={submitted}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <TextField
                label="Email Address"
                type="email"
                required
                value={form.email}
                onChange={v => setForm({ ...form, email: v })}
                validator={vEmail}
                forceError={submitted}
              />
              <TextField
                label="Phone Number"
                type="tel"
                required
                value={form.phone}
                onChange={v => setForm({ ...form, phone: v })}
                validator={vMobile}
                restrict="digits"
                maxLength={10}
                forceError={submitted}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <TextField
                label="Experience"
                placeholder="e.g. 4 years"
                value={form.experience}
                onChange={v => setForm({ ...form, experience: v })}
              />
              <TextField
                label="Skills"
                placeholder="e.g. React, Payroll, HR Ops"
                value={form.skills}
                onChange={v => setForm({ ...form, skills: v })}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <TextField
                label="Current CTC"
                placeholder="e.g. 6 LPA"
                required
                value={form.currentCtc}
                onChange={v => setForm({ ...form, currentCtc: v })}
                validator={ctc('Current CTC')}
                forceError={submitted}
              />
              <TextField
                label="Expected CTC"
                placeholder="e.g. 9 LPA"
                required
                value={form.expectedCtc}
                onChange={v => setForm({ ...form, expectedCtc: v })}
                validator={ctc('Expected CTC')}
                forceError={submitted}
              />
            </div>
            <Field
              label="Notice Period"
              required
              error={submitted && !form.noticePeriod.trim() ? 'Notice Period is required.' : ''}
            >
              <select
                className="select-field"
                value={form.noticePeriod}
                onChange={e => setForm({ ...form, noticePeriod: e.target.value })}
              >
                <option value="">Select notice period</option>
                {NOTICE_PERIOD_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </Field>
            <div className="form-group">
              <label className="form-label">Upload Resume (PDF, DOC, DOCX)</label>
              <input type="file" accept=".pdf,.doc,.docx" onChange={e => setResumeFile(e.target.files ? e.target.files[0] : null)} style={{ width: '100%', fontSize: '0.75rem', color: 'var(--text-secondary)' }} />
              {resumeFile && <span style={{ display: 'block', marginTop: 4, fontSize: '0.72rem', color: 'var(--text-muted)' }}>{resumeFile.name}</span>}
            </div>
            <Textarea
              label="Cover Letter"
              value={form.coverLetter}
              onChange={v => setForm({ ...form, coverLetter: v })}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <Button type="submit" loading={saving} disabled={saving}>Submit Application</Button>
            </div>
          </form>
        </Card>
        )}
      </div>
    </main>
  );
}
