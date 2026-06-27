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
  // Coverage ratchet (enforced only when --coverage is passed, e.g. in CI).
  // Current actuals (2026-06): lines 55%, stmts 53%, funcs 53%, branches 36%.
  // Floors sit a few points below so genuine regressions fail the build without
  // flaking on small fluctuations. Raise these as coverage grows — never lower.
  coverageThreshold: {
    global: { lines: 50, statements: 48, functions: 46, branches: 30 },
  },
};
