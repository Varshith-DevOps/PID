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
import { Modal, Button, Banner } from '@/components/ui';

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
    <Modal open title="Set a new password" width={440}>
      <form onSubmit={handleSubmit}>
        <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          For security, you must replace your temporary password before continuing.
        </p>

        <div className="form-group">
          <label className="form-label">Current (temporary) password</label>
          <input className="input-field" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
        </div>
        <div className="form-group">
          <label className="form-label">New password</label>
          <input className="input-field" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required />
        </div>
        <div className="form-group">
          <label className="form-label">Confirm new password</label>
          <input className="input-field" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
        </div>

        {error && <div style={{ marginBottom: '1rem' }}><Banner tone="danger">{error}</Banner></div>}

        <Button type="submit" fullWidth loading={submitting}>Update password</Button>
      </form>
    </Modal>
  );
}
