const calc = require('../src/services/salaryService');

/**
 * Reference-value tests for the core payroll/statutory math. These pin known
 * correct outputs (Indian statutory rules) so a regression in the money path
 * is caught, rather than only checking that endpoints return 200.
 */
describe('Payroll calculation correctness (statutory reference values)', () => {
  describe('EPF (12% of PF wages, capped at ₹15,000)', () => {
    it('basic ₹15,000 -> employee & employer PF = ₹1,800', () => {
      const pf = calc.calculatePF(15000, 0, true, 0);
      expect(pf.employeePf).toBe(1800);
      expect(pf.employerPf).toBe(1800);
    });

    it('basic ₹10,000 (below ceiling) -> employee PF = ₹1,200', () => {
      expect(calc.calculatePF(10000, 0, true, 0).employeePf).toBe(1200);
    });

    it('basic ₹30,000 is capped to the ₹15,000 ceiling -> employee PF = ₹1,800', () => {
      expect(calc.calculatePF(30000, 0, true, 0).employeePf).toBe(1800);
    });

    it('EPS portion never exceeds the statutory ₹1,250 cap', () => {
      const pf = calc.calculatePF(30000, 0, true, 0);
      expect(pf.employerEps).toBeLessThanOrEqual(1250);
      // Employer total still equals 12% of capped wages.
      expect(pf.employerPf).toBe(1800);
    });

    it('no PF when employee contribution is disabled', () => {
      const pf = calc.calculatePF(15000, 0, false, 0);
      expect(pf.employeePf).toBe(0);
      expect(pf.employerPf).toBe(0);
    });
  });

  describe('ESI (employee 0.75% / employer 3.25%, only if gross ≤ ₹21,000)', () => {
    it('gross ₹20,000 -> employee ₹150, employer ₹650', () => {
      const esi = calc.calculateESI(20000, true);
      expect(esi.employeeEsi).toBe(150);
      expect(esi.employerEsi).toBe(650);
    });

    it('gross ₹25,000 (above ceiling) -> no ESI', () => {
      const esi = calc.calculateESI(25000, true);
      expect(esi.employeeEsi).toBe(0);
      expect(esi.employerEsi).toBe(0);
    });

    it('no ESI when disabled', () => {
      expect(calc.calculateESI(20000, false).employeeEsi).toBe(0);
    });
  });

  describe('Gross earnings', () => {
    it('sums all salary components', () => {
      const gross = calc.calculateGrossEarnings({
        basicSalary: 30000, hra: 12000, da: 0, conveyance: 1600, medical: 1250, specialAllowance: 5000, otherAllowance: 0,
      });
      expect(gross).toBe(49850);
    });
  });

  describe('TDS / income tax (FY slabs, 4% cess)', () => {
    it('New regime: income under the ₹7L rebate threshold -> ₹0 TDS', () => {
      // 50k/mo = 6L/yr, taxable 5.25L < 7L rebate
      expect(calc.calculateTDS(50000, { regime: 'NEW' })).toBe(0);
    });

    it('New regime: ₹1,00,000/mo -> ₹5,958.33/mo', () => {
      // annual 12L, taxable 11.25L; tax 50000 + 18750 = 68750; +4% cess = 71500; /12
      expect(calc.calculateTDS(100000, { regime: 'NEW' })).toBe(5958.33);
    });

    it('Old regime (no deductions): ₹1,00,000/mo -> ₹13,650/mo', () => {
      // taxable 11.5L; tax 112500 + 45000 = 157500; +cess = 163800; /12
      expect(calc.calculateTDS(100000, { regime: 'OLD' })).toBe(13650);
    });

    it('Old regime: ₹1.5L 80C deduction lowers the tax', () => {
      // taxable 10L; tax 12500 + 100000 = 112500; +cess = 117000; /12 = 9750
      expect(calc.calculateTDS(100000, { regime: 'OLD', section80C: 150000 })).toBe(9750);
    });

    it('zero income -> ₹0', () => {
      expect(calc.calculateTDS(0, { regime: 'NEW' })).toBe(0);
    });

    it('TDS is monotonic in income', () => {
      const a = calc.calculateTDS(90000, { regime: 'NEW' });
      const b = calc.calculateTDS(120000, { regime: 'NEW' });
      expect(b).toBeGreaterThan(a);
    });
  });
});
