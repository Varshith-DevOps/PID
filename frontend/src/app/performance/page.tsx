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

export default function PerformanceDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [kras, setKras] = useState<KRA[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals & Drawers
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

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
    try {
      const [krasData, feedbackData, employeesData] = await Promise.all([
        getKras(),
        getFeedback360(),
        getEmployees(),
      ]);
      setKras(krasData);
      setFeedbacks(feedbackData);
      setEmployees(employeesData.employees.filter((e: any) => e.id !== user?.employeeId));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.employeeId) return;
    try {
      await createKra({
        employeeId: user.employeeId,
        ...goalForm,
      });
      setShowGoalModal(false);
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
    try {
      await submitFeedback360(feedbackForm);
      setShowFeedbackModal(false);
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
        
        {/* Header */}
        <div className="page-header">
          <div className="page-header-left">
            <div className="page-header-icon" style={{ background: 'linear-gradient(135deg, #ec4899, #f43f5e)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))' }}>
                <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
              </svg>
            </div>
            <div>
              <h1 className="page-title">Performance & Goals</h1>
              <p className="page-subtitle">Track your Key Result Areas (KRAs), continuous peer reviews, and appraisals</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={() => router.push('/performance/appraisals')} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              📋 Appraisal Cycles
            </button>
            <button onClick={() => setShowGoalModal(true)} className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #ec4899, #f43f5e)', border: 'none', boxShadow: '0 4px 15px rgba(236,72,153,0.3)' }}>
              + Define Goal KRA
            </button>
          </div>
        </div>

        {/* Aggregate Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="glass-card" style={{ padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>KRA Target Weightage</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.5rem', display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
              {totalWeightage}% <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }}>/ 100%</span>
            </div>
            <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', marginTop: '0.75rem', overflow: 'hidden' }}>
              <div style={{ width: `${totalWeightage}%`, height: '100%', background: 'linear-gradient(90deg, #ec4899, #f43f5e)' }}></div>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>360 Peer Evaluation</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.5rem', display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
              {averageFeedbackRating} <span style={{ fontSize: '0.8rem', fontWeight: 400, color: '#eab308' }}>★</span>
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Based on {feedbacks.length} peer feedback responses</div>
          </div>

          <div className="glass-card" style={{ padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Active Goals</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.5rem' }}>
              {kras.filter(k => k.status === 'IN_PROGRESS' || k.status === 'PENDING').length}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>{kras.filter(k => k.status === 'ACHIEVED').length} goals achieved</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
          
          {/* Personal Goals (KRAs) Block */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'white' }}>Key Result Areas (KRAs)</h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Year 2026 Goals</span>
            </div>

            {loading ? (
              <div className="loading-container"><div className="loading-spinner" />Loading goals...</div>
            ) : kras.length === 0 ? (
              <div className="empty-state" style={{ minHeight: '200px' }}>No active goals defined. Click "Define Goal KRA" to start.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {kras.map(kra => (
                  <div key={kra.id} className="glass-card" style={{ padding: '1.25rem', borderLeft: kra.status === 'ACHIEVED' ? '4px solid #10b981' : kra.status === 'MISSED' ? '4px solid #ef4444' : '4px solid #ec4899', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h3 style={{ fontSize: '0.92rem', fontWeight: 600, color: 'white' }}>{kra.title}</h3>
                        {kra.description && <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>{kra.description}</p>}
                      </div>
                      <select value={kra.status} onChange={e => handleStatusChange(kra.id, e.target.value)} className="select-field" style={{ width: '120px', padding: '0.2rem', fontSize: '0.7rem' }}>
                        <option value="PENDING">Pending</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="ACHIEVED">Achieved</option>
                        <option value="MISSED">Missed</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      <div>🎯 Target: <strong>{kra.target || '—'}</strong></div>
                      <div>Weightage: <span style={{ color: '#ec4899', fontWeight: 600 }}>{kra.weightage}%</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 360 Continuous Feedback Block */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'white' }}>360 Peer Reviews</h2>
              <button onClick={() => setShowFeedbackModal(true)} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem' }}>
                ✍️ Write Peer Review
              </button>
            </div>

            {loading ? (
              <div className="loading-container"><div className="loading-spinner" />Loading feedback...</div>
            ) : feedbacks.length === 0 ? (
              <div className="empty-state" style={{ minHeight: '200px' }}>No anonymous peer reviews recorded yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {feedbacks.map(fb => (
                  <div key={fb.id} className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'white' }}>
                        {fb.reviewer.firstName} {fb.reviewer.lastName} ({fb.relationship})
                      </span>
                      <span style={{ color: '#eab308', fontSize: '0.7rem' }}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <span key={i}>{i < fb.rating ? '★' : '☆'}</span>
                        ))}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.15)', padding: '0.5rem', borderRadius: '4px', fontStyle: 'italic' }}>
                      "{fb.feedback}"
                    </p>
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', alignSelf: 'flex-end' }}>
                      {new Date(fb.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Define Goal Modal */}
        {showGoalModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>Define KRA Goal</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Create a Key Result Area target metric</p>
              </div>

              <form onSubmit={handleCreateGoal} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Goal Title</label>
                  <input type="text" placeholder="e.g., Deliver Next.js App migration" required value={goalForm.title} onChange={e => setGoalForm({ ...goalForm, title: e.target.value })} className="input-field" />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Description</label>
                  <textarea placeholder="Detail target scope and milestones..." value={goalForm.description} onChange={e => setGoalForm({ ...goalForm, description: e.target.value })} className="input-field" style={{ minHeight: '60px', fontFamily: 'inherit' }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Weightage (%)</label>
                    <input type="number" required min="1" max="100" value={goalForm.weightage} onChange={e => setGoalForm({ ...goalForm, weightage: parseInt(e.target.value) })} className="input-field" />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Target Metric</label>
                    <input type="text" placeholder="e.g. 100% test coverage" value={goalForm.target} onChange={e => setGoalForm({ ...goalForm, target: e.target.value })} className="input-field" />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button type="button" onClick={() => setShowGoalModal(false)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #ec4899, #f43f5e)', border: 'none' }}>
                    Record Goal
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Continuous 360 Review Modal */}
        {showFeedbackModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>Write Peer Review</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Provide continuous performance insights</p>
              </div>

              <form onSubmit={handleCreateFeedback} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Select Team Member</label>
                  <select required value={feedbackForm.employeeId} onChange={e => setFeedbackForm({ ...feedbackForm, employeeId: e.target.value })} className="select-field">
                    <option value="">Choose colleague...</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName} ({emp.jobTitle})</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Colleague Relationship</label>
                    <select value={feedbackForm.relationship} onChange={e => setFeedbackForm({ ...feedbackForm, relationship: e.target.value })} className="select-field">
                      <option value="PEER">Peer</option>
                      <option value="SUBORDINATE">Subordinate</option>
                      <option value="MANAGER">Manager</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Anonymity</label>
                    <select value={feedbackForm.anonymous ? 'true' : 'false'} onChange={e => setFeedbackForm({ ...feedbackForm, anonymous: e.target.value === 'true' })} className="select-field">
                      <option value="false">Share My Name</option>
                      <option value="true">Make Anonymous</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Colleague Evaluation Score</label>
                  <select value={feedbackForm.rating} onChange={e => setFeedbackForm({ ...feedbackForm, rating: parseInt(e.target.value) })} className="select-field">
                    <option value="5">5 - Masterful / Outperforming</option>
                    <option value="4">4 - High Quality / Strong</option>
                    <option value="3">3 - Fully Competent</option>
                    <option value="2">2 - Needs Improvement</option>
                    <option value="1">1 - Severe Performance Gaps</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Written Review & Feedback</label>
                  <textarea placeholder="Describe how this colleague contributes to the team and project success..." required value={feedbackForm.feedback} onChange={e => setFeedbackForm({ ...feedbackForm, feedback: e.target.value })} className="input-field" style={{ minHeight: '80px', fontFamily: 'inherit' }} />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button type="button" onClick={() => setShowFeedbackModal(false)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #ec4899, #f43f5e)', border: 'none' }}>
                    Submit Review
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
