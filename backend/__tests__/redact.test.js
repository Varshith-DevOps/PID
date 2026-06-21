const { redact } = require('../src/utils/redact');

describe('Log/audit redaction', () => {
  it('masks sensitive top-level fields and preserves the rest', () => {
    const out = redact({
      firstName: 'Asha',
      password: 'Secret123!',
      panNumber: 'ABCDE1234F',
      salary: 500000,
      email: 'asha@example.com',
    });
    expect(out.firstName).toBe('Asha');
    expect(out.email).toBe('asha@example.com');
    expect(out.password).toBe('[REDACTED]');
    expect(out.panNumber).toBe('[REDACTED]');
    expect(out.salary).toBe('[REDACTED]');
  });

  it('masks sensitive fields inside nested objects and arrays', () => {
    const out = redact({
      employee: { aadharNumber: '234567890123', bankAccount: '123456789' },
      items: [{ accountNumber: '999', label: 'ok' }],
    });
    expect(out.employee.aadharNumber).toBe('[REDACTED]');
    expect(out.employee.bankAccount).toBe('[REDACTED]');
    expect(out.items[0].accountNumber).toBe('[REDACTED]');
    expect(out.items[0].label).toBe('ok');
  });

  it('does not mutate the original object', () => {
    const original = { password: 'x' };
    redact(original);
    expect(original.password).toBe('x');
  });
});
