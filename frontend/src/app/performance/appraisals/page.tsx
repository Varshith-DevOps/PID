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
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  LoadingBlock,
  Modal,
  PageHeader,
  Select,
  StatusChip,
} from '@/components/ui';

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
  approvedBy?: string;
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

const APPRAISAL_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const RATING_OPTIONS = [
  { value: '5', label: '5 - Substantially Exceeded Standards' },
  { value: '4', label: '4 - Exceeded Standards' },
  { value: '3', label: '3 - Met Standards' },
  { value: '2', label: '2 - Partially Met Standards' },
  { value: '1', label: '1 - Did Not Meet Standards' },
];

export default function AppraisalsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [appraisals, setAppraisals] = useState<Appraisal[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
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
    setError(false);
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
      setError(true);
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

        <PageHeader
          title="Appraisal Cycles"
          subtitle="Submit self-ratings, collect manager scores, and review historical revisions"
          icon={APPRAISAL_ICON}
          actions={
            <>
              <Button variant="ghost" onClick={() => router.push('/performance')}>
                Back to Goals
              </Button>
              {isAdminOrHR && (
                <Button variant="primary" onClick={() => setShowInitiateModal(true)}>
                  Initiate Appraisal Cycle
                </Button>
              )}
            </>
          }
        />

        {loading ? (
          <LoadingBlock label="Loading appraisal cycles..." />
        ) : error ? (
          <ErrorState onRetry={loadData} />
        ) : appraisals.length === 0 ? (
          <EmptyState
            title="No appraisal cycles"
            message="No appraisal cycles have been initiated yet."
            action={isAdminOrHR ? <Button variant="primary" size="sm" onClick={() => setShowInitiateModal(true)}>Initiate Appraisal Cycle</Button> : undefined}
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>

            {/* Cycles List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Active Cycles</h2>

              {appraisals.map(app => (
                <Card
                  key={app.id}
                  onClick={() => setSelectedAppraisal(app)}
                  style={{
                    cursor: 'pointer',
                    border: selectedAppraisal?.id === app.id ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                    background: selectedAppraisal?.id === app.id ? 'var(--surface-sunken)' : undefined,
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <div>
                        <h3 style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)' }}>{app.appraisalCycle}</h3>
                        {isAdminOrHR && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            Employee: <strong>{app.employee.firstName} {app.employee.lastName}</strong> ({app.employee.jobTitle})
                          </span>
                        )}
                      </div>
                      <StatusChip status={app.status} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                      <span>Timeline: {new Date(app.startDate).toLocaleDateString()} - {new Date(app.endDate).toLocaleDateString()}</span>
                      {app.finalRating && <span style={{ color: 'var(--warning-fg)', fontWeight: 600 }}>Grade: {app.finalRating} ★</span>}
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Appraisal Details Panel */}
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem' }}>Appraisal Workspace</h2>

              {!selectedAppraisal ? (
                <Card style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '2rem' }}>
                  Select an appraisal cycle from the left to view self/manager evaluation forms.
                </Card>
              ) : (
                <Card style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedAppraisal.appraisalCycle}</h3>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Assigned to: {selectedAppraisal.employee.firstName} {selectedAppraisal.employee.lastName} ({selectedAppraisal.employee.jobTitle})
                      </p>
                    </div>

                    {/* Self Evaluation Review Block */}
                    <div style={{ padding: '1rem', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-primary)' }}>1. Employee Self Evaluation</span>
                        {selectedAppraisal.selfRating ? (
                          <span style={{ color: 'var(--warning-fg)', fontSize: '0.72rem' }}>Self Grade: {selectedAppraisal.selfRating} ★</span>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Pending Submission</span>
                        )}
                      </div>
                      {selectedAppraisal.selfFeedback ? (
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'var(--surface-raised)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', fontStyle: 'italic' }}>
                          "{selectedAppraisal.selfFeedback}"
                        </p>
                      ) : (
                        user.employeeId === selectedAppraisal.employee.id && (
                          <Button variant="primary" size="sm" onClick={() => setShowSelfModal(true)} style={{ alignSelf: 'flex-start', marginTop: '0.25rem' }}>
                            Submit Self Review
                          </Button>
                        )
                      )}
                    </div>

                    {/* Manager Evaluation Review Block */}
                    <div style={{ padding: '1rem', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-primary)' }}>2. Manager Evaluation</span>
                        {selectedAppraisal.managerRating ? (
                          <span style={{ color: 'var(--warning-fg)', fontSize: '0.72rem' }}>Manager Grade: {selectedAppraisal.managerRating} ★</span>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Pending Evaluation</span>
                        )}
                      </div>
                      {selectedAppraisal.managerFeedback ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'var(--surface-raised)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', fontStyle: 'italic' }}>
                            "{selectedAppraisal.managerFeedback}"
                          </p>
                          {selectedAppraisal.finalRating && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-primary)', marginTop: '0.25rem', fontWeight: 600 }}>
                              🎯 Final Agreed Rating: {selectedAppraisal.finalRating} / 5.0 (Closed by {selectedAppraisal.approvedBy})
                            </div>
                          )}
                        </div>
                      ) : (
                        isAdminOrHR && selectedAppraisal.status === 'SUBMITTED_SELF' && (
                          <Button variant="success" size="sm" onClick={() => setShowManagerModal(true)} style={{ alignSelf: 'flex-start', marginTop: '0.25rem' }}>
                            Submit Manager Review & Close
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                </Card>
              )}
            </div>

          </div>
        )}

        {/* Initiate Appraisal Modal */}
        <Modal
          open={showInitiateModal}
          onClose={() => setShowInitiateModal(false)}
          title="Initiate Appraisal"
          width={440}
        >
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '-0.5rem', marginBottom: '1rem' }}>
            Launch an evaluation cycle for a colleague
          </p>

          <form onSubmit={handleInitiateAppraisal} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Field label="Select Employee" required>
              <select required value={initiateForm.employeeId} onChange={e => setInitiateForm({ ...initiateForm, employeeId: e.target.value })} className="select-field">
                <option value="">Select Employee...</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName} ({emp.jobTitle})</option>
                ))}
              </select>
            </Field>

            <Field label="Appraisal Cycle Name" required>
              <input type="text" placeholder="e.g. FY26 Annual Appraisal" required value={initiateForm.appraisalCycle} onChange={e => setInitiateForm({ ...initiateForm, appraisalCycle: e.target.value })} className="input-field" />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Field label="Start Date" required>
                <input type="date" required value={initiateForm.startDate} onChange={e => setInitiateForm({ ...initiateForm, startDate: e.target.value })} className="input-field" />
              </Field>
              <Field label="End Date" required>
                <input type="date" required value={initiateForm.endDate} onChange={e => setInitiateForm({ ...initiateForm, endDate: e.target.value })} className="input-field" />
              </Field>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <Button type="button" variant="ghost" onClick={() => setShowInitiateModal(false)}>Cancel</Button>
              <Button type="submit" variant="primary">Launch Cycle</Button>
            </div>
          </form>
        </Modal>

        {/* Self Evaluation Modal */}
        <Modal
          open={showSelfModal}
          onClose={() => setShowSelfModal(false)}
          title="Submit Self evaluation"
          width={400}
        >
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '-0.5rem', marginBottom: '1rem' }}>
            Evaluate your performance over the cycle
          </p>

          <form onSubmit={handleSelfSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Select
              label="Self Rating Score (1 to 5)"
              value={String(selfForm.selfRating)}
              onChange={v => setSelfForm({ ...selfForm, selfRating: parseInt(v) })}
              options={RATING_OPTIONS}
            />

            <Field label="Self Accomplishments & Feedback">
              <textarea placeholder="Summarize your key project successes, goals achieved, and structural contributions..." required value={selfForm.selfFeedback} onChange={e => setSelfForm({ ...selfForm, selfFeedback: e.target.value })} className="textarea-field" style={{ minHeight: '100px' }} />
            </Field>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <Button type="button" variant="ghost" onClick={() => setShowSelfModal(false)}>Cancel</Button>
              <Button type="submit" variant="primary">Confirm Submission</Button>
            </div>
          </form>
        </Modal>

        {/* Manager Evaluation Modal */}
        <Modal
          open={showManagerModal}
          onClose={() => setShowManagerModal(false)}
          title="Submit Manager evaluation"
          width={400}
        >
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '-0.5rem', marginBottom: '1rem' }}>
            Review and grade employee accomplishments
          </p>

          <form onSubmit={handleManagerSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Select
              label="Manager Evaluation Score (1 to 5)"
              value={String(managerForm.managerRating)}
              onChange={v => setManagerForm({ ...managerForm, managerRating: parseInt(v) })}
              options={RATING_OPTIONS}
            />

            <Select
              label="Final Agreed Rating Score (1 to 5)"
              value={String(managerForm.finalRating)}
              onChange={v => setManagerForm({ ...managerForm, finalRating: parseInt(v) })}
              options={RATING_OPTIONS}
            />

            <Field label="Manager Evaluation Feedback">
              <textarea placeholder="Outline employee performance during this cycle, target metrics completed, and areas of growth..." required value={managerForm.managerFeedback} onChange={e => setManagerForm({ ...managerForm, managerFeedback: e.target.value })} className="textarea-field" style={{ minHeight: '100px' }} />
            </Field>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <Button type="button" variant="ghost" onClick={() => setShowManagerModal(false)}>Cancel</Button>
              <Button type="submit" variant="success">Conclude Appraisal</Button>
            </div>
          </form>
        </Modal>
      </main>
    </div>
  );
}
