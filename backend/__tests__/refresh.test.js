const request = require('supertest');
const app = require('../src/index');
const prisma = require('../src/config/database');

/** Pull a specific cookie's value out of a set-cookie header array. */
function cookieValue(setCookie, name) {
  const c = (setCookie || []).find((x) => x.startsWith(`${name}=`));
  return c ? c.split(';')[0].split('=').slice(1).join('=') : null;
}

describe('Refresh-token flow', () => {
  afterAll(async () => { await prisma.$disconnect(); });

  it('login issues an httpOnly refresh cookie scoped to /api/auth', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@hrms.com', password: 'admin123' });
    const setCookie = res.headers['set-cookie'] || [];
    const refresh = setCookie.find((c) => c.startsWith('refreshToken='));
    expect(refresh).toBeDefined();
    expect(refresh).toContain('HttpOnly');
    expect(refresh).toContain('Path=/api/auth');
  });

  it('exchanges a valid refresh token for a fresh access token', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: 'admin@hrms.com', password: 'admin123' });
    const refreshToken = cookieValue(login.headers['set-cookie'], 'refreshToken');

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `refreshToken=${refreshToken}`);
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();

    // The new access token actually works.
    const profile = await request(app).get('/api/auth/profile').set('Authorization', `Bearer ${res.body.token}`);
    expect(profile.status).toBe(200);
  });

  it('rejects refresh with no token', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
  });

  it('refresh tokens are revoked after logout (tokenVersion bump)', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: 'admin@hrms.com', password: 'admin123' });
    const accessToken = login.body.token;
    const refreshToken = cookieValue(login.headers['set-cookie'], 'refreshToken');

    await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${accessToken}`).expect(200);

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `refreshToken=${refreshToken}`);
    expect(res.status).toBe(401);
  });
});
