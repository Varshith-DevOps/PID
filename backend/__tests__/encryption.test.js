// Configure a real 32-byte key BEFORE requiring any module that resolves it.
process.env.FIELD_ENCRYPTION_KEY = require('crypto').randomBytes(32).toString('base64');

const { PrismaClient } = require('@prisma/client');
const enc = require('../src/services/encryption');
const prisma = require('../src/config/database'); // extended client (encrypt/decrypt)

describe('Field-level encryption utility', () => {
  it('round-trips a value', () => {
    const ct = enc.encrypt('ABCDE1234F');
    expect(enc.isEncrypted(ct)).toBe(true);
    expect(ct).not.toContain('ABCDE1234F');
    expect(enc.decrypt(ct)).toBe('ABCDE1234F');
  });

  it('produces unique ciphertext for the same input (random IV)', () => {
    expect(enc.encrypt('same')).not.toBe(enc.encrypt('same'));
  });

  it('passes through null, empty, and already-plaintext on decrypt (backward compatible)', () => {
    expect(enc.encrypt(null)).toBeNull();
    expect(enc.encrypt('')).toBe('');
    expect(enc.decrypt('plain-legacy-value')).toBe('plain-legacy-value');
    expect(enc.decrypt(null)).toBeNull();
  });

  it('rejects tampered ciphertext (GCM auth tag)', () => {
    const ct = enc.encrypt('secret-data');
    const parts = ct.split(':');
    const tampered = `${parts[0]}:${parts[1]}:${parts[2]}:${Buffer.from('evil').toString('base64')}`;
    expect(() => enc.decrypt(tampered)).toThrow();
  });

  it('encryptWriteData encrypts only configured fields for the model', () => {
    const data = { panNumber: 'ABCDE1234F', firstName: 'Asha' };
    enc.encryptWriteData('Employee', data);
    expect(enc.isEncrypted(data.panNumber)).toBe(true);
    expect(data.firstName).toBe('Asha'); // untouched
  });

  it('decryptReadResult decrypts known fields in nested relations', () => {
    const result = {
      firstName: 'Asha',
      panNumber: enc.encrypt('ABCDE1234F'),
      bankDetails: { accountNumber: enc.encrypt('123456789012'), ifscCode: 'SBIN0001234' },
    };
    enc.decryptReadResult(result);
    expect(result.panNumber).toBe('ABCDE1234F');
    expect(result.bankDetails.accountNumber).toBe('123456789012');
    expect(result.bankDetails.ifscCode).toBe('SBIN0001234'); // not an encrypted field
  });
});

describe('Prisma transparent encryption (at rest)', () => {
  const rawPrisma = new PrismaClient();
  let userId;
  const email = `enc_test_${Date.now()}@example.com`;

  afterAll(async () => {
    if (userId) await rawPrisma.user.delete({ where: { id: userId } }).catch(() => {});
    await rawPrisma.$disconnect();
    await prisma.$disconnect().catch(() => {});
  });

  it('stores mfaSecret as ciphertext but returns it decrypted via the app client', async () => {
    const created = await prisma.user.create({
      data: { email, name: 'Enc Test', password: 'x', mfaSecret: 'JBSWY3DPEHPK3PXP' },
    });
    userId = created.id;

    // Read via the extended app client -> should be decrypted (plaintext).
    const viaApp = await prisma.user.findUnique({ where: { id: userId } });
    expect(viaApp.mfaSecret).toBe('JBSWY3DPEHPK3PXP');

    // Read the same row with a raw client -> should be ciphertext at rest.
    const viaRaw = await rawPrisma.user.findUnique({ where: { id: userId } });
    expect(enc.isEncrypted(viaRaw.mfaSecret)).toBe(true);
    expect(viaRaw.mfaSecret).not.toContain('JBSWY3DPEHPK3PXP');
  });
});
