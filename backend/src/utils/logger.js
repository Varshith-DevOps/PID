/**
 * @fileoverview Minimal structured logger with built-in redaction.
 * Emits single-line JSON in production (log-aggregator friendly) and readable
 * lines in dev. Any metadata object is passed through redact() so sensitive
 * fields never reach the log sink. No external dependency.
 * @module utils/logger
 */

const { redact } = require('./redact');

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const activeLevel = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;

function emit(level, message, meta) {
  if (LEVELS[level] > activeLevel) return;
  const safeMeta = meta ? redact(meta) : undefined;
  if (process.env.NODE_ENV === 'production') {
    const record = { level, message, ...(safeMeta ? { meta: safeMeta } : {}) };
    // Timestamp is added by most log shippers; avoid Date here for determinism.
    process.stdout.write(`${JSON.stringify(record)}\n`);
  } else {
    const suffix = safeMeta ? ` ${JSON.stringify(safeMeta)}` : '';
    // eslint-disable-next-line no-console
    (level === 'error' ? console.error : console.log)(`[${level.toUpperCase()}] ${message}${suffix}`);
  }
}

module.exports = {
  error: (msg, meta) => emit('error', msg, meta),
  warn: (msg, meta) => emit('warn', msg, meta),
  info: (msg, meta) => emit('info', msg, meta),
  debug: (msg, meta) => emit('debug', msg, meta),
};
