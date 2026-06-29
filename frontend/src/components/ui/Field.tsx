'use client';

import React from 'react';
import type { Validator } from '@/lib/validators';
import { ValidatedInput, ValidatedTextarea } from '@/components/ValidatedField';

export function Field({ label, help, error, required, htmlFor, children }: {
  label?: React.ReactNode;
  help?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="form-group">
      {label && (
        <label className="form-label" htmlFor={htmlFor}>
          {label} {required && <span style={{ color: 'var(--danger-fg)' }}>*</span>}
        </label>
      )}
      {children}
      {help && !error && <span style={{ display: 'block', marginTop: 4, fontSize: '0.72rem', color: 'var(--text-muted)' }}>{help}</span>}
      {error && <span style={{ display: 'block', marginTop: 4, fontSize: '0.72rem', color: 'var(--danger-fg)' }}>{error}</span>}
    </div>
  );
}

interface TextFieldProps {
  label?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  validator?: Validator;
  restrict?: 'digits' | 'decimal' | 'upperAlnum' | 'alpha';
  forceError?: boolean;
  required?: boolean;
  help?: React.ReactNode;
  placeholder?: string;
  type?: string;
  maxLength?: number;
  disabled?: boolean;
}

export function TextField({ label, value, onChange, validator, restrict, forceError, required, help, ...rest }: TextFieldProps) {
  return (
    <Field label={label} required={required} help={help}>
      <ValidatedInput
        className="input-field"
        value={value}
        onChange={onChange}
        validator={validator}
        restrict={restrict}
        forceError={forceError}
        {...rest}
      />
    </Field>
  );
}

export function NumberField(props: Omit<TextFieldProps, 'type' | 'restrict'> & { decimal?: boolean }) {
  const { decimal, ...rest } = props;
  return <TextField {...rest} restrict={decimal ? 'decimal' : 'digits'} />;
}

export function Textarea({ label, value, onChange, validator, forceError, required, help, ...rest }: TextFieldProps) {
  return (
    <Field label={label} required={required} help={help}>
      <ValidatedTextarea
        className="textarea-field"
        value={value}
        onChange={onChange}
        validator={validator}
        forceError={forceError}
        {...rest}
      />
    </Field>
  );
}

export function Select({ label, value, onChange, options, required, help, placeholder, disabled }: {
  label?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
  help?: React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <Field label={label} required={required} help={help}>
      <select className="select-field" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </Field>
  );
}

export function DateField({ label, value, onChange, required, help, disabled, min, max }: {
  label?: React.ReactNode; value: string; onChange: (v: string) => void;
  required?: boolean; help?: React.ReactNode; disabled?: boolean; min?: string; max?: string;
}) {
  return (
    <Field label={label} required={required} help={help}>
      <input className="input-field" type="date" value={value} min={min} max={max} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

export function TimeField({ label, value, onChange, required, help, disabled }: {
  label?: React.ReactNode; value: string; onChange: (v: string) => void;
  required?: boolean; help?: React.ReactNode; disabled?: boolean;
}) {
  return (
    <Field label={label} required={required} help={help}>
      <input className="input-field" type="time" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

export function Checkbox({ label, checked, onChange, disabled }: {
  label: React.ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <label className="checkbox-label" style={{ opacity: disabled ? 0.6 : 1 }}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function Toggle({ label, checked, onChange, disabled }: {
  label?: React.ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        style={{
          width: 38, height: 22, borderRadius: 999, border: 'none', cursor: 'inherit',
          background: checked ? 'var(--accent)' : 'var(--surface-sunken)',
          position: 'relative', transition: 'background var(--motion-base) var(--ease-out)', flexShrink: 0,
        }}
      >
        <span style={{ position: 'absolute', top: 2, left: checked ? 18 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left var(--motion-base) var(--ease-spring)', boxShadow: 'var(--shadow-1)' }} />
      </button>
      {label}
    </label>
  );
}

export function ColorField({ label, value, onChange, onReset }: {
  label?: React.ReactNode; value: string; onChange: (v: string) => void; onReset?: () => void;
}) {
  return (
    <Field label={label}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: 44, height: 36, border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', background: 'transparent', cursor: 'pointer' }} />
        <span className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{value}</span>
        {onReset && <button type="button" onClick={onReset} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>Use default</button>}
      </div>
    </Field>
  );
}

export function FileDrop({ label, onFile, accept, hint }: {
  label?: React.ReactNode; onFile: (file: File) => void; accept?: string; hint?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const [name, setName] = React.useState<string>('');
  const pick = (f?: File | null) => { if (f) { setName(f.name); onFile(f); } };
  return (
    <Field label={label}>
      <div
        className={`doc-upload-zone ${dragging ? 'dragging' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files?.[0]); }}
        style={{ marginBottom: 0 }}
      >
        <input ref={inputRef} type="file" accept={accept} hidden onChange={(e) => pick(e.target.files?.[0])} />
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
          {name || 'Click or drag a file to upload'}
        </div>
        {hint && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>{hint}</div>}
      </div>
    </Field>
  );
}
