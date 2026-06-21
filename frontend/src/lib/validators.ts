/**
 * @fileoverview Field validation helpers for PID hcms.
 *
 * Every validator returns a short, plain-language error string when the value is
 * invalid, or `null` when it is acceptable. Messages are written for non-technical
 * users ("Enter a valid 10-digit mobile number" — not "regex mismatch").
 *
 * Pair these with the input restrictors (e.g. `onlyDigits`) to stop wrong
 * characters from being typed in the first place, and with `validateForm` to
 * block submission until everything is valid.
 *
 * @module lib/validators
 */

export type Validator = (value: string) => string | null;

const str = (v: unknown) => String(v ?? '').trim();

// ─────────────────────────────────────────────────────────────────────────────
// Generic validators
// ─────────────────────────────────────────────────────────────────────────────

/** Field must not be empty. */
export const required = (label = 'This field'): Validator => (v) =>
  str(v).length === 0 ? `${label} is required.` : null;

/** Valid email: must contain text, an "@", and a "." after the "@". */
export const email: Validator = (v) => {
  const value = str(v);
  if (!value) return 'Email is required.';
  // local@domain.tld — at least one dot after the @, no spaces.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return 'Enter a valid email address, e.g. name@company.com';
  }
  return null;
};

/** Indian mobile number: exactly 10 digits, starting 6-9. */
export const mobile: Validator = (v) => {
  const value = str(v);
  if (!value) return 'Mobile number is required.';
  if (!/^\d+$/.test(value)) return 'Mobile number can contain digits only.';
  if (!/^[6-9]\d{9}$/.test(value)) return 'Enter a valid 10-digit mobile number.';
  return null;
};

/** Optional phone (mobile or landline): 7-15 digits, "+" allowed at start. */
export const phone: Validator = (v) => {
  const value = str(v);
  if (!value) return null; // optional
  if (!/^\+?\d{7,15}$/.test(value)) return 'Enter a valid phone number (7-15 digits).';
  return null;
};

/** Name: letters, spaces, dot, apostrophe and hyphen only. */
export const personName = (label = 'Name'): Validator => (v) => {
  const value = str(v);
  if (!value) return `${label} is required.`;
  if (value.length < 2) return `${label} must be at least 2 characters.`;
  if (!/^[A-Za-z][A-Za-z .'-]*$/.test(value)) return `${label} can contain letters only.`;
  return null;
};

/** A positive money amount (greater than 0). */
export const amount: Validator = (v) => {
  const value = str(v);
  if (!value) return 'Amount is required.';
  const n = Number(value);
  if (Number.isNaN(n)) return 'Enter a valid amount (numbers only).';
  if (n <= 0) return 'Amount must be greater than 0.';
  return null;
};

/** A non-negative number. */
export const nonNegative = (label = 'Value'): Validator => (v) => {
  const value = str(v);
  if (!value) return `${label} is required.`;
  const n = Number(value);
  if (Number.isNaN(n)) return `${label} must be a number.`;
  if (n < 0) return `${label} cannot be negative.`;
  return null;
};

/** Whole number (integer). */
export const integer = (label = 'Value'): Validator => (v) => {
  const value = str(v);
  if (!value) return `${label} is required.`;
  if (!/^\d+$/.test(value)) return `${label} must be a whole number.`;
  return null;
};

/** Percentage between 0 and 100. */
export const percentage: Validator = (v) => {
  const value = str(v);
  if (!value) return 'Percentage is required.';
  const n = Number(value);
  if (Number.isNaN(n)) return 'Enter a valid percentage.';
  if (n < 0 || n > 100) return 'Percentage must be between 0 and 100.';
  return null;
};

/** Minimum length. */
export const minLen = (n: number, label = 'This field'): Validator => (v) =>
  str(v).length < n ? `${label} must be at least ${n} characters.` : null;

/** A required date (any parseable date string). */
export const date = (label = 'Date'): Validator => (v) => {
  const value = str(v);
  if (!value) return `${label} is required.`;
  if (Number.isNaN(Date.parse(value))) return `Enter a valid ${label.toLowerCase()}.`;
  return null;
};

/** Strong password: 12+ chars with upper, lower, number, and symbol. */
export const password: Validator = (v) => {
  const value = String(v ?? '');
  if (!value) return 'Password is required.';
  if (value.length < 12) return 'Password must be at least 12 characters long.';
  if (!/[A-Z]/.test(value)) return 'Add at least one uppercase letter.';
  if (!/[a-z]/.test(value)) return 'Add at least one lowercase letter.';
  if (!/\d/.test(value)) return 'Add at least one number.';
  if (!/[^A-Za-z0-9]/.test(value)) return 'Add at least one symbol (e.g. !@#$).';
  return null;
};

/** Website / URL (optional). */
export const url: Validator = (v) => {
  const value = str(v);
  if (!value) return null;
  if (!/^https?:\/\/[^\s.]+\.[^\s]+$/.test(value)) return 'Enter a valid URL starting with http:// or https://';
  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// India-specific identifiers
// ─────────────────────────────────────────────────────────────────────────────

/** PAN: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F). */
export const pan: Validator = (v) => {
  const value = str(v).toUpperCase();
  if (!value) return 'PAN is required.';
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value)) return 'Enter a valid PAN, e.g. ABCDE1234F.';
  return null;
};

/** Aadhaar: 12 digits (spaces allowed). */
export const aadhaar: Validator = (v) => {
  const value = str(v).replace(/\s/g, '');
  if (!value) return 'Aadhaar number is required.';
  if (!/^\d{12}$/.test(value)) return 'Aadhaar must be 12 digits.';
  return null;
};

/** IFSC: 4 letters, a 0, then 6 alphanumerics (e.g. HDFC0001234). */
export const ifsc: Validator = (v) => {
  const value = str(v).toUpperCase();
  if (!value) return 'IFSC code is required.';
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(value)) return 'Enter a valid IFSC code, e.g. HDFC0001234.';
  return null;
};

/** GSTIN: 15 characters (2 digit state + 10 char PAN + 3). */
export const gstin: Validator = (v) => {
  const value = str(v).toUpperCase();
  if (!value) return 'GSTIN is required.';
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(value)) {
    return 'Enter a valid 15-character GSTIN.';
  }
  return null;
};

/** Bank account number: 9-18 digits. */
export const bankAccount: Validator = (v) => {
  const value = str(v);
  if (!value) return 'Account number is required.';
  if (!/^\d{9,18}$/.test(value)) return 'Account number must be 9 to 18 digits.';
  return null;
};

/** UAN / PF universal account number: 12 digits. */
export const uan: Validator = (v) => {
  const value = str(v);
  if (!value) return null; // often optional
  if (!/^\d{12}$/.test(value)) return 'UAN must be 12 digits.';
  return null;
};

/** Indian PIN code: 6 digits, not starting with 0. */
export const pincode: Validator = (v) => {
  const value = str(v);
  if (!value) return 'PIN code is required.';
  if (!/^[1-9]\d{5}$/.test(value)) return 'Enter a valid 6-digit PIN code.';
  return null;
};

/** CIN: 21-character corporate identification number. */
export const cin: Validator = (v) => {
  const value = str(v).toUpperCase();
  if (!value) return 'CIN is required.';
  if (!/^[LUu]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/.test(value)) {
    return 'Enter a valid 21-character CIN.';
  }
  return null;
};

/** DIN: 8-digit director identification number. */
export const din: Validator = (v) => {
  const value = str(v);
  if (!value) return 'DIN is required.';
  if (!/^\d{8}$/.test(value)) return 'DIN must be 8 digits.';
  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Combinators
// ─────────────────────────────────────────────────────────────────────────────

/** Run validators in order; return the first error, or null if all pass. */
export const compose = (...validators: Validator[]): Validator => (v) => {
  for (const validate of validators) {
    const err = validate(v);
    if (err) return err;
  }
  return null;
};

/** Make a validator optional: skip it when the value is empty. */
export const optional = (validator: Validator): Validator => (v) =>
  str(v).length === 0 ? null : validator(v);

/** A value that must equal another (e.g. confirm password). */
export const matches = (other: () => string, label = 'Values'): Validator => (v) =>
  String(v ?? '') !== other() ? `${label} do not match.` : null;

// ─────────────────────────────────────────────────────────────────────────────
// Whole-form validation
// ─────────────────────────────────────────────────────────────────────────────

export type FormRules = Record<string, Validator>;
export type FormErrors = Record<string, string>;

/**
 * Validate a values object against a rules map.
 * Returns `{ errors, isValid, firstError }`.
 */
export function validateForm(values: Record<string, unknown>, rules: FormRules): {
  errors: FormErrors;
  isValid: boolean;
  firstError: string | null;
} {
  const errors: FormErrors = {};
  for (const key of Object.keys(rules)) {
    const err = rules[key](String(values[key] ?? ''));
    if (err) errors[key] = err;
  }
  const keys = Object.keys(errors);
  return { errors, isValid: keys.length === 0, firstError: keys.length ? errors[keys[0]] : null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Input restrictors — use inside onChange to block invalid characters as typed.
// ─────────────────────────────────────────────────────────────────────────────

/** Keep digits only, optionally capped to `max` length. */
export const onlyDigits = (value: string, max?: number): string => {
  const digits = value.replace(/\D/g, '');
  return typeof max === 'number' ? digits.slice(0, max) : digits;
};

/** Keep a single decimal number (digits and one dot). */
export const onlyDecimal = (value: string): string => {
  let cleaned = value.replace(/[^\d.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot !== -1) {
    cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
  }
  return cleaned;
};

/** Uppercase letters and digits only (PAN, IFSC, GSTIN, CIN), capped to `max`. */
export const upperAlnum = (value: string, max?: number): string => {
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return typeof max === 'number' ? cleaned.slice(0, max) : cleaned;
};

/** Letters and spaces only (names). */
export const onlyAlpha = (value: string): string => value.replace(/[^A-Za-z .'-]/g, '');
