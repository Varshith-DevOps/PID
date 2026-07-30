'use client';

import React, { useState, useEffect } from 'react';
import { Button, Modal } from '@/components/ui';
import { useToast } from '@/lib/toastContext';

interface EmployeeItem {
  id: string;
  reviewId: string;
  name: string;
  title: string;
  department: string;
  performanceRating: number;
  potentialRating: number;
  overrideBoxPlacement?: number | null;
  reviewNotes?: string | null;
}

interface GridBox {
  boxNumber: number;
  employees: EmployeeItem[];
}

export default function Talent9BoxGrid() {
  const [grid, setGrid] = useState<GridBox[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedEmp, setSelectedEmp] = useState<EmployeeItem | null>(null);
  const [overridePlacement, setOverridePlacement] = useState<string>('0');
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const { showToast } = useToast();

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/appraisals/9box-analytics');
      if (res.ok) {
        const data = await res.json();
        setGrid(data.grid);
      }
    } catch (err) {
      console.error('Failed to load 9-box analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenOverrideModal = (emp: EmployeeItem) => {
    setSelectedEmp(emp);
    setOverridePlacement(String(emp.overrideBoxPlacement || '0'));
    setReviewNotes(emp.reviewNotes || '');
  };

  const handleSaveOverride = async () => {
    if (!selectedEmp) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/appraisals/9box-override/${selectedEmp.reviewId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overrideBoxPlacement: overridePlacement === '0' ? null : Number(overridePlacement),
          reviewNotes: reviewNotes || null
        })
      });
      if (res.ok) {
        showToast('Grid position override updated successfully.', 'success');
        setSelectedEmp(null);
        fetchAnalytics();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to save override.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to connect to database.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const getBoxInfo = (boxNum: number) => {
    switch (boxNum) {
      case 9: return { title: 'Star / Future Leader', desc: 'Top Performer, High Potential', color: 'rgba(52, 199, 89, 0.15)', border: '#34c759' };
      case 8: return { title: 'Star Performer', desc: 'Top Performer, Med Potential', color: 'rgba(52, 199, 89, 0.08)', border: 'rgba(52, 199, 89, 0.6)' };
      case 7: return { title: 'High Performer', desc: 'Top Performer, Low Potential', color: 'rgba(52, 199, 89, 0.04)', border: 'rgba(52, 199, 89, 0.3)' };
      case 6: return { title: 'High Flyer', desc: 'Core Performer, High Potential', color: 'rgba(10, 132, 255, 0.12)', border: '#0a84ff' };
      case 5: return { title: 'Core Player', desc: 'Core Performer, Med Potential', color: 'rgba(142, 142, 147, 0.08)', border: '#8e8e93' };
      case 4: return { title: 'Solid Performer', desc: 'Core Performer, Low Potential', color: 'rgba(142, 142, 147, 0.04)', border: 'rgba(142, 142, 147, 0.3)' };
      case 3: return { title: 'High Potential', desc: 'Low Performer, High Potential', color: 'rgba(255, 204, 0, 0.12)', border: '#ffcc00' };
      case 2: return { title: 'Inconsistent Player', desc: 'Low Performer, Med Potential', color: 'rgba(255, 204, 0, 0.06)', border: 'rgba(255, 204, 0, 0.5)' };
      case 1: return { title: 'Risk / Slide', desc: 'Low Performer, Low Potential', color: 'rgba(255, 69, 58, 0.12)', border: '#ff453a' };
      default: return { title: 'Unknown', desc: '', color: 'transparent', border: '#222' };
    }
  };

  const orderedBoxNumbers = [3, 6, 9, 2, 5, 8, 1, 4, 7];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>HR Talent 9-Box Matrix Grid</h3>
        <button onClick={fetchAnalytics} style={styles.refreshBtn}>Refresh Grid</button>
      </div>

      {loading ? (
        <p style={{ color: '#8e8e93' }}>Compiling grid analytics...</p>
      ) : (
        <div style={styles.layoutWrapper}>
          <div style={styles.yAxisLabels}>
            <span style={styles.axisLabel}>HIGH POTENTIAL</span>
            <span style={styles.axisLabel}>MED POTENTIAL</span>
            <span style={styles.axisLabel}>LOW POTENTIAL</span>
          </div>

          <div style={styles.mainGridArea}>
            <div style={styles.grid9Box}>
              {orderedBoxNumbers.map((num) => {
                const boxData = grid.find(b => b.boxNumber === num);
                const info = getBoxInfo(num);
                return (
                  <div 
                    key={num} 
                    style={{ 
                      ...styles.boxCard, 
                      backgroundColor: info.color, 
                      borderColor: info.border 
                    }}
                  >
                    <div style={styles.boxHeader}>
                      <span style={styles.boxNum}>{num}</span>
                      <h4 style={styles.boxTitle}>{info.title}</h4>
                    </div>
                    <span style={styles.boxDesc}>{info.desc}</span>
                    
                    <div style={styles.employeeList}>
                      {boxData?.employees && boxData.employees.length > 0 ? (
                        boxData.employees.map((emp) => (
                          <div
                            key={emp.id}
                            style={{ ...styles.empTag, cursor: 'pointer' }}
                            onClick={() => handleOpenOverrideModal(emp)}
                            title={emp.overrideBoxPlacement ? `HR Overridden: Box ${emp.overrideBoxPlacement}\nJustification: ${emp.reviewNotes || 'None'}` : 'Click to override grid placement'}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={styles.empName}>
                                {emp.name} {emp.overrideBoxPlacement ? ' 🔒' : ''}
                              </div>
                            </div>
                            <div style={styles.empSub}>{emp.title} | {emp.department}</div>
                          </div>
                        ))
                      ) : (
                        <span style={styles.emptyBox}>0 Employees</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={styles.xAxisLabels}>
              <span style={styles.axisLabel}>LOW PERFORMANCE</span>
              <span style={styles.axisLabel}>MET EXPECTATIONS</span>
              <span style={styles.axisLabel}>HIGH PERFORMANCE</span>
            </div>
          </div>
        </div>
      )}

      {selectedEmp && (
        <Modal
          open={!!selectedEmp}
          onClose={() => setSelectedEmp(null)}
          title={`Manual Override Grid Placement — ${selectedEmp.name}`}
          width={450}
          footer={
            <>
              <Button variant="ghost" onClick={() => setSelectedEmp(null)}>Cancel</Button>
              <Button variant="primary" loading={saving} onClick={handleSaveOverride}>Save Override</Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Calculated position: <strong>Box {selectedEmp.performanceRating + (selectedEmp.potentialRating - 1) * 3}</strong> (Perf: {selectedEmp.performanceRating}, Pot: {selectedEmp.potentialRating})
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>New Grid Position</label>
              <select
                className="select-field"
                value={overridePlacement}
                onChange={(e) => setOverridePlacement(e.target.value)}
                style={{ width: '100%', padding: '8px', backgroundColor: '#1d1d22', border: '1px solid #333', borderRadius: '6px', color: '#fff' }}
              >
                <option value="0">Automatic (Use potential & performance ratings)</option>
                <option value="1">1 - Risk / Slide (Low Performer, Low Potential)</option>
                <option value="2">2 - Inconsistent Player (Low Performer, Med Potential)</option>
                <option value="3">3 - High Potential (Low Performer, High Potential)</option>
                <option value="4">4 - Solid Performer (Core Performer, Low Potential)</option>
                <option value="5">5 - Core Player (Core Performer, Med Potential)</option>
                <option value="6">6 - High Flyer (Core Performer, High Potential)</option>
                <option value="7">7 - High Performer (Top Performer, Low Potential)</option>
                <option value="8">8 - Star Performer (Top Performer, Med Potential)</option>
                <option value="9">9 - Star / Future Leader (Top Performer, High Potential)</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>HR Override Justification / Notes</label>
              <textarea
                className="input-field"
                placeholder="Enter justification for modifying this employee's placement on the 9-box matrix..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                style={{ minHeight: '100px', padding: '8px', backgroundColor: '#1d1d22', border: '1px solid #333', borderRadius: '6px', color: '#fff', resize: 'vertical' }}
              />
            </div>
          </div>
        </Modal>
      )}
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
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    borderBottom: '1px solid #222225',
    paddingBottom: '14px'
  },
  title: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#ffffff',
    margin: 0
  },
  refreshBtn: {
    padding: '6px 12px',
    backgroundColor: '#222225',
    border: '1px solid #2d2d30',
    borderRadius: '6px',
    color: '#f5f5f7',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  layoutWrapper: {
    display: 'flex',
    gap: '16px',
    alignItems: 'stretch'
  },
  yAxisLabels: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '40px',
    textAlign: 'center',
    fontSize: '10px',
    fontWeight: '700',
    color: '#8e8e93',
    writingMode: 'vertical-lr',
    transform: 'rotate(180deg)'
  },
  mainGridArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  grid9Box: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
    minHeight: '480px'
  },
  boxCard: {
    border: '1px solid',
    borderRadius: '8px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: '140px',
    transition: 'transform 0.2s'
  },
  boxHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  boxNum: {
    fontSize: '10px',
    fontWeight: '800',
    color: '#ffffff',
    backgroundColor: 'rgba(255,255,255,0.1)',
    width: '16px',
    height: '16px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  boxTitle: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#ffffff',
    margin: 0
  },
  boxDesc: {
    fontSize: '9px',
    color: '#8e8e93',
    marginTop: '2px',
    display: 'block'
  },
  employeeList: {
    marginTop: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    flex: 1,
    justifyContent: 'center'
  },
  empTag: {
    backgroundColor: '#0e0e11',
    border: '1px solid #222225',
    borderRadius: '4px',
    padding: '6px 8px'
  },
  empName: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#ffffff'
  },
  empSub: {
    fontSize: '9px',
    color: '#8e8e93',
    marginTop: '1px'
  },
  emptyBox: {
    fontSize: '11px',
    color: '#8e8e93',
    textAlign: 'center',
    fontStyle: 'italic'
  },
  xAxisLabels: {
    display: 'flex',
    justifyContent: 'space-around',
    fontSize: '10px',
    fontWeight: '700',
    color: '#8e8e93',
    paddingTop: '8px',
    borderTop: '1px solid #222225'
  },
  axisLabel: {
    letterSpacing: '1px'
  }
};
