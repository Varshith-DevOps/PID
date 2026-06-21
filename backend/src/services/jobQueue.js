/**
 * @fileoverview Lightweight async job queue with a safe inline fallback.
 *
 * When REDIS_URL is set AND `bullmq` is installed, jobs are enqueued to Redis and
 * processed by a background worker (so slow work like bulk payslip email / report
 * generation doesn't block the request thread, and survives across instances).
 * Otherwise jobs run INLINE (awaited immediately) — identical to today's behavior,
 * so nothing breaks when the infra isn't present. Install: npm i bullmq
 *
 * Usage:
 *   registerJob('payslip-email', async (data) => { ... });
 *   await enqueue('payslip-email', { runId });   // queued, or inline if no Redis
 * @module services/jobQueue
 */

const logger = require('../utils/logger');

const QUEUE_NAME = 'hrms-jobs';
const handlers = Object.create(null);

let queue = null;       // BullMQ Queue (producer)
let worker = null;      // BullMQ Worker (consumer)
let enabled = false;
let initialized = false;

function init() {
  if (initialized) return;
  initialized = true;
  const url = process.env.REDIS_URL;
  if (!url) return; // inline mode
  try {
    const { Queue, Worker } = require('bullmq');
    const connection = { url };
    queue = new Queue(QUEUE_NAME, { connection });
    worker = new Worker(QUEUE_NAME, async (job) => {
      const handler = handlers[job.name];
      if (!handler) throw new Error(`No handler registered for job "${job.name}"`);
      return handler(job.data);
    }, { connection });
    worker.on('failed', (job, err) => logger.error('Job failed', { name: job?.name, error: err?.message }));
    enabled = true;
    logger.info('Async job queue (BullMQ) enabled');
  } catch (e) {
    logger.warn('REDIS_URL set but bullmq not installed; jobs run inline', { error: e.message });
  }
}

/** Register a processor for a named job. */
function registerJob(name, handler) {
  handlers[name] = handler;
}

/**
 * Enqueue a job. Queued+async when the queue is enabled; otherwise awaited inline.
 * @param {string} name
 * @param {object} data
 */
async function enqueue(name, data = {}) {
  init();
  if (enabled && queue) {
    await queue.add(name, data, { removeOnComplete: true, attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
    return { queued: true };
  }
  // Inline fallback — preserves current synchronous behavior.
  const handler = handlers[name];
  if (!handler) throw new Error(`No handler registered for job "${name}"`);
  await handler(data);
  return { queued: false };
}

/** Whether jobs are processed asynchronously (Redis-backed). */
function isAsync() { init(); return enabled; }

module.exports = { registerJob, enqueue, isAsync, QUEUE_NAME };
