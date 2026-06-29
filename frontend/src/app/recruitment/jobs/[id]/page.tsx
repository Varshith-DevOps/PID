'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import {
  getJobOpeningById,
  updateApplicantStage,
  applyForJob,
  scheduleInterview,
  submitInterviewFeedback,
  createJobOffer,
  downloadOfferLetterPDF,
} from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import { validateForm, email as vEmail, mobile as vMobile, personName, required, date as vDate, amount } from '@/lib/validators';
import {
  Badge,
  Banner,
  Button,
  Drawer,
  LoadingBlock,
  Modal,
  Select,
  TextField,
  Textarea,
  type Tone,
} from '@/components/ui';

interface Interview {
  id: string;
  roundName: string;
  interviewerName: string;
  interviewDate: string;
  status: string;
  feedback?: string;
  rating?: number;
}

interface JobOffer {
  id: string;
  offeredSalary: number;
  joiningDate: string;
  status: string;
}

interface Applicant {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  coverLetter?: string;
  resumeUrl?: string;
  stage: string;
  rating?: number;
  notes?: string;
  interviews: Interview[];
  jobOffer?: JobOffer;
  createdAt: string;
}

interface JobDetails {
  id: string;
  title: string;
  department: { name: string };
  location: string;
  employmentType: string;
  salaryRange?: string;
  description: string;
  requirements: string;
  applicants: Applicant[];
}

const STAGES = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'REJECTED', 'HIRED'];

const STAGE_LABELS: Record<string, string> = {
  APPLIED: 'Applied',
  SCREENING: 'Screening',
  INTERVIEW: 'Interviews',
  OFFER: 'Offer Extended',
  REJECTED: 'Archived / Rejected',
  HIRED: 'Hired → Onboarding',
};

// Tokenized stage accent colors (no hardcoded hex).
const STAGE_COLORS: Record<string, string> = {
  APPLIED: 'var(--accent)',
  SCREENING: 'var(--accent)',
  INTERVIEW: 'var(--accent)',
  OFFER: 'var(--warning-fg)',
  REJECTED: 'var(--danger-fg)',
  HIRED: 'var(--success-fg)',
};

const STAGE_TONE: Record<string, Tone> = {
  APPLIED: 'info',
  SCREENING: 'info',
  INTERVIEW: 'info',
  OFFER: 'warning',
  REJECTED: 'danger',
  HIRED: 'success',
};

const RATING_OPTIONS = [
  { value: '5', label: '5 - Excellent Candidate' },
  { value: '4', label: '4 - Strong Candidate' },
  { value: '3', label: '3 - Qualified Candidate' },
  { value: '2', label: '2 - Borderline Candidate' },
  { value: '1', label: '1 - Not Qualified' },
];

const ROUND_OPTIONS = [
  { value: 'Technical Round 1', label: 'Technical Round 1' },
  { value: 'System Design & Architecture', label: 'System Design & Architecture' },
  { value: 'Managerial Interview', label: 'Managerial Interview' },
  { value: 'HR & Culture Round', label: 'HR & Culture Round' },
];

const AddCandidateIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>
);

const BackIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
);

export default function JobBoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [job, setJob] = useState<JobDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);

  // Modals & Drawers
  const [showAddApplicant, setShowAddApplicant] = useState(false);
  const [showScheduleInterview, setShowScheduleInterview] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState<Interview | null>(null);
  const [showOfferModal, setShowOfferModal] = useState(false);

  // Validation states
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState('');

  // Submit-in-flight states
  const [savingApplicant, setSavingApplicant] = useState(false);
  const [savingInterview, setSavingInterview] = useState(false);
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [savingOffer, setSavingOffer] = useState(false);

  // Form states
  const [applicantForm, setApplicantForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    coverLetter: '',
  });
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  const [interviewForm, setInterviewForm] = useState({
    interviewerName: '',
    interviewDate: '',
    roundName: 'Technical Round 1',
  });

  const [feedbackForm, setFeedbackForm] = useState({
    feedback: '',
    rating: 5,
    status: 'COMPLETED',
  });

  const [offerForm, setOfferForm] = useState({
    offeredSalary: '',
    joiningDate: '',
  });

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading]);

  useEffect(() => {
    if (user) loadData();
  }, [user, jobId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getJobOpeningById(jobId);
      setJob(data);
      if (selectedApplicant) {
        const updatedApp = data.applicants.find((a: any) => a.id === selectedApplicant.id);
        if (updatedApp) setSelectedApplicant(updatedApp);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStageChange = async (applicantId: string, newStage: string) => {
    try {
      await updateApplicantStage(applicantId, { stage: newStage });
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRatingChange = async (applicantId: string, rating: number) => {
    try {
      await updateApplicantStage(applicantId, { stage: selectedApplicant?.stage || 'APPLIED', rating });
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotesChange = async (applicantId: string, notes: string) => {
    try {
      await updateApplicantStage(applicantId, { stage: selectedApplicant?.stage || 'APPLIED', notes });
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddApplicant = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const { isValid, firstError } = validateForm(
      {
        fullName: applicantForm.fullName,
        email: applicantForm.email,
        phone: applicantForm.phone,
      },
      {
        fullName: personName('Full name'),
        email: vEmail,
        phone: vMobile,
      }
    );
    if (!isValid) {
      setFormError(firstError || 'Please correct the highlighted fields.');
      return;
    }
    setFormError('');
    setSavingApplicant(true);
    try {
      const formData = new FormData();
      formData.append('jobOpeningId', jobId);
      formData.append('fullName', applicantForm.fullName);
      formData.append('email', applicantForm.email);
      formData.append('phone', applicantForm.phone);
      formData.append('coverLetter', applicantForm.coverLetter);
      if (resumeFile) formData.append('resume', resumeFile);

      await applyForJob(formData);
      setShowAddApplicant(false);
      setSubmitted(false);
      setApplicantForm({ fullName: '', email: '', phone: '', coverLetter: '' });
      setResumeFile(null);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to add candidate profile');
    } finally {
      setSavingApplicant(false);
    }
  };

  const handleScheduleInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApplicant) return;
    setSubmitted(true);
    const { isValid, firstError } = validateForm(
      {
        interviewerName: interviewForm.interviewerName,
        roundName: interviewForm.roundName,
        interviewDate: interviewForm.interviewDate,
      },
      {
        interviewerName: personName('Interviewer name'),
        roundName: required('Round'),
        interviewDate: vDate('Interview date'),
      }
    );
    if (!isValid) {
      setFormError(firstError || 'Please correct the highlighted fields.');
      return;
    }
    setFormError('');
    setSavingInterview(true);
    try {
      await scheduleInterview({
        applicantId: selectedApplicant.id,
        ...interviewForm,
      });
      setShowScheduleInterview(false);
      setSubmitted(false);
      setInterviewForm({ interviewerName: '', interviewDate: '', roundName: 'Technical Round 1' });
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to schedule interview round');
    } finally {
      setSavingInterview(false);
    }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showFeedbackModal) return;
    setSubmitted(true);
    const { isValid, firstError } = validateForm(
      { feedback: feedbackForm.feedback },
      { feedback: required('Feedback') }
    );
    if (!isValid) {
      setFormError(firstError || 'Please correct the highlighted fields.');
      return;
    }
    setFormError('');
    setSavingFeedback(true);
    try {
      await submitInterviewFeedback(showFeedbackModal.id, feedbackForm);
      setShowFeedbackModal(null);
      setSubmitted(false);
      setFeedbackForm({ feedback: '', rating: 5, status: 'COMPLETED' });
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to log feedback');
    } finally {
      setSavingFeedback(false);
    }
  };

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApplicant) return;
    setSubmitted(true);
    const { isValid, firstError } = validateForm(
      {
        offeredSalary: offerForm.offeredSalary,
        joiningDate: offerForm.joiningDate,
      },
      {
        offeredSalary: amount,
        joiningDate: vDate('Joining date'),
      }
    );
    if (!isValid) {
      setFormError(firstError || 'Please correct the highlighted fields.');
      return;
    }
    setFormError('');
    setSavingOffer(true);
    try {
      await createJobOffer({
        applicantId: selectedApplicant.id,
        offeredSalary: parseFloat(offerForm.offeredSalary),
        joiningDate: offerForm.joiningDate,
      });
      setShowOfferModal(false);
      setSubmitted(false);
      setOfferForm({ offeredSalary: '', joiningDate: '' });
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to issue job offer');
    } finally {
      setSavingOffer(false);
    }
  };

  if (authLoading || !user) {
    return <LoadingBlock label="Loading…" />;
  }

  if (loading || !job) {
    return <LoadingBlock label="Loading pipeline details…" />;
  }

  return (
    <div className="app-layout">
      <Sidebar activePath="/recruitment" />
      <main className="main-content" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', padding: 0 }}>

        {/* Sub-header inside main-content */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <Button variant="link" size="sm" leftIcon={BackIcon} onClick={() => router.push('/recruitment')} style={{ padding: 0 }}>
                Back to Jobs
              </Button>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>/</span>
              <Badge tone="info">{job.department?.name}</Badge>
            </div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>{job.title}</h1>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{job.location} · {job.employmentType.replace('_', ' ')} · {job.salaryRange || 'No disclosed package'}</p>
          </div>

          <Button variant="success" leftIcon={AddCandidateIcon} onClick={() => { setSubmitted(false); setFormError(''); setShowAddApplicant(true); }}>
            Add Candidate Profile
          </Button>
        </div>

        {/* Kanban Board Container */}
        <div style={{ flex: 1, display: 'flex', gap: '1rem', padding: '1.25rem', overflowX: 'auto', background: 'var(--surface-canvas)' }}>
          {STAGES.map(stage => {
            const applicantsInStage = job.applicants.filter(a => a.stage === stage);
            return (
              <div key={stage} style={{ flexShrink: 0, width: '275px', display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '0.75rem' }}>
                {/* Column Title */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.5rem', borderBottom: `2px solid ${STAGE_COLORS[stage]}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: STAGE_COLORS[stage] }}></span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{STAGE_LABELS[stage]}</span>
                  </div>
                  <Badge tone="neutral">{applicantsInStage.length}</Badge>
                </div>

                {/* Candidate list inside Column */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto' }}>
                  {applicantsInStage.length === 0 ? (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
                      No candidates
                    </div>
                  ) : (
                    applicantsInStage.map(app => (
                      <div key={app.id} onClick={() => setSelectedApplicant(app)} style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '0.75rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.35rem', boxShadow: 'var(--shadow-1)', transition: 'transform var(--motion-fast) var(--ease-out)' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)' }}>{app.fullName}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.email}</div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                          {/* Rating display */}
                          <div style={{ display: 'flex', gap: '2px', color: 'var(--warning-fg)' }}>
                            {Array.from({ length: 5 }).map((_, i) => (
                              <span key={i} style={{ fontSize: '0.65rem' }}>{i < (app.rating || 0) ? '★' : '☆'}</span>
                            ))}
                          </div>

                          <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                            {new Date(app.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Candidate Modal */}
        <Modal
          open={showAddApplicant}
          onClose={() => setShowAddApplicant(false)}
          title="Add Candidate Profile"
          width={520}
        >
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '-0.5rem', marginBottom: '1rem' }}>
            Manually register applicant details
          </p>

          {formError && (
            <div style={{ marginBottom: '1rem' }}>
              <Banner tone="danger">{formError}</Banner>
            </div>
          )}

          <form onSubmit={handleAddApplicant}>
            <TextField
              label="Full Name"
              placeholder="John Doe"
              required
              value={applicantForm.fullName}
              onChange={v => setApplicantForm({ ...applicantForm, fullName: v })}
              validator={personName('Full name')}
              restrict="alpha"
              forceError={submitted}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <TextField
                label="Email Address"
                type="email"
                placeholder="john@example.com"
                required
                value={applicantForm.email}
                onChange={v => setApplicantForm({ ...applicantForm, email: v })}
                validator={vEmail}
                forceError={submitted}
              />
              <TextField
                label="Phone Number"
                type="tel"
                placeholder="10-digit mobile"
                required
                value={applicantForm.phone}
                onChange={v => setApplicantForm({ ...applicantForm, phone: v })}
                validator={vMobile}
                restrict="digits"
                maxLength={10}
                forceError={submitted}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Upload Resume (PDF, DOCX)</label>
              <input type="file" accept=".pdf,.doc,.docx" onChange={e => setResumeFile(e.target.files ? e.target.files[0] : null)} style={{ width: '100%', fontSize: '0.75rem', color: 'var(--text-secondary)' }} />
              {resumeFile && <span style={{ display: 'block', marginTop: 4, fontSize: '0.72rem', color: 'var(--text-muted)' }}>{resumeFile.name}</span>}
            </div>

            <Textarea
              label="Cover Letter / Notes"
              placeholder="Candidate career aspirations…"
              value={applicantForm.coverLetter}
              onChange={v => setApplicantForm({ ...applicantForm, coverLetter: v })}
            />

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <Button type="button" variant="ghost" onClick={() => setShowAddApplicant(false)}>Cancel</Button>
              <Button type="submit" variant="success" loading={savingApplicant}>Register Candidate</Button>
            </div>
          </form>
        </Modal>

        {/* Candidate Detail Drawer */}
        <Drawer
          open={!!selectedApplicant}
          onClose={() => setSelectedApplicant(null)}
          title={selectedApplicant?.fullName || 'Candidate'}
          width={480}
        >
          {selectedApplicant && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Stage chip + selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <Badge tone={STAGE_TONE[selectedApplicant.stage] || 'neutral'} dot>
                  {STAGE_LABELS[selectedApplicant.stage]}
                </Badge>
                <div style={{ minWidth: '160px' }}>
                  <Select
                    value={selectedApplicant.stage}
                    onChange={v => handleStageChange(selectedApplicant.id, v)}
                    options={STAGES.map(s => ({ value: s, label: STAGE_LABELS[s] }))}
                  />
                </div>
              </div>

              {/* Contact Information */}
              <div style={{ padding: '0.75rem', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ color: 'var(--text-secondary)' }}>Email: {selectedApplicant.email}</div>
                <div style={{ color: 'var(--text-secondary)' }}>Phone: {selectedApplicant.phone}</div>
                {selectedApplicant.resumeUrl && (
                  <div style={{ marginTop: '0.25rem' }}>
                    <a href={`http://localhost:5000${selectedApplicant.resumeUrl}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      View Candidate Resume file
                    </a>
                  </div>
                )}
              </div>

              {/* Interactive Rating */}
              <div>
                <label className="form-label">Candidate Evaluation Rating</label>
                <div style={{ display: 'flex', gap: '0.5rem', fontSize: '1.2rem' }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <button key={i} onClick={() => handleRatingChange(selectedApplicant.id, i + 1)} aria-label={`Rate ${i + 1} star`} style={{ background: 'none', border: 'none', color: i < (selectedApplicant.rating || 0) ? 'var(--warning-fg)' : 'var(--border-strong)', cursor: 'pointer', padding: 0 }}>
                      ★
                    </button>
                  ))}
                </div>
              </div>

              {/* Cover Letter */}
              {selectedApplicant.coverLetter && (
                <div>
                  <label className="form-label">Cover Letter & Introduction</label>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'var(--surface-sunken)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>{selectedApplicant.coverLetter}</p>
                </div>
              )}

              {/* Notes Area */}
              <div>
                <label className="form-label">Evaluation & Review Notes</label>
                <textarea placeholder="Log applicant strong points, gaps, technical scores…" value={selectedApplicant.notes || ''} onChange={e => handleNotesChange(selectedApplicant.id, e.target.value)} className="textarea-field" style={{ minHeight: '80px', fontSize: '0.75rem' }} />
              </div>

              {/* Interviews Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" style={{ margin: 0 }}>Interview Status</label>
                  <Button variant="ghost" size="sm" onClick={() => { setSubmitted(false); setFormError(''); setShowScheduleInterview(true); }}>
                    Schedule Round
                  </Button>
                </div>

                {selectedApplicant.interviews.length === 0 ? (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'var(--surface-sunken)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-subtle)', textAlign: 'center' }}>
                    No interview rounds scheduled yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {selectedApplicant.interviews.map(interview => (
                      <div key={interview.id} style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-primary)' }}>{interview.roundName}</span>
                          <Badge tone={interview.status === 'SCHEDULED' ? 'info' : 'success'}>{interview.status}</Badge>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Interviewer: {interview.interviewerName}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Date: {new Date(interview.interviewDate).toLocaleString()}</div>
                        {interview.feedback ? (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', background: 'var(--surface-raised)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', marginTop: '0.25rem' }}>
                            <strong>Feedback:</strong> {interview.feedback} (Rating: {interview.rating}/5)
                          </div>
                        ) : (
                          <div style={{ marginTop: '0.25rem' }}>
                            <Button variant="ghost" size="sm" onClick={() => { setSubmitted(false); setFormError(''); setShowFeedbackModal(interview); }}>
                              Log Interview Feedback
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Job Offer Section */}
              <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label className="form-label" style={{ margin: 0 }}>Formal Job Offer Letter</label>
                {selectedApplicant.jobOffer ? (
                  <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius-md)', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--success-fg)' }}>Offer Extended</span>
                      <Button variant="success" size="sm" onClick={() => downloadOfferLetterPDF(selectedApplicant.jobOffer!.id, selectedApplicant.fullName)}>
                        Download Letter
                      </Button>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Annual Salary: ₹{selectedApplicant.jobOffer.offeredSalary.toLocaleString()}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Target Joining Date: {new Date(selectedApplicant.jobOffer.joiningDate).toLocaleDateString()}</div>
                  </div>
                ) : (
                  <Button variant="warning" fullWidth onClick={() => { setSubmitted(false); setFormError(''); setShowOfferModal(true); }}>
                    Extend Job Offer Letter
                  </Button>
                )}
              </div>
            </div>
          )}
        </Drawer>

        {/* Schedule Interview Modal */}
        <Modal
          open={showScheduleInterview}
          onClose={() => setShowScheduleInterview(false)}
          title="Schedule Interview Round"
          width={420}
        >
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '-0.5rem', marginBottom: '1rem' }}>
            Set up evaluation slot for {selectedApplicant?.fullName}
          </p>

          {formError && (
            <div style={{ marginBottom: '1rem' }}>
              <Banner tone="danger">{formError}</Banner>
            </div>
          )}

          <form onSubmit={handleScheduleInterview}>
            <Select
              label="Round Description"
              value={interviewForm.roundName}
              onChange={v => setInterviewForm({ ...interviewForm, roundName: v })}
              options={ROUND_OPTIONS}
            />

            <TextField
              label="Interviewer Full Name"
              placeholder="e.g. Senior Tech Lead"
              required
              value={interviewForm.interviewerName}
              onChange={v => setInterviewForm({ ...interviewForm, interviewerName: v })}
              validator={personName('Interviewer name')}
              restrict="alpha"
              forceError={submitted}
            />

            <div className="form-group">
              <label className="form-label">Interview Slot Date & Time</label>
              <input type="datetime-local" required value={interviewForm.interviewDate} onChange={e => setInterviewForm({ ...interviewForm, interviewDate: e.target.value })} className="input-field" />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <Button type="button" variant="ghost" onClick={() => setShowScheduleInterview(false)}>Cancel</Button>
              <Button type="submit" loading={savingInterview}>Confirm Schedule</Button>
            </div>
          </form>
        </Modal>

        {/* Feedback Modal */}
        <Modal
          open={!!showFeedbackModal}
          onClose={() => setShowFeedbackModal(null)}
          title="Log Interview Feedback"
          width={420}
        >
          {showFeedbackModal && (
            <>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '-0.5rem', marginBottom: '1rem' }}>
                Complete evaluation report for {showFeedbackModal.roundName}
              </p>

              {formError && (
                <div style={{ marginBottom: '1rem' }}>
                  <Banner tone="danger">{formError}</Banner>
                </div>
              )}

              <form onSubmit={handleFeedbackSubmit}>
                <Select
                  label="Score / Rating (1 to 5)"
                  value={String(feedbackForm.rating)}
                  onChange={v => setFeedbackForm({ ...feedbackForm, rating: parseInt(v) })}
                  options={RATING_OPTIONS}
                />

                <Textarea
                  label="Evaluation Feedback Notes"
                  placeholder="Detail core strengths, skill gaps, architectural command…"
                  required
                  value={feedbackForm.feedback}
                  onChange={v => setFeedbackForm({ ...feedbackForm, feedback: v })}
                  validator={required('Feedback')}
                  forceError={submitted}
                />

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <Button type="button" variant="ghost" onClick={() => setShowFeedbackModal(null)}>Cancel</Button>
                  <Button type="submit" variant="success" loading={savingFeedback}>Submit Review</Button>
                </div>
              </form>
            </>
          )}
        </Modal>

        {/* Create Job Offer Modal */}
        <Modal
          open={showOfferModal}
          onClose={() => setShowOfferModal(false)}
          title="Issue Employment Offer"
          width={420}
        >
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '-0.5rem', marginBottom: '1rem' }}>
            Prepare formal agreement details for {selectedApplicant?.fullName}
          </p>

          {formError && (
            <div style={{ marginBottom: '1rem' }}>
              <Banner tone="danger">{formError}</Banner>
            </div>
          )}

          <form onSubmit={handleCreateOffer}>
            <TextField
              label="Offered Annual CTC (INR)"
              type="text"
              placeholder="e.g. 1200000"
              required
              value={offerForm.offeredSalary}
              onChange={v => setOfferForm({ ...offerForm, offeredSalary: v })}
              validator={amount}
              restrict="digits"
              forceError={submitted}
            />

            <div className="form-group">
              <label className="form-label">Target Date of Joining</label>
              <input type="date" required value={offerForm.joiningDate} onChange={e => setOfferForm({ ...offerForm, joiningDate: e.target.value })} className="input-field" />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <Button type="button" variant="ghost" onClick={() => setShowOfferModal(false)}>Cancel</Button>
              <Button type="submit" variant="warning" loading={savingOffer}>Extend Offer Letter</Button>
            </div>
          </form>
        </Modal>
      </main>
    </div>
  );
}
