/**
 * End-to-end MFA (TOTP) flow: enrol -> enable -> challenge-on-login -> verify with
 * TOTP -> verify with a one-time recovery code (and its consumption) -> disable.
 * Drives a dedicated throwaway user so no shared seed account is left MFA-enabled.
 * Uses the app's own generateTotp() to compute valid codes from the setup secret.
 */

const request = require('supertest');
const app = require('../src/index');
const prisma = require('../src/config/database');
const { generateTotp } = require('../src/services/mfaService');
const { hashPassword } = require('../src/utils/password');

const EMAIL = `mfa-${`${Date.now()}`.slice(-7)}@hrms.com`;
const PASSWORD = 'MfaTestPass1!';

const login = () => request(app).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });

describe('MFA (TOTP) end-to-end', () => {
  let secret, recoveryCodes;

  beforeAll(async () => {
    const company = await prisma.company.findFirst();
    await prisma.user.deleteMany({ where: { email: EMAIL } }).catch(() => {});
    await prisma.user.create({
      data: { email: EMAIL, password: await hashPassword(PASSWORD), name: 'MFA Tester', role: 'EMPLOYEE', companyId: company?.id, mustChangePassword: false },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: EMAIL } }).catch(() => {});
    await prisma.$disconnect();
  });

  it('enrols and enables MFA, rejecting a wrong confirmation code', async () => {
    const first = await login();
    expect(first.status).toBe(200);
    expect(first.body.token).toBeTruthy();
    expect(first.body.mfaRequired).toBeFalsy(); // not enabled yet
    const token = first.body.token;

    const setup = await request(app).post('/api/auth/mfa/setup').set('Authorization', `Bearer ${token}`);
    expect(setup.status).toBe(200);
    expect(setup.body.secret).toBeTruthy();
    expect(setup.body.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
    secret = setup.body.secret;

    const wrong = await request(app).post('/api/auth/mfa/enable').set('Authorization', `Bearer ${token}`).send({ code: '000000' });
    expect(wrong.status).toBe(400);

    const enable = await request(app).post('/api/auth/mfa/enable').set('Authorization', `Bearer ${token}`).send({ code: generateTotp(secret) });
    expect(enable.status).toBe(200);
    expect(Array.isArray(enable.body.recoveryCodes)).toBe(true);
    expect(enable.body.recoveryCodes).toHaveLength(8);
    recoveryCodes = enable.body.recoveryCodes;
  });

  it('challenges subsequent logins for a second factor (no access token issued)', async () => {
    const res = await login();
    expect(res.status).toBe(200);
    expect(res.body.mfaRequired).toBe(true);
    expect(res.body.mfaToken).toBeTruthy();
    expect(res.body.token).toBeUndefined();
  });

  it('completes login with a valid TOTP code and rejects an invalid one', async () => {
    const challenge = await login();
    const mfaToken = challenge.body.mfaToken;

    const bad = await request(app).post('/api/auth/mfa/verify-login').send({ mfaToken, code: '123456' });
    expect(bad.status).toBe(401);

    const ok = await request(app).post('/api/auth/mfa/verify-login').send({ mfaToken, code: generateTotp(secret) });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeTruthy();
  });

  it('accepts a one-time recovery code and consumes it (single use)', async () => {
    const code = recoveryCodes[0];

    const first = await request(app).post('/api/auth/mfa/verify-login')
      .send({ mfaToken: (await login()).body.mfaToken, recoveryCode: code });
    expect(first.status).toBe(200);
    expect(first.body.token).toBeTruthy();

    // Re-using the same recovery code must fail.
    const reuse = await request(app).post('/api/auth/mfa/verify-login')
      .send({ mfaToken: (await login()).body.mfaToken, recoveryCode: code });
    expect(reuse.status).toBe(401);
  });

  it('disables MFA with the account password and restores normal login', async () => {
    const token = (await request(app).post('/api/auth/mfa/verify-login')
      .send({ mfaToken: (await login()).body.mfaToken, code: generateTotp(secret) })).body.token;

    const disable = await request(app).post('/api/auth/mfa/disable').set('Authorization', `Bearer ${token}`).send({ currentPassword: PASSWORD });
    expect(disable.status).toBe(200);

    const after = await login();
    expect(after.status).toBe(200);
    expect(after.body.mfaRequired).toBeFalsy();
    expect(after.body.token).toBeTruthy();
  });
});
