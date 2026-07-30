'use client';

import React, { useState, useEffect } from 'react';

interface KeyResult {
  id: string;
  title: string;
  description: string;
  startValue: number;
  targetValue: number;
  currentValue: number;
  unit: string;
  weight: number;
}

interface Objective {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  progress: number;
  parentId: string | null;
  keyResults: KeyResult[];
  parent?: { id: string; title: string } | null;
}

export default function OkrDashboard() {
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // New Objective Form State
  const [newTitle, setNewTitle] = useState<string>('');
  const [newDesc, setNewDesc] = useState<string>('');
  const [newStart, setNewStart] = useState<string>('');
  const [newEnd, setNewEnd] = useState<string>('');
  const [newParentId, setNewParentId] = useState<string>('');

  // New Key Result Form State
  const [krObjectiveId, setKrObjectiveId] = useState<string>('');
  const [krTitle, setKrTitle] = useState<string>('');
  const [krDesc, setKrDesc] = useState<string>('');
  const [krStart, setKrStart] = useState<number>(0);
  const [krTarget, setKrTarget] = useState<number>(100);
  const [krUnit, setKrUnit] = useState<string>('%');
  const [krWeight, setKrWeight] = useState<number>(1);

  // Update Key Result State
  const [editingKrId, setEditingKrId] = useState<string>('');
  const [editValue, setEditValue] = useState<number>(0);

  useEffect(() => {
    fetchOkrs();
  }, []);

  const fetchOkrs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/okrs/employee');
      if (res.ok) {
        const data = await res.json();
        setObjectives(data);
      }
    } catch (err) {
      console.error('Failed to load OKRs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateObjective = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newStart || !newEnd) return;

    try {
      const res = await fetch('/api/okrs/objectives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          description: newDesc,
          startDate: newStart,
          endDate: newEnd,
          parentId: newParentId || null
        })
      });
      if (res.ok) {
        setNewTitle('');
        setNewDesc('');
        setNewStart('');
        setNewEnd('');
        setNewParentId('');
        fetchOkrs();
      }
    } catch (err) {
      console.error('Failed to create objective:', err);
    }
  };

  const handleAddKeyResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!krObjectiveId || !krTitle || krTarget === undefined) return;

    try {
      const res = await fetch('/api/okrs/key-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objectiveId: krObjectiveId,
          title: krTitle,
          description: krDesc,
          startValue: krStart,
          targetValue: krTarget,
          currentValue: krStart,
          unit: krUnit,
          weight: krWeight
        })
      });
      if (res.ok) {
        setKrTitle('');
        setKrDesc('');
        setKrStart(0);
        setKrTarget(100);
        setKrUnit('%');
        setKrWeight(1);
        setKrObjectiveId('');
        fetchOkrs();
      }
    } catch (err) {
      console.error('Failed to add key result:', err);
    }
  };

  const handleUpdateKr = async (krId: string) => {
    try {
      const res = await fetch(`/api/okrs/key-results/${krId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentValue: editValue })
      });
      if (res.ok) {
        setEditingKrId('');
        fetchOkrs();
      }
    } catch (err) {
      console.error('Failed to update key result:', err);
    }
  };

  const getProgressColor = (prog: number) => {
    if (prog >= 70) return '#34c759'; // Success green
    if (prog >= 40) return '#ffcc00'; // Warning yellow
    return '#ff453a'; // Danger red
  };

  return (
    <div style={styles.container}>
      <div style={styles.grid}>
        {/* Objectives List */}
        <div style={styles.listSection}>
          <h3 style={styles.sectionTitle}>Objectives & Key Results</h3>
          {loading ? (
            <p style={{ color: '#8e8e93' }}>Loading goals...</p>
          ) : objectives.length === 0 ? (
            <div style={styles.empty}>No OKRs logged for this period. Create one below to begin.</div>
          ) : (
            <div style={styles.okrList}>
              {objectives.map((obj) => (
                <div key={obj.id} style={styles.objCard}>
                  <div style={styles.objHeader}>
                    <div>
                      <h4 style={styles.objTitle}>{obj.title}</h4>
                      {obj.description && <p style={styles.objDesc}>{obj.description}</p>}
                      {obj.parent && <span style={styles.parentBadge}>Aligned with: {obj.parent.title}</span>}
                    </div>
                    <div style={styles.progressSection}>
                      <span style={{ ...styles.progressPct, color: getProgressColor(obj.progress) }}>
                        {obj.progress.toFixed(0)}%
                      </span>
                      <div style={styles.meterContainer}>
                        <div 
                          style={{ 
                            ...styles.meterFill, 
                            width: `${obj.progress}%`,
                            backgroundColor: getProgressColor(obj.progress)
                          }} 
                        />
                      </div>
                    </div>
                  </div>

                  <div style={styles.krSection}>
                    <h5 style={styles.krSectionTitle}>Key Results</h5>
                    {obj.keyResults.length === 0 ? (
                      <p style={{ ...styles.emptyKr, margin: 0 }}>No Key Results registered.</p>
                    ) : (
                      <div style={styles.krList}>
                        {obj.keyResults.map((kr) => (
                          <div key={kr.id} style={styles.krCard}>
                            <div style={styles.krMain}>
                              <div>
                                <h6 style={styles.krTitle}>{kr.title}</h6>
                                {kr.description && <p style={styles.krDesc}>{kr.description}</p>}
                                <span style={styles.krMeta}>Weight: {kr.weight} | Target: {kr.targetValue} {kr.unit}</span>
                              </div>
                              <div style={styles.krStatus}>
                                {editingKrId === kr.id ? (
                                  <div style={styles.editRow}>
                                    <input 
                                      type="number" 
                                      value={editValue} 
                                      onChange={(e) => setEditValue(Number(e.target.value))} 
                                      style={styles.inlineInput}
                                    />
                                    <button onClick={() => handleUpdateKr(kr.id)} style={styles.saveBtn}>Save</button>
                                    <button onClick={() => setEditingKrId('')} style={styles.cancelBtn}>Cancel</button>
                                  </div>
                                ) : (
                                  <>
                                    <span style={styles.krValue}>
                                      {kr.currentValue} / {kr.targetValue} {kr.unit}
                                    </span>
                                    <button 
                                      onClick={() => {
                                        setEditingKrId(kr.id);
                                        setEditValue(kr.currentValue);
                                      }} 
                                      style={styles.updateBtn}
                                    >
                                      Update
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Creation panel */}
        <div style={styles.formSection}>
          {/* Create Objective */}
          <div style={styles.formCard}>
            <h3 style={styles.formTitle}>New Objective</h3>
            <form onSubmit={handleCreateObjective} style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Objective Title</label>
                <input 
                  type="text" 
                  value={newTitle} 
                  onChange={(e) => setNewTitle(e.target.value)} 
                  style={styles.input} 
                  placeholder="e.g. Expand Cloud Infrastructure"
                  required 
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Description</label>
                <textarea 
                  value={newDesc} 
                  onChange={(e) => setNewDesc(e.target.value)} 
                  style={styles.textarea} 
                  placeholder="Supporting details..." 
                  rows={2} 
                />
              </div>
              <div style={styles.dateRow}>
                <div style={{ ...styles.formGroup, flex: 1 }}>
                  <label style={styles.label}>Start Date</label>
                  <input type="date" value={newStart} onChange={(e) => setNewStart(e.target.value)} style={styles.input} required />
                </div>
                <div style={{ ...styles.formGroup, flex: 1 }}>
                  <label style={styles.label}>End Date</label>
                  <input type="date" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} style={styles.input} required />
                </div>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Aligned Parent Objective</label>
                <select value={newParentId} onChange={(e) => setNewParentId(e.target.value)} style={styles.select}>
                  <option value="">None (Top-Level)</option>
                  {objectives.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}
                </select>
              </div>
              <button type="submit" style={styles.submitBtn}>Create Objective</button>
            </form>
          </div>

          {/* Add Key Result */}
          {objectives.length > 0 && (
            <div style={{ ...styles.formCard, marginTop: '20px' }}>
              <h3 style={styles.formTitle}>Add Key Result</h3>
              <form onSubmit={handleAddKeyResult} style={styles.form}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Target Objective</label>
                  <select value={krObjectiveId} onChange={(e) => setKrObjectiveId(e.target.value)} style={styles.select} required>
                    <option value="">Select objective...</option>
                    {objectives.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>KR Title</label>
                  <input 
                    type="text" 
                    value={krTitle} 
                    onChange={(e) => setKrTitle(e.target.value)} 
                    style={styles.input} 
                    placeholder="e.g. Decrease page load times by 30%"
                    required 
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Description</label>
                  <textarea value={krDesc} onChange={(e) => setKrDesc(e.target.value)} style={styles.textarea} placeholder="Metric detail..." rows={2} />
                </div>
                <div style={styles.dateRow}>
                  <div style={{ ...styles.formGroup, flex: 1 }}>
                    <label style={styles.label}>Start Val</label>
                    <input type="number" value={krStart} onChange={(e) => setKrStart(Number(e.target.value))} style={styles.input} required />
                  </div>
                  <div style={{ ...styles.formGroup, flex: 1 }}>
                    <label style={styles.label}>Target Val</label>
                    <input type="number" value={krTarget} onChange={(e) => setKrTarget(Number(e.target.value))} style={styles.input} required />
                  </div>
                </div>
                <div style={styles.dateRow}>
                  <div style={{ ...styles.formGroup, flex: 1 }}>
                    <label style={styles.label}>Unit</label>
                    <input type="text" value={krUnit} onChange={(e) => setKrUnit(e.target.value)} style={styles.input} placeholder="e.g. % or ms" required />
                  </div>
                  <div style={{ ...styles.formGroup, flex: 1 }}>
                    <label style={styles.label}>Weight</label>
                    <input type="number" value={krWeight} onChange={(e) => setKrWeight(Number(e.target.value))} style={styles.input} required />
                  </div>
                </div>
                <button type="submit" style={styles.submitBtn}>Add Key Result</button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#0a0a0c',
    color: '#f5f5f7',
    fontFamily: 'Inter, system-ui, sans-serif'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 0.8fr',
    gap: '24px',
    alignItems: 'start'
  },
  listSection: {
    display: 'flex',
    flexDirection: 'column'
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 0,
    marginBottom: '16px'
  },
  empty: {
    backgroundColor: '#151518',
    border: '1px dashed #2d2d30',
    borderRadius: '12px',
    padding: '40px',
    textAlign: 'center',
    color: '#8e8e93',
    fontSize: '14px'
  },
  okrList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  objCard: {
    backgroundColor: '#151518',
    border: '1px solid #222225',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
  },
  objHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottom: '1px solid #222225',
    paddingBottom: '16px',
    marginBottom: '16px'
  },
  objTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#ffffff',
    margin: 0
  },
  objDesc: {
    fontSize: '13px',
    color: '#8e8e93',
    margin: '4px 0 8px 0',
    lineHeight: '1.4'
  },
  parentBadge: {
    fontSize: '11px',
    color: '#0a84ff',
    backgroundColor: 'rgba(10, 132, 255, 0.1)',
    padding: '4px 8px',
    borderRadius: '12px',
    fontWeight: '500'
  },
  progressSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    minWidth: '100px'
  },
  progressPct: {
    fontSize: '18px',
    fontWeight: '800',
    marginBottom: '4px'
  },
  meterContainer: {
    width: '100px',
    height: '6px',
    backgroundColor: '#222225',
    borderRadius: '3px',
    overflow: 'hidden'
  },
  meterFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.4s ease-out'
  },
  krSection: {
    display: 'flex',
    flexDirection: 'column'
  },
  krSectionTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#34c759',
    margin: '0 0 12px 0',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  emptyKr: {
    fontSize: '12px',
    color: '#8e8e93',
    fontStyle: 'italic'
  },
  krList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  krCard: {
    backgroundColor: '#0e0e11',
    border: '1px solid #222225',
    borderRadius: '8px',
    padding: '12px 16px'
  },
  krMain: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px'
  },
  krTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#ffffff',
    margin: 0
  },
  krDesc: {
    fontSize: '12px',
    color: '#8e8e93',
    margin: '2px 0 4px 0'
  },
  krMeta: {
    fontSize: '10px',
    color: '#8e8e93'
  },
  krStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  krValue: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#ffffff'
  },
  updateBtn: {
    padding: '6px 12px',
    backgroundColor: '#222225',
    border: '1px solid #2d2d30',
    borderRadius: '6px',
    color: '#f5f5f7',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  editRow: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center'
  },
  inlineInput: {
    width: '60px',
    padding: '4px',
    backgroundColor: '#151518',
    border: '1px solid #2d2d30',
    borderRadius: '4px',
    color: '#ffffff',
    fontSize: '12px',
    outline: 'none'
  },
  saveBtn: {
    padding: '4px 8px',
    backgroundColor: '#34c759',
    border: 'none',
    borderRadius: '4px',
    color: '#ffffff',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  cancelBtn: {
    padding: '4px 8px',
    backgroundColor: '#8e8e93',
    border: 'none',
    borderRadius: '4px',
    color: '#ffffff',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  formSection: {
    display: 'flex',
    flexDirection: 'column'
  },
  formCard: {
    backgroundColor: '#151518',
    border: '1px solid #222225',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 4px 15px rgba(0,0,0,0.15)'
  },
  formTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 0,
    marginBottom: '16px',
    borderBottom: '1px solid #222225',
    paddingBottom: '8px'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  label: {
    fontSize: '10px',
    fontWeight: '600',
    color: '#8e8e93',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  input: {
    width: '100%',
    padding: '10px',
    backgroundColor: '#0e0e11',
    border: '1px solid #2d2d30',
    borderRadius: '6px',
    color: '#ffffff',
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box'
  },
  textarea: {
    width: '100%',
    padding: '10px',
    backgroundColor: '#0e0e11',
    border: '1px solid #2d2d30',
    borderRadius: '6px',
    color: '#ffffff',
    fontSize: '13px',
    outline: 'none',
    resize: 'none',
    boxSizing: 'border-box'
  },
  dateRow: {
    display: 'flex',
    gap: '10px'
  },
  select: {
    width: '100%',
    padding: '10px',
    backgroundColor: '#0e0e11',
    border: '1px solid #2d2d30',
    borderRadius: '6px',
    color: '#ffffff',
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box'
  },
  submitBtn: {
    padding: '10px',
    backgroundColor: '#0a84ff',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '6px',
    transition: 'background-color 0.2s'
  }
};
