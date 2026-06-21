'use client';

/**
 * @fileoverview Forced password change gate.
 * When the authenticated user has `mustChangePassword` set (provisioned account
 * with a temporary password, or an admin-reset account), this overlay blocks the
 * rest of the app until they set a new password. The server independently flags
 * the account; this enforces it in the UI.
 * @module components/ForcePasswordChange
 */

import { useState } from 'react';
import { useAuth } from '@/lib/authContext';
import { changePassword } from '@/lib/api';

const meetsPolicy = (pw: string): boolean =>
  pw.length >= 12 &&
  /[A-Z]/.test(pw) &&
  /[a-z]/.test(pw) &&
  /[0-9]/.test(pw) &&
  /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(pw);

export default function ForcePasswordChange() {
  const { user, markPasswordChanged } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!user || !user.mustChangePassword) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (next !== confirm) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (!meetsPolicy(next)) {
      setError('Password must be at least 12 characters and include an uppercase letter, a lowercase letter, a digit, and a special character.');
      return;
    }
    if (next === current) {
      setError('New password must be different from the temporary password.');
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(current, next);
      markPasswordChanged();
    } catch {
      setError('Could not change password. Check that the temporary password is correct.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 16,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: 28,
          width: '100%',
          maxWidth: 420,
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
        }}
      >
        <h2 style={{ margin: '0 0 6px', fontSize: 20, color: '#182B6D' }}>Set a new password</h2>
        <p style={{ margin: '0 0 18px', fontSize: 14, color: '#475569' }}>
          For security, you must replace your temporary password before continuing.
        </p>

        <label style={{ display: 'block', fontSize: 13, color: '#334155', marginBottom: 12 }}>
          Current (temporary) password
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            required
            style={inputStyle}
          />
        </label>
        <label style={{ display: 'block', fontSize: 13, color: '#334155', marginBottom: 12 }}>
          New password
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            required
            style={inputStyle}
          />
        </label>
        <label style={{ display: 'block', fontSize: 13, color: '#334155', marginBottom: 12 }}>
          Confirm new password
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
            style={inputStyle}
          />
        </label>

        {error && (
          <p style={{ color: '#b91c1c', fontSize: 13, margin: '0 0 12px' }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: '100%',
            padding: '11px 16px',
            background: submitting ? '#94a3b8' : '#182B6D',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 15,
            cursor: submitting ? 'default' : 'pointer',
          }}
        >
          {submitting ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 6,
  padding: '9px 11px',
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  fontSize: 14,
  boxSizing: 'border-box',
};
