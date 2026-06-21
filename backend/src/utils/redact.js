/**
 * @fileoverview Redaction helper for logs and audit records.
 * Recursively masks values whose key looks sensitive (passwords, statutory IDs,
 * bank/salary data, tokens, secrets) so PII never lands in audit rows or stdout.
 * @module utils/redact
 */

const SENSITIVE_KEYS = new Set([
  'password', 'currentpassword', 'newpassword', 'confirmpassword',
  'temporarypassword', 'temppassword',
  'pannumber', 'pan', 'aadharnumber', 'aadhaarnumber', 'aadhar', 'aadhaar',
  'accountnumber', 'bankaccount', 'bankaccountnumber', 'ifsccode',
  'salary', 'annualctc', 'basicsalary', 'ctc', 'grosspay', 'netpay',
  'mfasecret', 'mfarecoverycodes', 'recoverycodes', 'secret',
  'token', 'accesstoken', 'refreshtoken', 'mfatoken', 'authorization',
  'cvv', 'otp', 'signature', 'apikey',
]);

const MAX_DEPTH = 8;

/**
 * Return a deep copy of `value` with sensitive fields replaced by '[REDACTED]'.
 * @param {*} value
 * @param {number} [depth]
 * @returns {*}
 */
function redact(value, depth = 0) {
  if (depth > MAX_DEPTH) return '[TRUNCATED]';
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

module.exports = { redact, SENSITIVE_KEYS };
