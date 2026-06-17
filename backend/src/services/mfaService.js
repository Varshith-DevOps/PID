const crypto = require('crypto');

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const MFA_TOKEN_TTL = '5m';
const RECOVERY_CODE_COUNT = 8;

const generateBase32Secret = (length = 20) => {
  const bytes = crypto.randomBytes(length);
  let bits = '';
  for (const byte of bytes) bits += byte.toString(2).padStart(8, '0');

  let output = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, '0');
    output += BASE32_ALPHABET[parseInt(chunk, 2)];
  }
  return output;
};

const decodeBase32 = (secret) => {
  const normalized = String(secret || '').replace(/=+$/g, '').replace(/\s/g, '').toUpperCase();
  let bits = '';
  for (const char of normalized) {
    const value = BASE32_ALPHABET.indexOf(char);
    if (value < 0) throw new Error('Invalid MFA secret');
    bits += value.toString(2).padStart(5, '0');
  }

  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
};

const generateTotp = (secret, step = Math.floor(Date.now() / 30000)) => {
  const key = decodeBase32(secret);
  const counter = Buffer.alloc(8);
  counter.writeUInt32BE(Math.floor(step / 0x100000000), 0);
  counter.writeUInt32BE(step & 0xffffffff, 4);

  const hmac = crypto.createHmac('sha1', key).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff);
  return String(code % 1000000).padStart(6, '0');
};

const verifyTotp = (secret, code, window = 1) => {
  const normalizedCode = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(normalizedCode)) return false;

  const currentStep = Math.floor(Date.now() / 30000);
  for (let offset = -window; offset <= window; offset += 1) {
    if (generateTotp(secret, currentStep + offset) === normalizedCode) return true;
  }
  return false;
};

const hashRecoveryCode = (code) => crypto
  .createHash('sha256')
  .update(String(code).trim().toUpperCase())
  .digest('hex');

const generateRecoveryCodes = () => Array.from({ length: RECOVERY_CODE_COUNT }, () => {
  const raw = crypto.randomBytes(5).toString('hex').toUpperCase();
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
});

const buildOtpAuthUrl = ({ issuer = 'NexusHR', email, secret }) => {
  const label = encodeURIComponent(`${issuer}:${email}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `otpauth://totp/${label}?${params.toString()}`;
};

module.exports = {
  MFA_TOKEN_TTL,
  generateBase32Secret,
  generateTotp,
  verifyTotp,
  generateRecoveryCodes,
  hashRecoveryCode,
  buildOtpAuthUrl,
};
