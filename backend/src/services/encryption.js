/**
 * @fileoverview Field-level encryption for sensitive data at rest (AES-256-GCM).
 *
 * Design goals:
 *  - Transparent: integrated into the Prisma client extension so all read/write
 *    paths are covered without touching every controller.
 *  - Backward compatible: `decrypt()` passes through any value that is not in the
 *    versioned ciphertext format, so existing plaintext rows keep working and the
 *    rollout can be gradual (a backfill script can migrate old rows later).
 *  - Key-gated: when no FIELD_ENCRYPTION_KEY is configured (typical for local dev
 *    and the test suite), encryption is a no-op passthrough — behaviour is
 *    unchanged. In production the startup check requires a valid key.
 *
 * Ciphertext format: `v1:<iv-b64>:<authTag-b64>:<ciphertext-b64>`
 * @module services/encryption
 */

const crypto = require('crypto');

const PREFIX = 'v1';
const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;

/** Sensitive field names encrypted at rest, used by the Prisma extension. */
const ENCRYPTED_FIELDS = {
  User: ['mfaSecret'],
  Employee: ['panNumber', 'aadharNumber'],
  BankDetails: ['accountNumber'],
};

/** Flat set of every encrypted field name, for decrypting nested read results. */
const ENCRYPTED_FIELD_NAMES = new Set(
  Object.values(ENCRYPTED_FIELDS).flat()
);

let _keyResolved = false;
let _key = null;

/**
 * Resolve the 32-byte key from FIELD_ENCRYPTION_KEY (hex or base64). Cached.
 * @returns {Buffer|null} key, or null when encryption is disabled.
 */
function resolveKey() {
  if (_keyResolved) return _key;
  _keyResolved = true;
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (!raw) {
    _key = null;
    return _key;
  }
  let buf = null;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    buf = Buffer.from(raw, 'hex');
  } else {
    try { buf = Buffer.from(raw, 'base64'); } catch { buf = null; }
  }
  if (!buf || buf.length !== 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FIELD_ENCRYPTION_KEY must decode to exactly 32 bytes (hex or base64)');
    }
    console.warn('⚠️  FIELD_ENCRYPTION_KEY is set but is not 32 bytes; field encryption is DISABLED.');
    _key = null;
    return _key;
  }
  _key = buf;
  return _key;
}

/** @returns {boolean} whether a value is in our versioned ciphertext format. */
function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(`${PREFIX}:`);
}

/** @returns {boolean} whether encryption is active (a valid key is configured). */
function isEncryptionEnabled() {
  return resolveKey() !== null;
}

/**
 * Encrypt a string. No-ops on null/empty, already-encrypted, or when disabled.
 * @param {*} plaintext
 * @returns {*}
 */
function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined || plaintext === '') return plaintext;
  if (isEncrypted(plaintext)) return plaintext;
  const key = resolveKey();
  if (!key) return plaintext;
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

/**
 * Decrypt a value. Passes through anything not in ciphertext format (backward
 * compatible with existing plaintext rows).
 * @param {*} value
 * @returns {*}
 */
function decrypt(value) {
  if (!isEncrypted(value)) return value;
  const key = resolveKey();
  if (!key) return value; // cannot decrypt without a key; leave as-is
  const parts = value.split(':');
  if (parts.length !== 4) return value;
  const iv = Buffer.from(parts[1], 'base64');
  const tag = Buffer.from(parts[2], 'base64');
  const ct = Buffer.from(parts[3], 'base64');
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

/**
 * Encrypt the configured fields on a Prisma write payload for a given model.
 * Mutates and returns the same `data` object. Handles arrays (createMany).
 * @param {string} model - Prisma model name (e.g. 'Employee')
 * @param {object|object[]} data
 * @returns {object|object[]}
 */
function encryptWriteData(model, data) {
  const fields = ENCRYPTED_FIELDS[model];
  if (!fields || !data) return data;
  const apply = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    for (const field of fields) {
      if (typeof obj[field] === 'string' && obj[field] !== '') {
        obj[field] = encrypt(obj[field]);
      }
    }
  };
  if (Array.isArray(data)) data.forEach(apply);
  else apply(data);
  return data;
}

/**
 * Recursively decrypt any known sensitive field found in a Prisma read result,
 * including nested relations (e.g. employee.bankDetails.accountNumber). Only
 * touches values that are actually ciphertext, so plaintext passes through.
 * @param {*} value
 * @returns {*}
 */
function decryptReadResult(value) {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) decryptReadResult(value[i]);
    return value;
  }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      const v = value[key];
      if (ENCRYPTED_FIELD_NAMES.has(key) && isEncrypted(v)) {
        value[key] = decrypt(v);
      } else if (v && typeof v === 'object') {
        decryptReadResult(v);
      }
    }
  }
  return value;
}

module.exports = {
  encrypt,
  decrypt,
  isEncrypted,
  isEncryptionEnabled,
  encryptWriteData,
  decryptReadResult,
  ENCRYPTED_FIELDS,
};
