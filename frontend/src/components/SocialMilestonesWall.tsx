'use client';

import React, { useState, useEffect } from 'react';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
}

interface KudosLog {
  id: string;
  sender: { firstName: string; lastName: string };
  receiver: { firstName: string; lastName: string };
  points: number;
  message: string;
  createdAt: string;
}

interface WallResponse {
  wall: KudosLog[];
  allowance: number;
  balance: number;
}

export default function SocialMilestonesWall() {
  const [wallData, setWallData] = useState<WallResponse | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [receiverId, setReceiverId] = useState<string>('');
  const [points, setPoints] = useState<number>(10);
  const [message, setMessage] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    fetchWall();
    fetchEmployees();
  }, []);

  const fetchWall = async () => {
    try {
      const res = await fetch('/api/kudos/wall');
      if (res.ok) {
        const data = await res.json();
        setWallData({
          ...data,
          wall: Array.isArray(data?.wall) ? data.wall : [],
        });
      }
    } catch (err) {
      console.error('Failed to load kudos wall:', err);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/kudos/colleagues');
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : (Array.isArray(data?.employees) ? data.employees : []));
        setEmployees(list);
      }
    } catch (err) {
      console.error('Failed to load employee list:', err);
    }
  };

  const filteredEmployees = (Array.isArray(employees) ? employees : []).filter((emp) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const name = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
    const title = (emp.jobTitle || '').toLowerCase();
    return name.includes(term) || title.includes(term);
  });

  const handleSendKudos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiverId || points <= 0 || !message.trim()) return;

    setSubmitting(true);
    setStatusMsg(null);

    try {
      const res = await fetch('/api/kudos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId, points, message })
      });
      const data = await res.json();

      if (res.ok) {
        setStatusMsg({ text: `Success! Sent ${points} kudos coins.`, error: false });
        setReceiverId('');
        setMessage('');
        fetchWall(); // Refresh balance/allowance and feed
      } else {
        setStatusMsg({ text: data.error || 'Failed to send kudos.', error: true });
      }
    } catch (err) {
      setStatusMsg({ text: 'Server communication failed.', error: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerInfo}>
          <h2 style={styles.title}>Social & Kudos Wall</h2>
          <p style={styles.subtitle}>Celebrate colleague achievements and share recognition</p>
        </div>
        {wallData && (
          <div style={styles.statsRow}>
            <div style={styles.statBox}>
              <span style={styles.statLabel}>Available Balance</span>
              <span style={{ ...styles.statVal, color: '#34c759' }}>{wallData.balance} ⭐</span>
            </div>
            <div style={styles.statBox}>
              <span style={styles.statLabel}>Allowance left</span>
              <span style={{ ...styles.statVal, color: '#0a84ff' }}>{wallData.allowance} / 100</span>
            </div>
          </div>
        )}
      </div>

      <div style={styles.grid}>
        {/* Kudos Timeline */}
        <div style={styles.mainFeed}>
          <h3 style={styles.sectionTitle}>Recent Recognition Feed</h3>
          
          <div style={styles.feedList}>
            {wallData?.wall && wallData.wall.length > 0 ? (
              wallData.wall.map((kudos) => (
                <div key={kudos.id} style={styles.kudosCard}>
                  <div style={styles.kudosHeader}>
                    <span style={styles.kudosNames}>
                      <strong>{kudos.sender.firstName} {kudos.sender.lastName}</strong>
                      <span style={{ color: '#8e8e93', margin: '0 6px' }}>sent kudos to</span>
                      <strong>{kudos.receiver.firstName} {kudos.receiver.lastName}</strong>
                    </span>
                    <span style={styles.kudosPoints}>+{kudos.points} pts</span>
                  </div>
                  <p style={styles.kudosMsg}>“ {kudos.message} ”</p>
                  <span style={styles.kudosDate}>
                    {new Date(kudos.createdAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              ))
            ) : (
              <div style={styles.emptyFeed}>
                <span style={styles.emptyIcon}>✨</span>
                <p style={styles.emptyText}>Be the first to recognize a colleague's outstanding effort this month!</p>
              </div>
            )}
          </div>
        </div>

        {/* Send Kudos Panel */}
        <div style={styles.sendPanel}>
          <h3 style={styles.sectionTitle}>Appreciate a Colleague</h3>
          
          <form onSubmit={handleSendKudos} style={styles.form}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Select Colleague</label>
              <input
                type="text"
                placeholder="Search colleague by name or title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ ...styles.input, marginBottom: '8px' }}
              />
              <select
                value={receiverId}
                onChange={(e) => setReceiverId(e.target.value)}
                style={styles.select}
                required
              >
                <option value="">Choose employee ({filteredEmployees.length} available)...</option>
                {filteredEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName} {emp.jobTitle ? `(${emp.jobTitle})` : ''}
                  </option>
                ))}
              </select>
            </div>


            <div style={styles.formGroup}>
              <label style={styles.label}>Points to Give</label>
              <input
                type="number"
                min="1"
                max={wallData?.allowance || 100}
                value={points}
                onChange={(e) => setPoints(Number(e.target.value))}
                style={styles.input}
                required
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Message / Reason</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Why are you recognizing them?"
                style={styles.textarea}
                rows={3}
                required
              />
            </div>

            {statusMsg && (
              <div style={{
                ...styles.statusBanner,
                backgroundColor: statusMsg.error ? 'rgba(255, 69, 58, 0.12)' : 'rgba(52, 199, 89, 0.12)',
                color: statusMsg.error ? '#ff453a' : '#34c759',
                border: statusMsg.error ? '1px solid rgba(255, 69, 58, 0.3)' : '1px solid rgba(52, 199, 89, 0.3)'
              }}>
                {statusMsg.text}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !receiverId || points <= 0}
              style={{
                ...styles.submitBtn,
                ...((submitting || !receiverId || points <= 0) ? styles.submitBtnDisabled : {})
              }}
            >
              {submitting ? 'Sending...' : 'Send Kudos Coins'}
            </button>
          </form>
        </div>
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
    marginTop: '24px'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '16px',
    borderBottom: '1px solid #222225',
    paddingBottom: '20px',
    marginBottom: '20px'
  },
  headerInfo: {
    flex: 1
  },
  title: {
    fontSize: '22px',
    fontWeight: '700',
    margin: 0,
    color: '#ffffff'
  },
  subtitle: {
    fontSize: '13px',
    color: '#8e8e93',
    margin: '4px 0 0 0'
  },
  statsRow: {
    display: 'flex',
    gap: '12px'
  },
  statBox: {
    backgroundColor: '#0e0e11',
    border: '1px solid #222225',
    borderRadius: '8px',
    padding: '10px 16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minWidth: '100px'
  },
  statLabel: {
    fontSize: '10px',
    color: '#8e8e93',
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: '4px'
  },
  statVal: {
    fontSize: '15px',
    fontWeight: '700'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 0.8fr',
    gap: '24px',
    alignItems: 'start'
  },
  mainFeed: {
    display: 'flex',
    flexDirection: 'column'
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 0,
    marginBottom: '16px'
  },
  feedList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    maxHeight: '400px',
    overflowY: 'auto',
    paddingRight: '4px'
  },
  kudosCard: {
    backgroundColor: '#0e0e11',
    border: '1px solid #222225',
    borderRadius: '8px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  kudosHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  kudosNames: {
    fontSize: '13px',
    color: '#ffffff'
  },
  kudosPoints: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#34c759',
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    padding: '4px 8px',
    borderRadius: '12px'
  },
  kudosMsg: {
    fontSize: '13px',
    color: '#d1d1d6',
    margin: '4px 0',
    lineHeight: '1.4',
    fontStyle: 'italic'
  },
  kudosDate: {
    fontSize: '10px',
    color: '#8e8e93'
  },
  emptyFeed: {
    textAlign: 'center',
    padding: '40px 20px',
    backgroundColor: '#0e0e11',
    border: '1px dashed #2d2d30',
    borderRadius: '8px'
  },
  emptyIcon: {
    fontSize: '36px',
    display: 'block',
    marginBottom: '12px'
  },
  emptyText: {
    fontSize: '13px',
    color: '#8e8e93',
    margin: 0
  },
  sendPanel: {
    backgroundColor: '#0e0e11',
    border: '1px solid #222225',
    borderRadius: '8px',
    padding: '20px'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px'
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
    textTransform: 'uppercase'
  },
  select: {
    padding: '10px',
    backgroundColor: '#151518',
    border: '1px solid #2d2d30',
    borderRadius: '6px',
    color: '#ffffff',
    fontSize: '13px',
    outline: 'none'
  },
  input: {
    padding: '10px',
    backgroundColor: '#151518',
    border: '1px solid #2d2d30',
    borderRadius: '6px',
    color: '#ffffff',
    fontSize: '13px',
    outline: 'none'
  },
  textarea: {
    padding: '10px',
    backgroundColor: '#151518',
    border: '1px solid #2d2d30',
    borderRadius: '6px',
    color: '#ffffff',
    fontSize: '13px',
    outline: 'none',
    resize: 'none',
    boxSizing: 'border-box'
  },
  submitBtn: {
    padding: '12px',
    backgroundColor: '#0a84ff',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  submitBtnDisabled: {
    backgroundColor: '#3a3a3c',
    color: '#8e8e93',
    cursor: 'not-allowed'
  },
  statusBanner: {
    padding: '10px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '500',
    textAlign: 'center'
  }
};
