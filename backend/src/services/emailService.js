const nodemailer = require('nodemailer');

const trimEnv = (key) => String(process.env[key] || '').trim();

const readBooleanEnv = (key, fallback = false) => {
  const value = trimEnv(key).toLowerCase();
  if (!value) return fallback;
  return ['1', 'true', 'yes'].includes(value);
};

const readNumberEnv = (key, fallback) => {
  const value = Number(trimEnv(key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const isDevelopment = () => process.env.NODE_ENV !== 'production';

const SMTP_TIMEOUT_MS = () => readNumberEnv('SMTP_TIMEOUT_MS', 10000);

const getEmailErrorCategory = (error) => {
  if (error?.code === 'SMTP_CONFIGURATION_MISSING' || error?.code === 'SMTP_NOT_CONFIGURED') {
    return 'SMTP_CONFIGURATION_MISSING';
  }
  if (error?.code === 'INVALID_RECIPIENT') return 'INVALID_RECIPIENT';
  if (error?.code === 'EAUTH' || error?.command === 'AUTH' || [534, 535].includes(Number(error?.responseCode))) {
    return 'SMTP_AUTH_FAILED';
  }
  if (
    ['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'EDNS', 'ECONNREFUSED', 'ECONNRESET'].includes(error?.code)
    || ['CONN', 'STARTTLS', 'EHLO'].includes(error?.command)
  ) {
    return 'SMTP_CONNECTION_FAILED';
  }
  return 'SMTP_DELIVERY_FAILED';
};

const sanitizeEmailError = (error) => {
  const message = String(error?.message || 'Email delivery failed.')
    .replace(/(password|pass|secret|token|credential)[^,\s]*/gi, '$1=[redacted]')
    .replace(/AUTH PLAIN\s+\S+/gi, 'AUTH PLAIN [redacted]')
    .slice(0, 240);
  return `${getEmailErrorCategory(error)}: ${message}`;
};

const logDevelopmentEmailError = (error) => {
  if (!isDevelopment()) return;
  console.warn('[SMTP_EMAIL_ERROR]', {
    category: getEmailErrorCategory(error),
    code: error?.code,
    command: error?.command,
    responseCode: error?.responseCode,
    message: sanitizeEmailError(error),
  });
};

const getSmtpConfig = () => {
  const host = trimEnv('SMTP_HOST');
  const port = readNumberEnv('SMTP_PORT', 587);
  const user = trimEnv('SMTP_USER');
  const pass = trimEnv('SMTP_PASS').replace(/\s+/g, '');

  if (!host || !user || !pass) {
    const error = new Error('Email service is not configured.');
    error.code = 'SMTP_CONFIGURATION_MISSING';
    throw error;
  }

  const secure = readBooleanEnv('SMTP_SECURE', port === 465);

  return {
    host,
    port,
    secure,
    requireTLS: !secure,
    auth: { user, pass },
    connectionTimeout: SMTP_TIMEOUT_MS(),
    greetingTimeout: SMTP_TIMEOUT_MS(),
    socketTimeout: SMTP_TIMEOUT_MS(),
  };
};

const fromAddress = () => {
  const name = trimEnv('SMTP_FROM_NAME') || 'PID HCMS Recruitment';
  const user = trimEnv('SMTP_USER');
  const configuredFrom = trimEnv('SMTP_FROM_EMAIL');
  const allowVerifiedSender = readBooleanEnv('SMTP_ALLOW_VERIFIED_FROM', false);
  const email = configuredFrom && (allowVerifiedSender || configuredFrom.toLowerCase() === user.toLowerCase())
    ? configuredFrom
    : user;

  if (isDevelopment() && configuredFrom && configuredFrom.toLowerCase() !== user.toLowerCase() && !allowVerifiedSender) {
    console.warn('[SMTP_CONFIG_WARNING]', 'SMTP_FROM_EMAIL differs from SMTP_USER; using SMTP_USER as From address.');
  }

  return `"${String(name).replace(/"/g, '')}" <${email}>`;
};

const createTransporter = () => nodemailer.createTransport(getSmtpConfig());

const verifySmtpTransporter = async () => {
  const transporter = createTransporter();
  await transporter.verify();
  return true;
};

const sendMail = async ({ to, subject, text, html }) => {
  const transporter = nodemailer.createTransport(getSmtpConfig());
  if (isDevelopment() || readBooleanEnv('SMTP_VERIFY_ON_SEND', false)) {
    await transporter.verify();
  }
  return transporter.sendMail({
    from: fromAddress(),
    to,
    subject,
    text,
    html,
  });
};

module.exports = {
  sendMail,
  sanitizeEmailError,
  getEmailErrorCategory,
  logDevelopmentEmailError,
  verifySmtpTransporter,
};
