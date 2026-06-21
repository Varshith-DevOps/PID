module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  verbose: true,
  // Suites share one SQLite database and mutate it; run serially so parallel
  // workers don't race on shared rows (avoids intermittent cross-suite failures).
  maxWorkers: 1,
  // Generous per-test timeout: some tests issue 30-50+ sequential queries, which
  // is instant on local SQLite but takes seconds against a remote DB (e.g.
  // Supabase across regions). 30s keeps remote runs green without affecting local.
  testTimeout: 30000,
};
