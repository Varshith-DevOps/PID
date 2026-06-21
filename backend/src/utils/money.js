/**
 * @fileoverview Money helpers. Payroll stores values to the paisa (2 dp); these
 * round consistently and avoid the classic `Math.round(1.005*100)/100 === 1.00`
 * floating-point mis-round by nudging with a relative epsilon before rounding.
 *
 * NOTE: this is robust paisa-rounding for payroll-range values, not arbitrary-
 * precision decimal arithmetic. A full Decimal migration (schema `numeric` +
 * decimal.js compute layer + string-safe JSON) remains the long-term hardening
 * step; see docs. Rounding every monetary component to the paisa at boundaries
 * is standard payroll practice and removes the visible drift class of bugs.
 * @module utils/money
 */

/**
 * Round a monetary value to `dp` decimal places (default 2 = paisa),
 * half-up, resilient to float representation error.
 * @param {number|string} value
 * @param {number} [dp]
 * @returns {number}
 */
function roundMoney(value, dp = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const factor = 10 ** dp;
  // The (1 + EPSILON) nudge pushes values sitting just below an .xx5 boundary
  // (e.g. 1.005 -> 100.4999999..) back over it so they round up correctly.
  return Math.round(n * factor * (1 + Number.EPSILON)) / factor;
}

/** Sum an array of monetary values, rounding the result to the paisa. */
function sumMoney(values, dp = 2) {
  const total = (values || []).reduce((acc, v) => acc + (Number(v) || 0), 0);
  return roundMoney(total, dp);
}

/** Multiply a monetary value by a factor, rounding to the paisa. */
function mulMoney(value, factor, dp = 2) {
  return roundMoney((Number(value) || 0) * (Number(factor) || 0), dp);
}

module.exports = { roundMoney, sumMoney, mulMoney };
