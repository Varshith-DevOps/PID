/**
 * @fileoverview Centralized secret access and validation.
 * Secrets must be provided via environment variables. There are NO hardcoded
 * fallbacks — missing/weak secrets fail closed rather than silently using a
 * guessable default (which would allow token / signature forgery).
 * @module config/secrets
 */

/** Known-weak values that previously shipped as defaults. Never allow these. */
const KNOWN_WEAK_SECRETS = new Set([
  'supersecretjwtkey',
  'pid-hcms-secret-key-123',
  'supersecret',
  'secret',
  'changeme',
  'password',
]);

const MIN_SECRET_LENGTH = 32;

/**
 * A secret is unacceptable if it is missing, too short, or a known-weak default.
 * @param {string|undefined} value
 * @returns {boolean}
 */
function isWeakSecret(value) {
  if (!value || typeof value !== 'string') return true;
  if (value.trim().length < MIN_SECRET_LENGTH) return true;
  if (KNOWN_WEAK_SECRETS.has(value.trim())) return true;
  return false;
}

/**
 * Returns the JWT signing secret or throws if it is unsafe.
 * @returns {string}
 */
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (isWeakSecret(secret)) {
    const err = new Error('JWT_SECRET is missing, too short, or a known-weak default');
    err.statusCode = 500;
    throw err;
  }
  return secret;
}

/**
 * Returns the mobile HMAC signing secret, or throws (fail closed) if unset.
 * Callers should treat a throw as "mobile signing not configured" and reject
 * the request — never fall back to a default secret.
 * @returns {string}
 */
function getMobileAppSecret() {
  const secret = process.env.MOBILE_APP_SECRET;
  if (isWeakSecret(secret)) {
    const err = new Error('MOBILE_APP_SECRET is not configured or is a known-weak default');
    err.statusCode = 503;
    throw err;
  }
  return secret;
}

/**
 * Validates required secrets at boot. In production, an invalid secret aborts
 * startup (fail closed). In dev/test it logs a loud warning so local workflows
 * and the existing test suite keep running.
 */
function validateStartupSecrets() {
  const isProd = process.env.NODE_ENV === 'production';
  const problems = [];

  if (isWeakSecret(process.env.JWT_SECRET)) {
    problems.push(`JWT_SECRET must be set and >= ${MIN_SECRET_LENGTH} chars and not a known-weak default`);
  }
  // MOBILE_APP_SECRET is only required if mobile punch signing is used, but if
  // it is set at all it must be strong.
  if (process.env.MOBILE_APP_SECRET !== undefined && isWeakSecret(process.env.MOBILE_APP_SECRET)) {
    problems.push(`MOBILE_APP_SECRET is set but weak; must be >= ${MIN_SECRET_LENGTH} chars and not a known-weak default`);
  }

  // FIELD_ENCRYPTION_KEY protects PII at rest. Required in production; must
  // decode (hex or base64) to exactly 32 bytes.
  const fek = process.env.FIELD_ENCRYPTION_KEY;
  const fekValid = !!fek && (
    /^[0-9a-fA-F]{64}$/.test(fek) ||
    (() => { try { return Buffer.from(fek, 'base64').length === 32; } catch { return false; } })()
  );
  if (isProd && !fekValid) {
    problems.push('FIELD_ENCRYPTION_KEY must be set and decode to exactly 32 bytes (hex or base64) in production');
  } else if (!isProd && fek !== undefined && !fekValid) {
    problems.push('FIELD_ENCRYPTION_KEY is set but does not decode to 32 bytes; field encryption will be disabled');
  }

  if (problems.length === 0) return;

  const message = `❌ Insecure secret configuration:\n  - ${problems.join('\n  - ')}`;
  if (isProd) {
    console.error(message);
    console.error('Refusing to start in production with insecure secrets. Generate strong values, e.g.:');
    console.error('  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"');
    process.exit(1);
  } else {
    console.warn(message);
    console.warn('⚠️  Running with insecure secrets (allowed only outside production). Do NOT deploy this.');
  }
}

module.exports = {
  isWeakSecret,
  getJwtSecret,
  getMobileAppSecret,
  validateStartupSecrets,
  KNOWN_WEAK_SECRETS,
  MIN_SECRET_LENGTH,
};
