const { csrfProtection, generateCsrfToken } = require('../src/middleware/csrf');

/** Build a mock (req, res, next) trio for exercising the middleware directly. */
function mock({ method = 'POST', headers = {}, cookies = {} } = {}) {
  let statusCode = null;
  let body = null;
  let nexted = false;
  const req = { method, headers, cookies };
  const res = {
    status(c) { statusCode = c; return this; },
    json(b) { body = b; return this; },
  };
  const next = () => { nexted = true; };
  return { req, res, next, get: () => ({ statusCode, body, nexted }) };
}

describe('CSRF middleware (double-submit, cookie-auth only)', () => {
  it('allows safe methods (GET) without a token', () => {
    const m = mock({ method: 'GET', cookies: { token: 'sess' } });
    csrfProtection(m.req, m.res, m.next);
    expect(m.get().nexted).toBe(true);
  });

  it('exempts Bearer-authenticated mutations (not CSRF-able)', () => {
    const m = mock({ headers: { authorization: 'Bearer abc' }, cookies: { token: 'sess' } });
    csrfProtection(m.req, m.res, m.next);
    expect(m.get().nexted).toBe(true);
  });

  it('exempts unauthenticated requests (no session cookie)', () => {
    const m = mock({ cookies: {} });
    csrfProtection(m.req, m.res, m.next);
    expect(m.get().nexted).toBe(true);
  });

  it('rejects a cookie-authenticated mutation with no CSRF token', () => {
    const m = mock({ cookies: { token: 'sess' } });
    csrfProtection(m.req, m.res, m.next);
    expect(m.get().nexted).toBe(false);
    expect(m.get().statusCode).toBe(403);
    expect(m.get().body.error).toMatch(/csrf/i);
  });

  it('rejects when header and cookie tokens do not match', () => {
    const m = mock({ cookies: { token: 'sess', csrfToken: 'aaa' }, headers: { 'x-csrf-token': 'bbb' } });
    csrfProtection(m.req, m.res, m.next);
    expect(m.get().statusCode).toBe(403);
  });

  it('allows a cookie-authenticated mutation when header matches the csrf cookie', () => {
    const t = generateCsrfToken();
    const m = mock({ cookies: { token: 'sess', csrfToken: t }, headers: { 'x-csrf-token': t } });
    csrfProtection(m.req, m.res, m.next);
    expect(m.get().nexted).toBe(true);
  });
});
