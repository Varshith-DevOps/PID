'use client';

/**
 * @fileoverview Drop-in validated input + textarea.
 *
 * These mirror native <input>/<textarea> but add:
 *  - live, plain-language validation (shown on blur, or forced on submit),
 *  - input restriction so wrong characters can't be typed (digits-only, etc.),
 *  - full style/className passthrough so they match each page's existing look.
 *
 * Usage:
 *   <ValidatedInput
 *     value={phone}
 *     onChange={setPhone}
 *     validator={v.mobile}
 *     restrict="digits"
 *     maxLength={10}
 *     forceError={submitted}
 *     style={inputStyle}
 *   />
 *
 * The parent still gates submission with validateForm(); pass `forceError`
 * (e.g. a `submitted` flag) to reveal any remaining errors at submit time.
 *
 * @module components/ValidatedField
 */

import React, { useState } from 'react';
import type { Validator } from '@/lib/validators';
import { onlyDigits, onlyDecimal, upperAlnum, onlyAlpha } from '@/lib/validators';

type Restrict = 'digits' | 'decimal' | 'upperAlnum' | 'alpha';

function applyRestrict(value: string, restrict: Restrict | undefined, maxLength?: number): string {
  switch (restrict) {
    case 'digits':
      return onlyDigits(value, maxLength);
    case 'decimal':
      return onlyDecimal(value);
    case 'upperAlnum':
      return upperAlnum(value, maxLength);
    case 'alpha':
      return onlyAlpha(value);
    default:
      return typeof maxLength === 'number' ? value.slice(0, maxLength) : value;
  }
}

const defaultErrorStyle: React.CSSProperties = {
  display: 'block',
  marginTop: '0.35rem',
  fontSize: '0.75rem',
  color: '#f87171',
  lineHeight: 1.3,
};

interface CommonProps {
  value: string;
  onChange: (value: string) => void;
  /** Returns a plain-language error string, or null when valid. */
  validator?: Validator;
  /** Restrict characters as the user types. */
  restrict?: Restrict;
  maxLength?: number;
  /** Force the error to show even before the field is touched (use on submit). */
  forceError?: boolean;
  /** Override the inline error message styling. */
  errorStyle?: React.CSSProperties;
}

type InputProps = CommonProps &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'maxLength'>;

export function ValidatedInput({
  value,
  onChange,
  validator,
  restrict,
  maxLength,
  forceError,
  errorStyle,
  onBlur,
  ...rest
}: InputProps) {
  const [touched, setTouched] = useState(false);
  const error = validator ? validator(value) : null;
  const show = (touched || forceError) && !!error;

  return (
    <>
      <input
        {...rest}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(applyRestrict(e.target.value, restrict, maxLength))}
        onBlur={(e) => {
          setTouched(true);
          onBlur?.(e);
        }}
        aria-invalid={show || undefined}
      />
      {show && <span style={errorStyle || defaultErrorStyle}>{error}</span>}
    </>
  );
}

type TextareaProps = CommonProps &
  Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange' | 'maxLength'>;

export function ValidatedTextarea({
  value,
  onChange,
  validator,
  restrict,
  maxLength,
  forceError,
  errorStyle,
  onBlur,
  ...rest
}: TextareaProps) {
  const [touched, setTouched] = useState(false);
  const error = validator ? validator(value) : null;
  const show = (touched || forceError) && !!error;

  return (
    <>
      <textarea
        {...rest}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(applyRestrict(e.target.value, restrict, maxLength))}
        onBlur={(e) => {
          setTouched(true);
          onBlur?.(e);
        }}
        aria-invalid={show || undefined}
      />
      {show && <span style={errorStyle || defaultErrorStyle}>{error}</span>}
    </>
  );
}
