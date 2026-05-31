'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import {
  getAppraisals,
  createAppraisal,
  submitSelfEvaluation,
  submitManagerEvaluation,
  getEmployees,
} from '@/lib/api';
import Sidebar from '@/components/Sidebar';

interface Appraisal {
  id: string;
  appraisalCycle: string;
  startDate: string;
  endDate: string;
  selfRating?: number;
  selfFeedback?: string;
  managerRating?: number;
  managerFeedback?: string;
  finalRating?: number;
  status: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
    jobTitle: string;
    department: { name: string };
  };
}

export default function AppraisalsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [appraisals, setAppraisals] = useState<Appraisal[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppraisal, setSelectedAppraisal] = useState<Appraisal | null>(null);

  // Modals & Panels
  const [showInitiateModal, setShowInitiateModal] = useState(false);
  const [showSelfModal, setShowSelfModal] = useState(false);
  const [showManagerModal, setShowManagerModal] = useState(false);

  // Initiate Form State
  const [initiateForm, setInitiateForm] = useState({
    employeeId: '',
    appraisalCycle: 'FY26 Annual Appraisal Cycle',
    startDate: '',
    endDate: '',
  });

  // Self Eval State
  const [selfForm, setSelfForm] = useState({
    selfRating: 5,
    selfFeedback: '',
  });

  // Manager Eval State
  const [managerForm, setManagerForm] = useState({
    managerRating: 5,
    managerFeedback: '',
    finalRating: 5,
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
      const allAppraisals = await getAppraisals({ all: user?.role === 'ADMIN' || user?.role === 'HR' });
      setAppraisals(allAppraisals);

      if (user?.role === 'ADMIN' || user?.role === 'HR') {
        const empData = await getEmployees();
        setEmployees(empData.employees);
      }

      if (selectedAppraisal) {
        const updated = allAppraisals.find((a: any) => a.id === selectedAppraisal.id);
        if (updated) setSelectedAppraisal(updated);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInitiateAppraisal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createAppraisal(initiateForm);
      setShowInitiateModal(false);
      setInitiateForm({ employeeId: '', appraisalCycle: 'FY26 Annual Appraisal Cycle', startDate: '', endDate: '' });
      loadData();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to initiate appraisal cycle');
    }
  };

  const handleSelfSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppraisal) return;
    try {
      await submitSelfEvaluation(selectedAppraisal.id, selfForm);
      setShowSelfModal(false);
      setSelfForm({ selfRating: 5, selfFeedback: '' });
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to submit self-evaluation');
    }
  };

  const handleManagerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppraisal) return;
    try {
      await submitManagerEvaluation(selectedAppraisal.id, managerForm);
      setShowManagerModal(false);
      setManagerForm({ managerRating: 5, managerFeedback: '', finalRating: 5 });
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to submit manager evaluation');
    }
  };

  if (authLoading || !user) {
    return <div className="loading-container"><div className="loading-spinner" />Loading...</div>;
  }

  const isAdminOrHR = user?.role === 'ADMIN' || user?.role === 'HR';

  return (
    <div className="app-layout">
      <Sidebar activePath="/performance" />
      <main className="main-content">
        
        {/* Header */}
        <div className="page-header">
          <div className="page-header-left">
            <div className="page-header-icon" style={{ background: 'linear-gradient(135deg, #ec4899, #f43f5e)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))' }}>
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div>
              <h1 className="page-title">Appraisal Cycles</h1>
              <p className="page-subtitle">Submit self-ratings, collect manager scores, and review historical revisions</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={() => router.push('/performance')} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              Back to Goals
            </button>
            {isAdminOrHR && (
              <button onClick={() => setShowInitiateModal(true)} className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #ec4899, #f43f5e)', border: 'none', boxShadow: '0 4px 15px rgba(236,72,153,0.3)' }}>
                Initiate Appraisal Cycle
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="loading-container"><div className="loading-spinner" />Loading appraisal cycles...</div>
        ) : appraisals.length === 0 ? (
          <div className="empty-state" style={{ minHeight: '250px' }}>
            No appraisal cycles have been initiated yet.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
            
            {/* Cycles List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'white', marginBottom: '0.25rem' }}>Active Cycles</h2>
              
              {appraisals.map(app => (
                <div key={app.id} onClick={() => setSelectedAppraisal(app)} className="glass-card" style={{ padding: '1.25rem', cursor: 'pointer', border: selectedAppraisal?.id === app.id ? '1px solid #ec4899' : '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: selectedAppraisal?.id === app.id ? 'rgba(236,72,153,0.03)' : 'rgba(255,255,255,0.02)', transition: 'background 0.2s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ fontSize: '0.92rem', fontWeight: 600, color: 'white' }}>{app.appraisalCycle}</h3>
                      {isAdminOrHR && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          Employee: <strong>{app.employee.firstName} {app.employee.lastName}</strong> ({app.employee.jobTitle})
                        </span>
                      )}
                    </div>
                    <span className="badge" style={{ background: app.status === 'COMPLETED' ? '#10b981' : app.status === 'SUBMITTED_SELF' ? '#06b6d4' : '#ec4899', color: 'white', fontSize: '0.65rem' }}>
                      {app.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                    <span>Timeline: {new Date(app.startDate).toLocaleDateString()} - {new Date(app.endDate).toLocaleDateString()}</span>
                    {app.finalRating && <span style={{ color: '#eab308', fontWeight: 600 }}>Grade: {app.finalRating} ★</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* Appraisal Details Panel */}
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'white', marginBottom: '1rem' }}>Appraisal Workspace</h2>
              
              {!selectedAppraisal ? (
                <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Select an appraisal cycle from the left to view self/manager evaluation forms.
                </div>
              ) : (
                <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>{selectedAppraisal.appraisalCycle}</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Assigned to: {selectedAppraisal.employee.firstName} {selectedAppraisal.employee.lastName} ({selectedAppraisal.employee.jobTitle})
                    </p>
                  </div>

                  {/* Self Evaluation Review Block */}
                  <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.8rem', color: 'white' }}>1. Employee Self Evaluation</span>
                      {selectedAppraisal.selfRating ? (
                        <span style={{ color: '#eab308', fontSize: '0.72rem' }}>Self Grade: {selectedAppraisal.selfRating} ★</span>
                      ) : (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Pending Submission</span>
                      )}
                    </div>
                    {selectedAppraisal.selfFeedback ? (
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.15)', padding: '0.5rem', borderRadius: '4px', fontStyle: 'italic' }}>
                        "{selectedAppraisal.selfFeedback}"
                      </p>
                    ) : (
                      user.employeeId === selectedAppraisal.employee.id && (
                        <button onClick={() => setShowSelfModal(true)} className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #ec4899, #f43f5e)', border: 'none', fontSize: '0.72rem', alignSelf: 'flex-start', marginTop: '0.25rem' }}>
                          Submit Self Review
                        </button>
                      )
                    )}
                  </div>

                  {/* Manager Evaluation Review Block */}
                  <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.8rem', color: 'white' }}>2. Manager Evaluation</span>
                      {selectedAppraisal.managerRating ? (
                        <span style={{ color: '#eab308', fontSize: '0.72rem' }}>Manager Grade: {selectedAppraisal.managerRating} ★</span>
                      ) : (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Pending Evaluation</span>
                      )}
                    </div>
                    {selectedAppraisal.managerFeedback ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.15)', padding: '0.5rem', borderRadius: '4px', fontStyle: 'italic' }}>
                          "{selectedAppraisal.managerFeedback}"
                        </p>
                        {selectedAppraisal.finalRating && (
                          <div style={{ fontSize: '0.75rem', color: 'white', marginTop: '0.25rem', fontWeight: 600 }}>
                            🎯 Final Agreed Rating: {selectedAppraisal.finalRating} / 5.0 (Closed by {selectedAppraisal.approvedBy})
                          </div>
                        )}
                      </div>
                    ) : (
                      isAdminOrHR && selectedAppraisal.status === 'SUBMITTED_SELF' && (
                        <button onClick={() => setShowManagerModal(true)} className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', fontSize: '0.72rem', alignSelf: 'flex-start', marginTop: '0.25rem' }}>
                          Submit Manager Review & Close
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* Initiate Appraisal Modal */}
        {showInitiateModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>Initiate Appraisal</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Launch an evaluation cycle for a colleague</p>
              </div>

              <form onSubmit={handleInitiateAppraisal} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Select Employee</label>
                  <select required value={initiateForm.employeeId} onChange={e => setInitiateForm({ ...initiateForm, employeeId: e.target.value })} className="select-field">
                    <option value="">Select Employee...</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName} ({emp.jobTitle})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Appraisal Cycle Name</label>
                  <input type="text" placeholder="e.g. FY26 Annual Appraisal" required value={initiateForm.appraisalCycle} onChange={e => setInitiateForm({ ...initiateForm, appraisalCycle: e.target.value })} className="input-field" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Start Date</label>
                    <input type="date" required value={initiateForm.startDate} onChange={e => setInitiateForm({ ...initiateForm, startDate: e.target.value })} className="input-field" />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>End Date</label>
                    <input type="date" required value={initiateForm.endDate} onChange={e => setInitiateForm({ ...initiateForm, endDate: e.target.value })} className="input-field" />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button type="button" onClick={() => setShowInitiateModal(false)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #ec4899, #f43f5e)', border: 'none' }}>
                    Launch Cycle
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Self Evaluation Modal */}
        {showSelfModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '400px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>Submit Self evaluation</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Evaluate your performance over the cycle</p>
              </div>

              <form onSubmit={handleSelfSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Self Rating Score (1 to 5)</label>
                  <select value={selfForm.selfRating} onChange={e => setSelfForm({ ...selfForm, selfRating: parseInt(e.target.value) })} className="select-field">
                    <option value="5">5 - Substantially Exceeded Standards</option>
                    <option value="4">4 - Exceeded Standards</option>
                    <option value="3">3 - Met Standards</option>
                    <option value="2">2 - Partially Met Standards</option>
                    <option value="1">1 - Did Not Meet Standards</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Self Accomplishments & Feedback</label>
                  <textarea placeholder="Summarize your key project successes, goals achieved, and structural contributions..." required value={selfForm.selfFeedback} onChange={e => setSelfForm({ ...selfForm, selfFeedback: e.target.value })} className="input-field" style={{ minHeight: '100px', fontFamily: 'inherit' }} />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button type="button" onClick={() => setShowSelfModal(false)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #ec4899, #f43f5e)', border: 'none' }}>
                    Confirm Submission
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Manager Evaluation Modal */}
        {showManagerModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '400px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>Submit Manager evaluation</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Review and grade employee accomplishments</p>
              </div>

              <form onSubmit={handleManagerSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Manager Evaluation Score (1 to 5)</label>
                  <select value={managerForm.managerRating} onChange={e => setManagerForm({ ...managerForm, managerRating: parseInt(e.target.value) })} className="select-field">
                    <option value="5">5 - Substantially Exceeded Standards</option>
                    <option value="4">4 - Exceeded Standards</option>
                    <option value="3">3 - Met Standards</option>
                    <option value="2">2 - Partially Met Standards</option>
                    <option value="1">1 - Did Not Meet Standards</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Final Agreed Rating Score (1 to 5)</label>
                  <select value={managerForm.finalRating} onChange={e => setManagerForm({ ...managerForm, finalRating: parseInt(e.target.value) })} className="select-field">
                    <option value="5">5 - Substantially Exceeded Standards</option>
                    <option value="4">4 - Exceeded Standards</option>
                    <option value="3">3 - Met Standards</option>
                    <option value="2">2 - Partially Met Standards</option>
                    <option value="1">1 - Did Not Meet Standards</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Manager Evaluation Feedback</label>
                  <textarea placeholder="Outline employee performance during this cycle, target metrics completed, and areas of growth..." required value={managerForm.managerFeedback} onChange={e => setManagerForm({ ...managerForm, managerFeedback: e.target.value })} className="input-field" style={{ minHeight: '100px', fontFamily: 'inherit' }} />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button type="button" onClick={() => setShowManagerModal(false)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none' }}>
                    Conclude Appraisal
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
