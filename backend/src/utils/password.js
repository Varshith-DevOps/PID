/**
 * @fileoverview Single source of truth for password hashing cost.
 *
 * Centralises the bcrypt work factor so every code path (login, registration,
 * admin reset, employee/recruitment provisioning, DPDP re-provisioning) hashes
 * with the same OWASP-recommended strength instead of scattering literal `10`s.
 *
 * Override with BCRYPT_ROUNDS env var; clamped to a 12 floor so production can
 * raise but never weaken it.
 * @module utils/password
 */

const bcrypt = require('bcryptjs');

const FLOOR = 12; // OWASP 2023 minimum for bcrypt
const parsed = parseInt(process.env.BCRYPT_ROUNDS, 10);
const BCRYPT_ROUNDS = Number.isFinite(parsed) ? Math.max(parsed, FLOOR) : FLOOR;

/** Hash a plaintext password with the configured work factor. */
const hashPassword = (plain) => bcrypt.hash(plain, BCRYPT_ROUNDS);

module.exports = { BCRYPT_ROUNDS, hashPassword };
