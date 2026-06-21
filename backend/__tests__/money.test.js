const { roundMoney, sumMoney, mulMoney } = require('../src/utils/money');

describe('money utility', () => {
  it('rounds to the paisa', () => {
    expect(roundMoney(1234.5678)).toBe(1234.57);
    expect(roundMoney(1000)).toBe(1000);
    expect(roundMoney('2500.005')).toBe(2500.01); // the classic float mis-round, fixed
  });

  it('fixes the Math.round(1.005*100)/100 mis-round', () => {
    // Naive rounding returns 1.00; roundMoney returns 1.01.
    expect(Math.round(1.005 * 100) / 100).toBe(1.0); // demonstrates the bug
    expect(roundMoney(1.005)).toBe(1.01);            // demonstrates the fix
  });

  it('handles invalid input as 0', () => {
    expect(roundMoney(undefined)).toBe(0);
    expect(roundMoney(null)).toBe(0);
    expect(roundMoney('abc')).toBe(0);
  });

  it('sumMoney totals and rounds', () => {
    expect(sumMoney([0.1, 0.2])).toBe(0.3); // 0.1+0.2 = 0.30000000000000004 -> 0.30
    expect(sumMoney([1000.001, 2000.002, 3000.003])).toBe(6000.01);
  });

  it('mulMoney multiplies and rounds (e.g. PF 12%)', () => {
    expect(mulMoney(15000, 0.12)).toBe(1800);
    expect(mulMoney(12345.67, 0.12)).toBe(1481.48);
  });
});
