'use client';

import React, { useState, useEffect } from 'react';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
}

export default function AppraisalForm() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activeTab, setActiveTab] = useState<'self' | 'manager'>('self');
  const [cycleName] = useState<string>('H1 2026 Appraisal Cycle');

  // Self Eval State
  const [selfScore, setSelfScore] = useState<number>(4.0);
  const [selfComments, setSelfComments] = useState<string>('');
  const [selfSubmitted, setSelfSubmitted] = useState<boolean>(false);

  // Manager Eval State
  const [selectedReportee, setSelectedReportee] = useState<string>('');
  const [managerScore, setManagerScore] = useState<number>(4.0);
  const [perfRating, setPerfRating] = useState<number>(2); // 2 = Medium
  const [potRating, setPotRating] = useState<number>(2); // 2 = Medium
  const [managerComments, setManagerComments] = useState<string>('');
  const [mgrSubmitted, setMgrSubmitted] = useState<boolean>(false);
  const [mgrLoading, setMgrLoading] = useState<boolean>(false);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/employees');
      if (res.ok) {
        const data = await res.json();
        setEmployees(data);
      }
    } catch (err) {
      console.error('Failed to load employees:', err);
    }
  };

  const handleSelfSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/appraisals/self-evaluation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cycleName,
          selfRatingScore: selfScore,
          selfComments
        })
      });
      if (res.ok) {
        setSelfSubmitted(true);
      }
    } catch (err) {
      console.error('Failed to submit self evaluation:', err);
    }
  };

  const handleManagerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReportee) return;

    setMgrLoading(true);
    try {
      const res = await fetch('/api/appraisals/manager-evaluation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: selectedReportee,
          cycleName,
          managerRatingScore: managerScore,
          managerComments,
          performanceRating: perfRating,
          potentialRating: potRating
        })
      });
      if (res.ok) {
        setMgrSubmitted(true);
        setSelectedReportee('');
        setManagerComments('');
      }
    } catch (err) {
      console.error('Failed to submit manager evaluation:', err);
    } finally {
      setMgrLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.tabHeaders}>
        <button 
          onClick={() => { setActiveTab('self'); setSelfSubmitted(false); }}
          style={{ ...styles.tabBtn, ...(activeTab === 'self' ? styles.tabBtnActive : {}) }}
        >
          Self Evaluation
        </button>
        <button 
          onClick={() => { setActiveTab('manager'); setMgrSubmitted(false); }}
          style={{ ...styles.tabBtn, ...(activeTab === 'manager' ? styles.tabBtnActive : {}) }}
        >
          Manager Evaluation
        </button>
      </div>

      <div style={styles.content}>
        {activeTab === 'self' ? (
          selfSubmitted ? (
            <div style={styles.successBlock}>
              <div style={styles.successIcon}>✓</div>
              <h4 style={styles.successTitle}>Self Appraisal Submitted</h4>
              <p style={styles.successText}>Your self evaluation score and comments have been recorded for the {cycleName}.</p>
            </div>
          ) : (
            <form onSubmit={handleSelfSubmit} style={styles.form}>
              <h3 style={styles.formTitle}>Submit Self Evaluation ({cycleName})</h3>
              
              <div style={styles.formGroup}>
                <label style={styles.label}>Self Rating Score (1.0 to 5.0): {selfScore.toFixed(1)}</label>
                <input 
                  type="range" 
                  min="1" 
                  max="5" 
                  step="0.1"
                  value={selfScore}
                  onChange={(e) => setSelfScore(parseFloat(e.target.value))}
                  style={styles.slider} 
                />
                <div style={styles.rangeLabels}>
                  <span>1.0 (Low)</span>
                  <span>3.0 (Met Expectations)</span>
                  <span>5.0 (Outstanding)</span>
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Self Comments & Accomplishments</label>
                <textarea 
                  value={selfComments}
                  onChange={(e) => setSelfComments(e.target.value)}
                  placeholder="Outline key accomplishments, learnings, and goals achieved..."
                  style={styles.textarea}
                  rows={6}
                  required
                />
              </div>

              <button type="submit" style={styles.submitBtn}>Submit Self Review</button>
            </form>
          )
        ) : (
          mgrSubmitted ? (
            <div style={styles.successBlock}>
              <div style={styles.successIcon}>✓</div>
              <h4 style={styles.successTitle}>Manager Evaluation Submitted</h4>
              <p style={styles.successText}>The performance and potential appraisal for the employee has been completed.</p>
            </div>
          ) : (
            <form onSubmit={handleManagerSubmit} style={styles.form}>
              <h3 style={styles.formTitle}>Review a Direct Report ({cycleName})</h3>

              <div style={styles.formGroup}>
                <label style={styles.label}>Select Reportee</label>
                <select 
                  value={selectedReportee} 
                  onChange={(e) => setSelectedReportee(e.target.value)} 
                  style={styles.select}
                  required
                >
                  <option value="">Choose employee...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName} ({emp.jobTitle})</option>
                  ))}
                </select>
              </div>

              <div style={styles.grid2}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Performance Rating</label>
                  <select 
                    value={perfRating} 
                    onChange={(e) => setPerfRating(Number(e.target.value))} 
                    style={styles.select}
                  >
                    <option value={1}>1 - Low Performer</option>
                    <option value={2}>2 - Medium (Met Expectations)</option>
                    <option value={3}>3 - High Performer</option>
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Potential Rating</label>
                  <select 
                    value={potRating} 
                    onChange={(e) => setPotRating(Number(e.target.value))} 
                    style={styles.select}
                  >
                    <option value={1}>1 - Low Potential</option>
                    <option value={2}>2 - Medium (Core potential)</option>
                    <option value={3}>3 - High Potential</option>
                  </select>
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Manager Rating Score (1.0 to 5.0): {managerScore.toFixed(1)}</label>
                <input 
                  type="range" 
                  min="1" 
                  max="5" 
                  step="0.1"
                  value={managerScore}
                  onChange={(e) => setManagerScore(parseFloat(e.target.value))}
                  style={styles.slider} 
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Manager Feedback & Development Plan</label>
                <textarea 
                  value={managerComments}
                  onChange={(e) => setManagerComments(e.target.value)}
                  placeholder="Record strengths, gaps, and future development opportunities..."
                  style={styles.textarea}
                  rows={5}
                  required
                />
              </div>

              <button type="submit" disabled={mgrLoading} style={styles.submitBtn}>
                {mgrLoading ? 'Submitting...' : 'Submit Manager Review'}
              </button>
            </form>
          )
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#151518',
    border: '1px solid #222225',
    borderRadius: '12px',
    padding: '24px',
    color: '#f5f5f7',
    fontFamily: 'Inter, system-ui, sans-serif',
    boxShadow: '0 4px 15px rgba(0,0,0,0.15)'
  },
  tabHeaders: {
    display: 'flex',
    gap: '12px',
    borderBottom: '1px solid #222225',
    paddingBottom: '12px',
    marginBottom: '20px'
  },
  tabBtn: {
    padding: '8px 16px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#8e8e93',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    borderRadius: '6px',
    transition: 'all 0.2s'
  },
  tabBtnActive: {
    color: '#ffffff',
    backgroundColor: '#222225'
  },
  content: {},
  formTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 0,
    marginBottom: '18px'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  label: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#8e8e93',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  slider: {
    width: '100%',
    cursor: 'pointer',
    height: '6px',
    backgroundColor: '#222225',
    borderRadius: '3px',
    outline: 'none'
  },
  rangeLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '10px',
    color: '#8e8e93',
    marginTop: '4px'
  },
  textarea: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#0e0e11',
    border: '1px solid #2d2d30',
    borderRadius: '8px',
    color: '#ffffff',
    fontSize: '14px',
    outline: 'none',
    resize: 'none',
    boxSizing: 'border-box'
  },
  select: {
    width: '100%',
    padding: '11px',
    backgroundColor: '#0e0e11',
    border: '1px solid #2d2d30',
    borderRadius: '8px',
    color: '#ffffff',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box'
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px'
  },
  submitBtn: {
    padding: '12px',
    backgroundColor: '#34c759',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    marginTop: '6px'
  },
  successBlock: {
    textAlign: 'center',
    padding: '30px 10px'
  },
  successIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '24px',
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    color: '#34c759',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    fontWeight: 'bold',
    margin: '0 auto 16px auto'
  },
  successTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#34c759',
    margin: '0 0 8px 0'
  },
  successText: {
    fontSize: '13px',
    color: '#8e8e93',
    margin: 0
  }
};
