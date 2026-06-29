'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { getApplicants, submitInterviewFeedback } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingBlock,
  Modal,
  PageHeader,
  Select,
  Textarea,
} from '@/components/ui';

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

const CAL_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

const RATING_OPTIONS = [
  { value: '5', label: '5 - Excellent Candidate' },
  { value: '4', label: '4 - Strong Candidate' },
  { value: '3', label: '3 - Qualified Candidate' },
  { value: '2', label: '2 - Borderline Candidate' },
  { value: '1', label: '1 - Not Qualified' },
];

function Stars({ rating }: { rating: number }) {
  return (
    <span style={{ color: 'var(--warning-fg)', fontSize: '0.72rem', letterSpacing: '1px' }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i}>{i < rating ? '★' : '☆'}</span>
      ))}
    </span>
  );
}

export default function GlobalInterviewsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState<Interview | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    setLoadError(false);
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
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showFeedbackModal) return;
    setSubmitting(true);
    try {
      await submitInterviewFeedback(showFeedbackModal.id, feedbackForm);
      setShowFeedbackModal(null);
      setFeedbackForm({ feedback: '', rating: 5, status: 'COMPLETED' });
      loadInterviews();
    } catch (err) {
      console.error(err);
      alert('Failed to submit evaluation');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || !user) {
    return <LoadingBlock label="Loading…" />;
  }

  const upcomingInterviews = interviews.filter(iv => iv.status === 'SCHEDULED');
  const pastInterviews = interviews.filter(iv => iv.status === 'COMPLETED');

  return (
    <div className="app-layout">
      <Sidebar activePath="/recruitment" />
      <main className="main-content">
        <PageHeader
          title="Interviews Agenda"
          subtitle="Unified dashboard of candidate rounds and evaluations"
          icon={CAL_ICON}
          actions={
            <Button variant="ghost" onClick={() => router.push('/recruitment')}>
              View Job Boards
            </Button>
          }
        />

        {loading ? (
          <LoadingBlock label="Loading agenda…" />
        ) : loadError ? (
          <ErrorState onRetry={loadInterviews} />
        ) : interviews.length === 0 ? (
          <EmptyState
            title="No interviews scheduled"
            message="No interview rounds scheduled. Open a Job Board and schedule evaluation slots for applicants."
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>

            {/* Upcoming/Active Interviews */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Upcoming Rounds ({upcomingInterviews.length})</h2>

              {upcomingInterviews.length === 0 ? (
                <EmptyState title="No upcoming rounds" message="No pending upcoming interviews." />
              ) : (
                upcomingInterviews.map(iv => (
                  <Card key={iv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--accent)' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{iv.applicant.fullName}</span>
                        <Badge tone="info">{iv.roundName}</Badge>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Position: <strong>{iv.applicant.jobOpening.title}</strong> · Interviewer: {iv.interviewerName}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        Scheduled Slot: {new Date(iv.interviewDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      </div>
                    </div>

                    <Button size="sm" onClick={() => setShowFeedbackModal(iv)}>
                      Log Feedback
                    </Button>
                  </Card>
                ))
              )}
            </div>

            {/* Past/Evaluated Round Logs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Completed Evaluations ({pastInterviews.length})</h2>

              {pastInterviews.length === 0 ? (
                <EmptyState title="No evaluations yet" message="No historical reviews logged yet." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {pastInterviews.map(iv => (
                    <Card key={iv.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', borderLeft: '4px solid var(--success-fg)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-primary)' }}>{iv.applicant.fullName}</span>
                        <Stars rating={iv.rating || 0} />
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{iv.roundName} by {iv.interviewerName}</div>
                      {iv.feedback && (
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'var(--surface-sunken)', padding: '0.4rem', borderRadius: 'var(--radius-sm)', marginTop: '0.25rem', fontStyle: 'italic' }}>
                          "{iv.feedback}"
                        </p>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* Global Feedback Modal Dialog */}
        <Modal
          open={!!showFeedbackModal}
          onClose={() => setShowFeedbackModal(null)}
          title="Submit Candidate Review"
          width={420}
        >
          {showFeedbackModal && (
            <>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '-0.5rem', marginBottom: '1rem' }}>
                Feedback for {showFeedbackModal.applicant.fullName} ({showFeedbackModal.roundName})
              </p>

              <form onSubmit={handleFeedbackSubmit}>
                <Select
                  label="Score / Rating (1 to 5)"
                  value={String(feedbackForm.rating)}
                  onChange={v => setFeedbackForm({ ...feedbackForm, rating: parseInt(v) })}
                  options={RATING_OPTIONS}
                />

                <Textarea
                  label="Interview Evaluation Report"
                  placeholder="Summarize technical depth, coding speed, and architectural capabilities…"
                  required
                  value={feedbackForm.feedback}
                  onChange={v => setFeedbackForm({ ...feedbackForm, feedback: v })}
                />

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <Button type="button" variant="ghost" onClick={() => setShowFeedbackModal(null)}>Cancel</Button>
                  <Button type="submit" loading={submitting}>Publish Review</Button>
                </div>
              </form>
            </>
          )}
        </Modal>

      </main>
    </div>
  );
}
