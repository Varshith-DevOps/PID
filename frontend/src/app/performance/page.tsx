'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import {
  getKras,
  createKra,
  updateKra,
  deleteKra,
  getFeedback360,
  submitFeedback360,
  getEmployees,
} from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import { validateForm, required, percentage } from '@/lib/validators';
import {
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  LoadingBlock,
  Modal,
  PageHeader,
  Select,
  StatCard,
  TextField,
  Textarea,
} from '@/components/ui';

interface KRA {
  id: string;
  title: string;
  description?: string;
  weightage: number;
  target?: string;
  status: string;
  year: number;
}

interface Feedback {
  id: string;
  feedback: string;
  rating: number;
  relationship: string;
  anonymous: boolean;
  createdAt: string;
  reviewer: {
    firstName: string;
    lastName: string;
    jobTitle: string;
  };
}

const PERF_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
  </svg>
);

export default function PerformanceDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [kras, setKras] = useState<KRA[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Modals & Drawers
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  // Validation states
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState('');

  // Goal Form State
  const [goalForm, setGoalForm] = useState({
    title: '',
    description: '',
    weightage: 25,
    target: '',
    year: 2026,
  });

  // Feedback Form State
  const [feedbackForm, setFeedbackForm] = useState({
    employeeId: '',
    feedback: '',
    rating: 5,
    relationship: 'PEER',
    anonymous: false,
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
    setError(false);
    try {
      // Always load the directory (used for the peer-review picker).
      const employeesData = await getEmployees();
      setEmployees(employeesData.employees.filter((e: any) => e.id !== user?.employeeId));
      // Personal KRAs and 360° reviews require an employee profile. Admin/owner
      // accounts that aren't employees skip these (instead of erroring out).
      if (user?.employeeId) {
        const [krasData, feedbackData] = await Promise.all([getKras(), getFeedback360()]);
        setKras(krasData);
        setFeedbacks(feedbackData);
      } else {
        setKras([]);
        setFeedbacks([]);
      }
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.employeeId) return;
    setSubmitted(true);
    const { isValid, firstError } = validateForm(
      { title: goalForm.title, weightage: String(goalForm.weightage) },
      { title: required('Goal title'), weightage: percentage }
    );
    if (!isValid) {
      setFormError(firstError || 'Please correct the highlighted fields.');
      return;
    }
    setFormError('');
    try {
      await createKra({
        employeeId: user.employeeId,
        ...goalForm,
      });
      setShowGoalModal(false);
      setSubmitted(false);
      setGoalForm({ title: '', description: '', weightage: 25, target: '', year: 2026 });
      loadData();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to record goals KRA');
    }
  };

  const handleStatusChange = async (kraId: string, status: string) => {
    try {
      await updateKra(kraId, { status });
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const { isValid, firstError } = validateForm(
      { employeeId: feedbackForm.employeeId, feedback: feedbackForm.feedback },
      { employeeId: required('Team member'), feedback: required('Feedback') }
    );
    if (!isValid) {
      setFormError(firstError || 'Please correct the highlighted fields.');
      return;
    }
    setFormError('');
    try {
      await submitFeedback360(feedbackForm);
      setShowFeedbackModal(false);
      setSubmitted(false);
      setFeedbackForm({ employeeId: '', feedback: '', rating: 5, relationship: 'PEER', anonymous: false });
      loadData();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to submit continuous review');
    }
  };

  if (authLoading || !user) {
    return <div className="loading-container"><div className="loading-spinner" />Loading...</div>;
  }

  // Weightage summaries
  const totalWeightage = kras.reduce((acc, curr) => acc + curr.weightage, 0);
  const averageFeedbackRating = feedbacks.length
    ? (feedbacks.reduce((acc, curr) => acc + curr.rating, 0) / feedbacks.length).toFixed(1)
    : '—';

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">

        <PageHeader
          title="Performance & Goals"
          subtitle="Track your Key Result Areas (KRAs), continuous peer reviews, and appraisals"
          icon={PERF_ICON}
          actions={
            <>
              <Button variant="ghost" onClick={() => router.push('/performance/appraisals')}>
                Appraisal Cycles
              </Button>
              <Button variant="primary" onClick={() => { setSubmitted(false); setFormError(''); setShowGoalModal(true); }}>
                + Define Goal KRA
              </Button>
            </>
          }
        />

        {!user?.employeeId && (
          <div style={{ marginBottom: '1.5rem' }}>
            <Banner tone="info" title="Viewing as an administrator">
              This account isn&apos;t linked to an employee profile, so personal KRAs and 360° reviews aren&apos;t shown here.
              Open an employee from the directory to review their performance.
            </Banner>
          </div>
        )}

        {/* Aggregate Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <StatCard
            label="KRA Target Weightage"
            value={
              <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.25rem' }}>
                {totalWeightage}%
                <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }}>/ 100%</span>
              </span>
            }
          />
          <StatCard
            label="360 Peer Evaluation"
            value={
              <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.25rem' }}>
                {averageFeedbackRating}
                <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--warning-fg)' }}>★</span>
              </span>
            }
          />
          <StatCard
            label="Active Goals"
            value={kras.filter(k => k.status === 'IN_PROGRESS' || k.status === 'PENDING').length}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '1.5rem', alignItems: 'start' }}>

          {/* Personal Goals (KRAs) Block */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Key Result Areas (KRAs)</h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Year 2026 Goals</span>
            </div>

            {loading ? (
              <LoadingBlock label="Loading goals..." />
            ) : error ? (
              <ErrorState onRetry={loadData} />
            ) : kras.length === 0 ? (
              <EmptyState
                title="No active goals defined"
                message='Click "Define Goal KRA" to start.'
                action={<Button variant="primary" size="sm" onClick={() => { setSubmitted(false); setFormError(''); setShowGoalModal(true); }}>+ Define Goal KRA</Button>}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {kras.map(kra => (
                  <Card
                    key={kra.id}
                    style={{
                      borderLeft: kra.status === 'ACHIEVED' ? '4px solid var(--success-fg)'
                        : kra.status === 'MISSED' ? '4px solid var(--danger-fg)'
                        : '4px solid var(--accent)',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                        <div>
                          <h3 style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)' }}>{kra.title}</h3>
                          {kra.description && <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>{kra.description}</p>}
                        </div>
                        <div style={{ width: 150, flexShrink: 0 }}>
                          <Select
                            value={kra.status}
                            onChange={v => handleStatusChange(kra.id, v)}
                            options={[
                              { value: 'PENDING', label: 'Pending' },
                              { value: 'IN_PROGRESS', label: 'In Progress' },
                              { value: 'ACHIEVED', label: 'Achieved' },
                              { value: 'MISSED', label: 'Missed' },
                            ]}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        <div>🎯 Target: <strong>{kra.target || '—'}</strong></div>
                        <div>Weightage: <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{kra.weightage}%</span></div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* 360 Continuous Feedback Block */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>360 Peer Reviews</h2>
              <Button variant="ghost" size="sm" onClick={() => { setSubmitted(false); setFormError(''); setShowFeedbackModal(true); }}>
                ✍️ Write Peer Review
              </Button>
            </div>

            {loading ? (
              <LoadingBlock label="Loading feedback..." />
            ) : error ? (
              <ErrorState onRetry={loadData} />
            ) : feedbacks.length === 0 ? (
              <EmptyState title="No peer reviews yet" message="No anonymous peer reviews recorded yet." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {feedbacks.map(fb => (
                  <Card key={fb.id} style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {fb.reviewer.firstName} {fb.reviewer.lastName} ({fb.relationship})
                        </span>
                        <span style={{ color: 'var(--warning-fg)', fontSize: '0.7rem' }}>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <span key={i}>{i < fb.rating ? '★' : '☆'}</span>
                          ))}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'var(--surface-sunken)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', fontStyle: 'italic' }}>
                        "{fb.feedback}"
                      </p>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', alignSelf: 'flex-end' }}>
                        {new Date(fb.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Define Goal Modal */}
        <Modal
          open={showGoalModal}
          onClose={() => setShowGoalModal(false)}
          title="Define KRA Goal"
          width={440}
        >
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '-0.5rem', marginBottom: '1rem' }}>
            Create a Key Result Area target metric
          </p>

          {formError && (
            <div style={{ marginBottom: '1rem' }}>
              <Banner tone="danger">{formError}</Banner>
            </div>
          )}

          <form onSubmit={handleCreateGoal} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <TextField
              label="Goal Title"
              type="text"
              placeholder="e.g., Deliver Next.js App migration"
              required
              value={goalForm.title}
              onChange={v => setGoalForm({ ...goalForm, title: v })}
              validator={required('Goal title')}
              forceError={submitted}
            />

            <Textarea
              label="Description"
              placeholder="Detail target scope and milestones..."
              value={goalForm.description}
              onChange={v => setGoalForm({ ...goalForm, description: v })}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <TextField
                label="Weightage (%)"
                type="text"
                required
                value={String(goalForm.weightage)}
                onChange={v => setGoalForm({ ...goalForm, weightage: v === '' ? 0 : parseInt(v) })}
                validator={percentage}
                restrict="digits"
                maxLength={3}
                forceError={submitted}
              />
              <TextField
                label="Target Metric"
                type="text"
                placeholder="e.g. 100% test coverage"
                value={goalForm.target}
                onChange={v => setGoalForm({ ...goalForm, target: v })}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <Button type="button" variant="ghost" onClick={() => setShowGoalModal(false)}>Cancel</Button>
              <Button type="submit" variant="primary">Record Goal</Button>
            </div>
          </form>
        </Modal>

        {/* Continuous 360 Review Modal */}
        <Modal
          open={showFeedbackModal}
          onClose={() => setShowFeedbackModal(false)}
          title="Write Peer Review"
          width={440}
        >
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '-0.5rem', marginBottom: '1rem' }}>
            Provide continuous performance insights
          </p>

          {formError && (
            <div style={{ marginBottom: '1rem' }}>
              <Banner tone="danger">{formError}</Banner>
            </div>
          )}

          <form onSubmit={handleCreateFeedback} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Field label="Select Team Member" required>
              <select required value={feedbackForm.employeeId} onChange={e => setFeedbackForm({ ...feedbackForm, employeeId: e.target.value })} className="select-field">
                <option value="">Choose colleague...</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName} ({emp.jobTitle})</option>
                ))}
              </select>
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Select
                label="Colleague Relationship"
                value={feedbackForm.relationship}
                onChange={v => setFeedbackForm({ ...feedbackForm, relationship: v })}
                options={[
                  { value: 'PEER', label: 'Peer' },
                  { value: 'SUBORDINATE', label: 'Subordinate' },
                  { value: 'MANAGER', label: 'Manager' },
                ]}
              />
              <Select
                label="Anonymity"
                value={feedbackForm.anonymous ? 'true' : 'false'}
                onChange={v => setFeedbackForm({ ...feedbackForm, anonymous: v === 'true' })}
                options={[
                  { value: 'false', label: 'Share My Name' },
                  { value: 'true', label: 'Make Anonymous' },
                ]}
              />
            </div>

            <Select
              label="Colleague Evaluation Score"
              value={String(feedbackForm.rating)}
              onChange={v => setFeedbackForm({ ...feedbackForm, rating: parseInt(v) })}
              options={[
                { value: '5', label: '5 - Masterful / Outperforming' },
                { value: '4', label: '4 - High Quality / Strong' },
                { value: '3', label: '3 - Fully Competent' },
                { value: '2', label: '2 - Needs Improvement' },
                { value: '1', label: '1 - Severe Performance Gaps' },
              ]}
            />

            <Textarea
              label="Written Review & Feedback"
              placeholder="Describe how this colleague contributes to the team and project success..."
              required
              value={feedbackForm.feedback}
              onChange={v => setFeedbackForm({ ...feedbackForm, feedback: v })}
              validator={required('Feedback')}
              forceError={submitted}
            />

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <Button type="button" variant="ghost" onClick={() => setShowFeedbackModal(false)}>Cancel</Button>
              <Button type="submit" variant="primary">Submit Review</Button>
            </div>
          </form>
        </Modal>
      </main>
    </div>
  );
}
