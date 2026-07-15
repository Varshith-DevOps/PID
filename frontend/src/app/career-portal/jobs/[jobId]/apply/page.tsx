'use client';

import { use, useEffect, useState } from 'react';
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

  const [job, setJob] = useState<JobDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSubmitted(true);
    setSuccess('');

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
      formData.append('jobOpeningId', jobId);
      formData.append('fullName', form.fullName.trim());
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

      await applyForJob(formData);
      setSuccess('Application submitted successfully.');
      setSubmitted(false);
      setForm({ fullName: '', email: '', phone: '', experience: '', skills: '', currentCtc: '', expectedCtc: '', noticePeriod: '', coverLetter: '' });
      setResumeFile(null);
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
          <Button variant="link" size="sm" leftIcon={BackIcon} onClick={() => router.push('/recruitment')} style={{ alignSelf: 'flex-start', padding: 0 }}>
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

        <Card>
          <h2 style={{ marginTop: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>Apply for this job</h2>
          {formError && <div style={{ marginBottom: '1rem' }}><Banner tone="danger">{formError}</Banner></div>}
          {success && <div style={{ marginBottom: '1rem' }}><Banner tone="success">{success}</Banner></div>}

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
      </div>
    </main>
  );
}
