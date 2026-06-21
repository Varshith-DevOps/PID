'use client';
import { useState } from 'react';
import type { Validator } from '@/lib/validators';
import { onlyDigits, onlyDecimal, upperAlnum, onlyAlpha } from '@/lib/validators';

type Restrict = 'digits' | 'decimal' | 'upperAlnum' | 'alpha';

function applyRestrict(value: string, restrict?: Restrict, maxLength?: number): string {
  switch (restrict) {
    case 'digits': return onlyDigits(value, maxLength);
    case 'decimal': return onlyDecimal(value);
    case 'upperAlnum': return upperAlnum(value, maxLength);
    case 'alpha': return onlyAlpha(value);
    default: return typeof maxLength === 'number' ? value.slice(0, maxLength) : value;
  }
}

const EyeIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const EyeOffIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
const PencilIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;

export function maskValue(val: string, type: 'phone'|'email'|'pan'|'aadhar'|'account'|'pf') {
  if (!val) return 'N/A';
  switch(type) {
    case 'phone': return val.length > 6 ? val.slice(0,4)+'xxxx'+val.slice(-4) : val;
    case 'email': { const [u,d] = val.split('@'); return u.slice(0,3)+'***@'+(d||''); }
    case 'pan': return val.length > 4 ? val.slice(0,5)+'****'+val.slice(-1) : val;
    case 'aadhar': return val.length > 4 ? 'xxxx xxxx '+val.slice(-4) : val;
    case 'account': return val.length > 4 ? 'x'.repeat(val.length-4)+val.slice(-4) : val;
    case 'pf': return val.length > 4 ? val.slice(0,4)+'****'+val.slice(-4) : val;
    default: return val;
  }
}

interface Props {
  label: string;
  value: string;
  fieldKey: string;
  canEdit: boolean;
  onSave: (key: string, val: string, reason?: string) => void;
  masked?: boolean;
  maskType?: 'phone'|'email'|'pan'|'aadhar'|'account'|'pf';
  type?: string;
  /** Plain-language validator; blocks save and shows an inline error when invalid. */
  validator?: Validator;
  /** Restrict characters while typing. */
  restrict?: Restrict;
  maxLength?: number;
}

export default function InlineField({ label, value, fieldKey, canEdit, onSave, masked, maskType, type='text', validator, restrict, maxLength }: Props) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(value || '');
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayVal = (!value || value === 'null') ? 'N/A' : (masked && !revealed && maskType ? maskValue(value, maskType) : value);

  if (editing) {
    return (
      <div className="info-field">
        <div className="info-field-label">{label}</div>
        <div className="info-field-value">
          <input
            className="inline-edit-input"
            type={type}
            value={editVal}
            maxLength={maxLength}
            onChange={e => {
              const next = applyRestrict(e.target.value, restrict, maxLength);
              setEditVal(next);
              if (error) setError(validator ? validator(next) : null);
            }}
            autoFocus
          />
          <div className="inline-edit-actions">
            <button className="inline-save-btn" onClick={() => {
              const validationError = validator ? validator(editVal) : null;
              if (validationError) { setError(validationError); return; }
              const reason = prompt('Reason for change:');
              if (reason === null) return; // User cancelled
              if (reason.trim() === '') { alert('A reason is required to make a change.'); return; }
              onSave(fieldKey, editVal, reason);
              setError(null);
              setEditing(false);
            }}>✓</button>
            <button className="inline-cancel-btn" onClick={() => { setEditVal(value||''); setError(null); setEditing(false); }}>✗</button>
          </div>
        </div>
        {error && <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: '#f87171' }}>{error}</div>}
      </div>
    );
  }

  return (
    <div className="info-field">
      <div className="info-field-label">{label}</div>
      <div className="info-field-value">
        <span className={masked && !revealed ? 'masked-value' : ''}>{displayVal}</span>
        {masked && value && (
          <button className="reveal-btn" onClick={() => setRevealed(!revealed)} title={revealed ? 'Hide' : 'Reveal'}>
            {revealed ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>
      {canEdit && (
        <div className="info-field-actions">
          <button className="edit-icon-btn" onClick={() => { setEditVal(value||''); setEditing(true); }}><PencilIcon /></button>
        </div>
      )}
    </div>
  );
}
