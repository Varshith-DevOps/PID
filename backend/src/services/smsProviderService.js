const logger = require('../utils/logger');

const providerName = (settings) => String(settings?.smsProvider || process.env.SMS_PROVIDER || 'MOCK').toUpperCase();

const parseConfig = (settings) => {
  const raw = settings?.smsConfig || process.env.SMS_CONFIG || '{}';
  try {
    return typeof raw === 'string' ? JSON.parse(raw || '{}') : raw;
  } catch {
    return {};
  }
};

const sendWithMock = async ({ to, message }) => {
  logger.info('Mock SMS queued', { to, length: String(message || '').length });
  return { provider: 'MOCK', id: `mock-${Date.now()}`, status: 'SENT' };
};

const unsupportedProvider = (provider) => async () => {
  const error = new Error(`${provider} SMS provider is configured but no adapter credentials are enabled in this deployment.`);
  error.code = 'SMS_PROVIDER_NOT_CONFIGURED';
  throw error;
};

const providers = {
  MOCK: sendWithMock,
  TWILIO: unsupportedProvider('TWILIO'),
  MSG91: unsupportedProvider('MSG91'),
  TEXTLOCAL: unsupportedProvider('TEXTLOCAL'),
  AWS_SNS: unsupportedProvider('AWS_SNS'),
};

const sendSms = async ({ to, message, settings }) => {
  const provider = providerName(settings);
  const adapter = providers[provider] || providers.MOCK;
  return adapter({ to, message, config: parseConfig(settings), settings });
};

module.exports = {
  sendSms,
  providerName,
};
