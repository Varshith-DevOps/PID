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

const STAGE_COLORS: Record<string, string> = {
  APPLIED: '#3b82f6',
  SCREENING: '#a78bfa',
  INTERVIEW: '#06b6d4',
  OFFER: '#eab308',
  REJECTED: '#ef4444',
  HIRED: '#10b981',
};

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
      setApplicantForm({ fullName: '', email: '', phone: '', coverLetter: '' });
      setResumeFile(null);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to add candidate profile');
    }
  };

  const handleScheduleInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApplicant) return;
    try {
      await scheduleInterview({
        applicantId: selectedApplicant.id,
        ...interviewForm,
      });
      setShowScheduleInterview(false);
      setInterviewForm({ interviewerName: '', interviewDate: '', roundName: 'Technical Round 1' });
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to schedule interview round');
    }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showFeedbackModal) return;
    try {
      await submitInterviewFeedback(showFeedbackModal.id, feedbackForm);
      setShowFeedbackModal(null);
      setFeedbackForm({ feedback: '', rating: 5, status: 'COMPLETED' });
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to log feedback');
    }
  };

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApplicant) return;
    try {
      await createJobOffer({
        applicantId: selectedApplicant.id,
        offeredSalary: parseFloat(offerForm.offeredSalary),
        joiningDate: offerForm.joiningDate,
      });
      setShowOfferModal(false);
      setOfferForm({ offeredSalary: '', joiningDate: '' });
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to issue job offer');
    }
  };

  if (authLoading || !user) {
    return <div className="loading-container"><div className="loading-spinner" />Loading...</div>;
  }

  if (loading || !job) {
    return <div className="loading-container"><div className="loading-spinner" />Loading pipeline details...</div>;
  }

  return (
    <div className="app-layout">
      <Sidebar activePath="/recruitment" />
      <main className="main-content" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', padding: 0 }}>
        
        {/* Sub-header inside main-content */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <button onClick={() => router.push('/recruitment')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '0.8rem', gap: '0.25rem' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                Back to Jobs
              </button>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>/</span>
              <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>{job.department?.name}</span>
            </div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'white' }}>{job.title}</h1>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{job.location} · {job.employmentType.replace('_', ' ')} · {job.salaryRange || 'No disclosed package'}</p>
          </div>

          <button onClick={() => setShowAddApplicant(true)} className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>
            Add Candidate Profile
          </button>
        </div>

        {/* Kanban Board Container */}
        <div style={{ flex: 1, display: 'flex', gap: '1rem', padding: '1.25rem', overflowX: 'auto', background: 'rgba(10,12,18,0.3)' }}>
          {STAGES.map(stage => {
            const applicantsInStage = job.applicants.filter(a => a.stage === stage);
            return (
              <div key={stage} style={{ flexShrink: 0, width: '275px', display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.02)', borderRadius: '12px', padding: '0.75rem' }}>
                {/* Column Title */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.5rem', borderBottom: `2px solid ${STAGE_COLORS[stage]}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: STAGE_COLORS[stage] }}></span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'white' }}>{STAGE_LABELS[stage]}</span>
                  </div>
                  <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: 'none', padding: '0.15rem 0.4rem', fontSize: '0.65rem' }}>
                    {applicantsInStage.length}
                  </span>
                </div>

                {/* Candidate list inside Column */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto' }}>
                  {applicantsInStage.length === 0 ? (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem', border: '1px dashed rgba(255,255,255,0.03)', borderRadius: '8px', background: 'rgba(255,255,255,0.002)' }}>
                      No candidates
                    </div>
                  ) : (
                    applicantsInStage.map(app => (
                      <div key={app.id} onClick={() => setSelectedApplicant(app)} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', padding: '0.75rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.35rem', transition: 'background 0.2s, transform 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'translateY(-1px)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.transform = 'none'; }}>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'white' }}>{app.fullName}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.email}</div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                          {/* Rating display */}
                          <div style={{ display: 'flex', gap: '2px', color: '#eab308' }}>
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

        {/* Add Candidate Form Drawer Modal */}
        {showAddApplicant && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '480px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'white' }}>Add Candidate Profile</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Manually register applicant details</p>
              </div>

              <form onSubmit={handleAddApplicant} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Full Name</label>
                  <input type="text" placeholder="John Doe" required value={applicantForm.fullName} onChange={e => setApplicantForm({ ...applicantForm, fullName: e.target.value })} className="input-field" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Email Address</label>
                    <input type="email" placeholder="john@example.com" required value={applicantForm.email} onChange={e => setApplicantForm({ ...applicantForm, email: e.target.value })} className="input-field" />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Phone Number</label>
                    <input type="tel" placeholder="+91..." required value={applicantForm.phone} onChange={e => setApplicantForm({ ...applicantForm, phone: e.target.value })} className="input-field" />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Upload Resume (PDF, DOCX)</label>
                  <input type="file" accept=".pdf,.doc,.docx" onChange={e => setResumeFile(e.target.files ? e.target.files[0] : null)} style={{ width: '100%', fontSize: '0.75rem', color: 'var(--text-secondary)' }} />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Cover Letter / Notes</label>
                  <textarea placeholder="Candidate career aspirations..." value={applicantForm.coverLetter} onChange={e => setApplicantForm({ ...applicantForm, coverLetter: e.target.value })} className="input-field" style={{ minHeight: '70px', fontFamily: 'inherit' }} />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button type="button" onClick={() => setShowAddApplicant(false)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none' }}>
                    Register Candidate
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Candidate Detail Right-Side Drawer */}
        {selectedApplicant && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 90, pointerEvents: 'none' }}>
            {/* Backdrop click clears selection */}
            <div onClick={() => setSelectedApplicant(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(3px)', pointerEvents: 'auto' }}></div>
            
            {/* Slide-over Drawer Panel */}
            <div className="glass-card" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '460px', borderLeft: '1px solid rgba(255,255,255,0.08)', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', pointerEvents: 'auto', boxShadow: '-10px 0 30px rgba(0,0,0,0.5)', overflowY: 'auto' }}>
              
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'white', marginBottom: '0.25rem' }}>{selectedApplicant.fullName}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="badge" style={{ background: STAGE_COLORS[selectedApplicant.stage], color: 'white', border: 'none', fontSize: '0.65rem' }}>
                      {STAGE_LABELS[selectedApplicant.stage]}
                    </span>
                    <select value={selectedApplicant.stage} onChange={e => handleStageChange(selectedApplicant.id, e.target.value)} className="select-field" style={{ width: '130px', padding: '0.2rem', fontSize: '0.72rem' }}>
                      {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                    </select>
                  </div>
                </div>
                <button onClick={() => setSelectedApplicant(null)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '50%', color: 'white', display: 'flex' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              {/* Contact Information */}
              <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ color: 'var(--text-secondary)' }}>📧 {selectedApplicant.email}</div>
                <div style={{ color: 'var(--text-secondary)' }}>📞 {selectedApplicant.phone}</div>
                {selectedApplicant.resumeUrl && (
                  <div style={{ marginTop: '0.25rem' }}>
                    <a href={`http://localhost:5000${selectedApplicant.resumeUrl}`} target="_blank" rel="noreferrer" style={{ color: '#06b6d4', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      📄 View Candidate Resume file
                    </a>
                  </div>
                )}
              </div>

              {/* Interactive Rating */}
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Candidate Evaluation Rating</label>
                <div style={{ display: 'flex', gap: '0.5rem', fontSize: '1.2rem', color: '#eab308' }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <button key={i} onClick={() => handleRatingChange(selectedApplicant.id, i + 1)} style={{ background: 'none', border: 'none', color: i < (selectedApplicant.rating || 0) ? '#eab308' : 'rgba(255,255,255,0.2)', cursor: 'pointer', padding: 0 }}>
                      ★
                    </button>
                  ))}
                </div>
              </div>

              {/* Cover Letter */}
              {selectedApplicant.coverLetter && (
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Cover Letter & Introduction</label>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px' }}>{selectedApplicant.coverLetter}</p>
                </div>
              )}

              {/* Notes Area */}
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Evaluation & Review Notes</label>
                <textarea placeholder="Log applicant strong points, gaps, technical scores..." value={selectedApplicant.notes || ''} onChange={e => handleNotesChange(selectedApplicant.id, e.target.value)} className="input-field" style={{ minHeight: '80px', fontSize: '0.75rem', fontFamily: 'inherit' }} />
              </div>

              {/* Interviews Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Interview Status</label>
                  <button onClick={() => setShowScheduleInterview(true)} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.68rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                    Schedule Round
                  </button>
                </div>

                {selectedApplicant.interviews.length === 0 ? (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.01)', padding: '0.75rem', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.03)', textAlign: 'center' }}>
                    No interview rounds scheduled yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {selectedApplicant.interviews.map(interview => (
                      <div key={interview.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.75rem', color: 'white' }}>{interview.roundName}</span>
                          <span className={`badge ${interview.status === 'SCHEDULED' ? 'badge-info' : 'badge-success'}`} style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem' }}>
                            {interview.status}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Interviewer: {interview.interviewerName}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Date: {new Date(interview.interviewDate).toLocaleString()}</div>
                        {interview.feedback ? (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.15)', padding: '0.5rem', borderRadius: '4px', marginTop: '0.25rem' }}>
                            <strong>Feedback:</strong> {interview.feedback} (Rating: {interview.rating}/5)
                          </div>
                        ) : (
                          <button onClick={() => setShowFeedbackModal(interview)} className="btn btn-secondary" style={{ padding: '0.2rem 0.4rem', fontSize: '0.65rem', alignSelf: 'flex-start', marginTop: '0.25rem' }}>
                            Log Interview Feedback
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Job Offer Section */}
              <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Formal Job Offer Letter</label>
                {selectedApplicant.jobOffer ? (
                  <div style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.75rem', color: '#10b981' }}>Offer Extended</span>
                      <button onClick={() => downloadOfferLetterPDF(selectedApplicant.jobOffer!.id, selectedApplicant.fullName)} className="btn btn-primary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.68rem', background: '#10b981', border: 'none' }}>
                        📥 Download Letter
                      </button>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Annual Salary: ₹{selectedApplicant.jobOffer.offeredSalary.toLocaleString()}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Target Joining Date: {new Date(selectedApplicant.jobOffer.joiningDate).toLocaleDateString()}</div>
                  </div>
                ) : (
                  <button onClick={() => setShowOfferModal(true)} className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #eab308, #ca8a04)', border: 'none', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'center', boxShadow: '0 4px 10px rgba(234,179,8,0.2)' }}>
                    Extend Job Offer Letter
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Schedule Interview Modal Dialog */}
        {showScheduleInterview && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '400px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>Schedule Interview Round</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Set up evaluation slot for {selectedApplicant?.fullName}</p>
              </div>

              <form onSubmit={handleScheduleInterview} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Round Description</label>
                  <select value={interviewForm.roundName} onChange={e => setInterviewForm({ ...interviewForm, roundName: e.target.value })} className="select-field">
                    <option value="Technical Round 1">Technical Round 1</option>
                    <option value="System Design & Architecture">System Design & Architecture</option>
                    <option value="Managerial Interview">Managerial Interview</option>
                    <option value="HR & Culture Round">HR & Culture Round</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Interviewer Full Name</label>
                  <input type="text" placeholder="e.g. Senior Tech Lead" required value={interviewForm.interviewerName} onChange={e => setInterviewForm({ ...interviewForm, interviewerName: e.target.value })} className="input-field" />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Interview Slot Date & Time</label>
                  <input type="datetime-local" required value={interviewForm.interviewDate} onChange={e => setInterviewForm({ ...interviewForm, interviewDate: e.target.value })} className="input-field" />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button type="button" onClick={() => setShowScheduleInterview(false)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #3b82f6, #06b6d4)', border: 'none' }}>
                    Confirm Schedule
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Feedback Modal Dialog */}
        {showFeedbackModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '400px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>Log Interview Feedback</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Complete evaluation report for {showFeedbackModal.roundName}</p>
              </div>

              <form onSubmit={handleFeedbackSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Score / Rating (1 to 5)</label>
                  <select value={feedbackForm.rating} onChange={e => setFeedbackForm({ ...feedbackForm, rating: parseInt(e.target.value) })} className="select-field">
                    <option value="5">5 - Excellent Candidate</option>
                    <option value="4">4 - Strong Candidate</option>
                    <option value="3">3 - Qualified Candidate</option>
                    <option value="2">2 - Borderline Candidate</option>
                    <option value="1">1 - Not Qualified</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Evaluation Feedback Notes</label>
                  <textarea placeholder="Detail core strengths, skill gaps, architectural command..." required value={feedbackForm.feedback} onChange={e => setFeedbackForm({ ...feedbackForm, feedback: e.target.value })} className="input-field" style={{ minHeight: '80px', fontFamily: 'inherit' }} />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button type="button" onClick={() => setShowFeedbackModal(null)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none' }}>
                    Submit Review
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create Job Offer Modal Dialog */}
        {showOfferModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '400px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>Issue Employment Offer</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Prepare formal agreement details for {selectedApplicant?.fullName}</p>
              </div>

              <form onSubmit={handleCreateOffer} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Offered Annual CTC (INR)</label>
                  <input type="number" placeholder="e.g. 1200000" required value={offerForm.offeredSalary} onChange={e => setOfferForm({ ...offerForm, offeredSalary: e.target.value })} className="input-field" />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Target Date of Joining</label>
                  <input type="date" required value={offerForm.joiningDate} onChange={e => setOfferForm({ ...offerForm, joiningDate: e.target.value })} className="input-field" />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button type="button" onClick={() => setShowOfferModal(false)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #eab308, #ca8a04)', border: 'none' }}>
                    Extend Offer Letter
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
