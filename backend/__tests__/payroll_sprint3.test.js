const calculator = require('../src/services/salaryService');

describe('Payroll Statutory Audit Compliance (Sprint 3)', () => {
  describe('EDLI Wage Ceiling Cap', () => {
    it('should cap EDLI wages at ₹15,000 even if Basic + DA exceeds ₹15,000', () => {
      // Wage is ₹25,000 (exceeds ₹15,000 cap)
      const resHigh = calculator.calculatePF(20000, 5000);
      expect(resHigh.edliCharges).toBe(75.0); // 0.5% of 15000

      // Wage is ₹10,000 (below ₹15,000 cap)
      const resLow = calculator.calculatePF(8000, 2000);
      expect(resLow.edliCharges).toBe(50.0); // 0.5% of 10000
    });
  });

  describe('Tamil Nadu Professional Tax Accumulation', () => {
    it('should return 0 professional tax for Tamil Nadu in non-deduction months', () => {
      // Tamil Nadu PT is deducted only in September (9) and March (3)
      const ptApril = calculator.calculatePT(40000, true, 'TAMIL_NADU', 'Male', 4);
      const ptAugust = calculator.calculatePT(40000, true, 'TAMIL_NADU', 'Male', 8);

      expect(ptApril).toBe(0);
      expect(ptAugust).toBe(0);
    });

    it('should return the full slab rate (uncut) for Tamil Nadu in March and September', () => {
      // Gross of 6000 per month (6000 * 6 = 36,000 semi-annual equivalent)
      // Slab: 30000 to 45000 -> semi-annual rate 315
      const ptSeptember = calculator.calculatePT(6000, true, 'TAMIL_NADU', 'Male', 9);
      const ptMarch = calculator.calculatePT(6000, true, 'TAMIL_NADU', 'Male', 3);

      expect(ptSeptember).toBe(315);
      expect(ptMarch).toBe(315);
    });
  });

  describe('Overtime double rate calculation u/s 59 of Factories Act', () => {
    it('should calculate Overtime pay using double the hourly rate of Basic + Allowance + DA', () => {
      const basic = 15000;
      const da = 3000;
      const allowances = 2000;
      const otHours = 10;
      // Total ordinary wages = 20,000
      // Hourly rate (stdHours = 176) = 20,000 / 176 = 113.636
      // Double rate (Multiplier 2.0) = 227.272
      // For 10 hours = 2272.72
      
      const otPay = calculator.calculateOTPay(basic, da, allowances, otHours);
      expect(otPay).toBeCloseTo(2272.73, 1);
    });
  });
});
