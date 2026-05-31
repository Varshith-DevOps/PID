'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { getApplicants, submitInterviewFeedback } from '@/lib/api';
import Sidebar from '@/components/Sidebar';

interface Interview {
  id: string;
  roundName: string;
  interviewerName: string;
  interviewDate: string;
  status: string;
  feedback?: string;
  rating?: number;
  applicant: {
    id: string;
    fullName: string;
    email: string;
    jobOpening: {
      title: string;
    };
  };
}

export default function GlobalInterviewsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFeedbackModal, setShowFeedbackModal] = useState<Interview | null>(null);

  const [feedbackForm, setFeedbackForm] = useState({
    feedback: '',
    rating: 5,
    status: 'COMPLETED',
  });

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading]);

  useEffect(() => {
    if (user) loadInterviews();
  }, [user]);

  const loadInterviews = async () => {
    setLoading(true);
    try {
      const applicants = await getApplicants();
      // Extract and denormalize interviews
      const allInterviews: Interview[] = [];
      applicants.forEach((app: any) => {
        app.interviews.forEach((iv: any) => {
          allInterviews.push({
            ...iv,
            applicant: {
              id: app.id,
              fullName: app.fullName,
              email: app.email,
              jobOpening: app.jobOpening,
            },
          });
        });
      });

      // Sort by date (upcoming first)
      allInterviews.sort((a, b) => new Date(a.interviewDate).getTime() - new Date(b.interviewDate).getTime());
      setInterviews(allInterviews);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showFeedbackModal) return;
    try {
      await submitInterviewFeedback(showFeedbackModal.id, feedbackForm);
      setShowFeedbackModal(null);
      setFeedbackForm({ feedback: '', rating: 5, status: 'COMPLETED' });
      loadInterviews();
    } catch (err) {
      console.error(err);
      alert('Failed to submit evaluation');
    }
  };

  if (authLoading || !user) {
    return <div className="loading-container"><div className="loading-spinner" />Loading...</div>;
  }

  const upcomingInterviews = interviews.filter(iv => iv.status === 'SCHEDULED');
  const pastInterviews = interviews.filter(iv => iv.status === 'COMPLETED');

  return (
    <div className="app-layout">
      <Sidebar activePath="/recruitment" />
      <main className="main-content">
        
        {/* Header */}
        <div className="page-header">
          <div className="page-header-left">
            <div className="page-header-icon" style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))' }}>
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div>
              <h1 className="page-title">Interviews Agenda</h1>
              <p className="page-subtitle">Unified dashboard of candidate rounds and evaluations</p>
            </div>
          </div>

          <button onClick={() => router.push('/recruitment')} className="btn btn-secondary" style={{ fontSize: '0.8rem' }}>
            View Job Boards
          </button>
        </div>

        {loading ? (
          <div className="loading-container"><div className="loading-spinner" />Loading agenda...</div>
        ) : interviews.length === 0 ? (
          <div className="empty-state" style={{ minHeight: '250px' }}>
            No interview rounds scheduled. Open a Job Board and schedule evaluation slots for applicants.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
            
            {/* Upcoming/Active Interviews */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'white' }}>Upcoming Rounds ({upcomingInterviews.length})</h2>
              
              {upcomingInterviews.length === 0 ? (
                <div style={{ padding: '2rem', background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.03)', borderRadius: '12px', color: 'var(--text-muted)', fontSize: '0.78rem', textAlign: 'center' }}>
                  No pending upcoming interviews.
                </div>
              ) : (
                upcomingInterviews.map(iv => (
                  <div key={iv.id} className="glass-card" style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '4px solid #06b6d4' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'white' }}>{iv.applicant.fullName}</span>
                        <span className="badge badge-info" style={{ fontSize: '0.6rem' }}>{iv.roundName}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Position: <strong>{iv.applicant.jobOpening.title}</strong> · Interviewer: {iv.interviewerName}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        📅 Scheduled Slot: {new Date(iv.interviewDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      </div>
                    </div>

                    <button onClick={() => setShowFeedbackModal(iv)} className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2)', border: 'none', fontSize: '0.72rem', padding: '0.4rem 0.8rem' }}>
                      Log Feedback
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Past/Evaluated Round Logs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'white' }}>Completed Evaluations ({pastInterviews.length})</h2>
              
              {pastInterviews.length === 0 ? (
                <div style={{ padding: '2rem', background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.03)', borderRadius: '12px', color: 'var(--text-muted)', fontSize: '0.78rem', textAlign: 'center' }}>
                  No historical reviews logged yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {pastInterviews.map(iv => (
                    <div key={iv.id} className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', borderLeft: '4px solid #10b981' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.8rem', color: 'white' }}>{iv.applicant.fullName}</span>
                        <div style={{ color: '#eab308', fontSize: '0.7rem' }}>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <span key={i}>{i < (iv.rating || 0) ? '★' : '☆'}</span>
                          ))}
                        </div>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{iv.roundName} by {iv.interviewerName}</div>
                      {iv.feedback && (
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.15)', padding: '0.4rem', borderRadius: '4px', marginTop: '0.25rem', fontStyle: 'italic' }}>
                          "{iv.feedback}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* Global Feedback Modal Dialog */}
        {showFeedbackModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '400px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>Submit Candidate Review</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Feedback for {showFeedbackModal.applicant.fullName} ({showFeedbackModal.roundName})</p>
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
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Interview Evaluation Report</label>
                  <textarea placeholder="Summarize technical depth, coding speed, and architectural capabilities..." required value={feedbackForm.feedback} onChange={e => setFeedbackForm({ ...feedbackForm, feedback: e.target.value })} className="input-field" style={{ minHeight: '80px', fontFamily: 'inherit' }} />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button type="button" onClick={() => setShowFeedbackModal(null)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2)', border: 'none' }}>
                    Publish Review
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
