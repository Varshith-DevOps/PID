'use client';

import React, { useState, useEffect } from 'react';

interface Survey {
  id: string;
  title: string;
  description: string;
}

export default function PulseSurveyWidget() {
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [score, setScore] = useState<number>(0);
  const [feedback, setFeedback] = useState<string>('');
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    fetchActiveSurvey();
  }, []);

  const fetchActiveSurvey = async () => {
    try {
      const res = await fetch('/api/pulse/active');
      if (res.ok) {
        const data = await res.json();
        setSurvey(data);
      }
    } catch (err) {
      console.error('Failed to load active pulse survey:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!survey || score === 0) return;

    setLoading(true);
    try {
      const res = await fetch('/api/pulse/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surveyId: survey.id,
          score,
          feedback
        })
      });
      if (res.ok) {
        setSubmitted(true);
      }
    } catch (err) {
      console.error('Failed to submit response:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!survey) return null;

  if (submitted) {
    return (
      <div style={styles.container}>
        <div style={styles.successWrapper}>
          <div style={styles.successIcon}>🎉</div>
          <h4 style={styles.successTitle}>Morale Response Recorded!</h4>
          <p style={styles.successText}>Thank you for sharing your feedback anonymously. Your voice helps us maintain a supportive workspace.</p>
        </div>
      </div>
    );
  }

  const smilies = [
    { rating: 1, char: '😞', label: 'Stressed' },
    { rating: 2, char: '😐', label: 'Meh' },
    { rating: 3, char: '🙂', label: 'Okay' },
    { rating: 4, char: '😊', label: 'Good' },
    { rating: 5, char: '😁', label: 'Excellent' }
  ];

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>{survey.title}</h3>
      <p style={styles.description}>{survey.description || 'Share your anonymous feedback with HR.'}</p>
      
      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label}>How is your mood today?</label>
        
        <div style={styles.smiliesContainer}>
          {smilies.map((s) => (
            <button
              key={s.rating}
              type="button"
              onClick={() => setScore(s.rating)}
              style={{
                ...styles.smileyBtn,
                ...(score === s.rating ? styles.smileyBtnActive : {})
              }}
            >
              <span style={styles.smileyChar}>{s.char}</span>
              <span style={styles.smileyLabel}>{s.label}</span>
            </button>
          ))}
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Optional Comments (Anonymous)</label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            style={styles.textarea}
            placeholder="Tell us what's working or what needs focus..."
            rows={3}
          />
        </div>

        <button
          type="submit"
          disabled={score === 0 || loading}
          style={{
            ...styles.submitBtn,
            ...(score === 0 ? styles.submitBtnDisabled : {})
          }}
        >
          {loading ? 'Submitting...' : 'Submit Anonymously'}
        </button>
      </form>
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
    boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
    marginBottom: '20px'
  },
  title: {
    fontSize: '18px',
    fontWeight: '600',
    margin: '0 0 8px 0',
    color: '#ffffff'
  },
  description: {
    fontSize: '13px',
    color: '#8e8e93',
    margin: '0 0 20px 0',
    lineHeight: '1.4'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  label: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#8e8e93',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  smiliesContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '8px',
    margin: '8px 0'
  },
  smileyBtn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '12px 8px',
    backgroundColor: '#0e0e11',
    border: '1px solid #222225',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out'
  },
  smileyBtnActive: {
    border: '2px solid #34c759',
    backgroundColor: 'rgba(52, 199, 89, 0.08)',
    transform: 'scale(1.05)'
  },
  smileyChar: {
    fontSize: '28px',
    marginBottom: '4px'
  },
  smileyLabel: {
    fontSize: '10px',
    color: '#8e8e93',
    fontWeight: '500'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
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
  submitBtn: {
    padding: '12px',
    backgroundColor: '#34c759',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  submitBtnDisabled: {
    backgroundColor: '#3a3a3c',
    color: '#8e8e93',
    cursor: 'not-allowed'
  },
  successWrapper: {
    textAlign: 'center',
    padding: '12px 0'
  },
  successIcon: {
    fontSize: '48px',
    marginBottom: '16px'
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
    margin: 0,
    lineHeight: '1.5'
  }
};
