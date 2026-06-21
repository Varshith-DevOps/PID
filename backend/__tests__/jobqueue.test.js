const { registerJob, enqueue, isAsync } = require('../src/services/jobQueue');

describe('job queue (inline fallback when no REDIS_URL)', () => {
  it('runs a registered job inline and awaits completion', async () => {
    let ran = null;
    registerJob('test-job', async (data) => { ran = data.value * 2; });
    const result = await enqueue('test-job', { value: 21 });
    expect(result.queued).toBe(false); // inline (no Redis configured in tests)
    expect(ran).toBe(42);
  });

  it('reports synchronous mode without Redis', () => {
    expect(isAsync()).toBe(false);
  });

  it('throws for an unregistered job (inline)', async () => {
    await expect(enqueue('does-not-exist', {})).rejects.toThrow(/No handler/);
  });
});
