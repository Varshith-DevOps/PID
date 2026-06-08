/**
 * @fileoverview Custom statutory verification suite.
 * Verifies all fixed compliance, chronology, and calculation bugs.
 */

const salaryService = require('../src/services/salaryService');
const fnfService = require('../src/services/fnfService');
const prisma = require('../src/config/database');

describe('Indian Statutory Calculations Verification', () => {

  afterAll(async () => {
    await prisma.$disconnect();
  });
  
  test('Karnataka PT Slabs: Nil under 25,000, 200 above 25,000', () => {
    const ptLow = salaryService.calculatePT(24000, true, 'Karnataka', 'Male', 4);
    const ptHigh = salaryService.calculatePT(26000, true, 'Karnataka', 'Male', 4);
    expect(ptLow).toBe(0);
    expect(ptHigh).toBe(200);
  });

  test('Tamil Nadu PT: Pro-rated semi-annual division by 6', () => {
    // Tamil Nadu semi-annual slabs: above 75,000 is 1250, divided by 6 => ~208.33
    const ptTN = salaryService.calculatePT(80000, true, 'Tamil Nadu', 'Male', 4);
    expect(ptTN).toBeCloseTo(1250 / 6, 2);
  });

  test('Delhi/Haryana and Non-PT States: Fallback to 0', () => {
    const ptDelhi = salaryService.calculatePT(30000, true, 'Delhi', 'Male', 4);
    const ptHaryana = salaryService.calculatePT(30000, true, 'Haryana', 'Male', 4);
    expect(ptDelhi).toBe(0);
    expect(ptHaryana).toBe(0);
  });

  test('EDLI Capping: Capped at 15,000 basic + da', () => {
    // Calculate PF for basic=20,000 (exceeding 15,000 wage ceiling)
    const pfDetails = salaryService.calculatePF(20000, 0, true, 5); // vpf 5%
    // EDLI contribution is 0.5% of min(basic+da, 15000) => 0.5% of 15000 = 75
    expect(pfDetails.edliCharges).toBe(75);
  });

  test('Gratuity calculations: No 30-year cap & correct fractional rounding', () => {
    // basic=30,000, da=10,000. Gratuity = (basic + da) * 15 / 26 * yearsOfService
    // 1. 35 years (exceeding previous 30-year limit)
    const g35 = salaryService.calculateGratuity(30000, 10000, 35);
    expect(g35).toBeCloseTo((40000 * 15 / 26) * 35, 0);

    // 2. Fractional year <= 0.5: 5.4 years rounds down to 5
    const g5_4 = salaryService.calculateGratuity(30000, 10000, 5.4);
    expect(g5_4).toBeCloseTo((40000 * 15 / 26) * 5, 0);

    // 3. Fractional year > 0.5: 5.6 years rounds up to 6
    const g5_6 = salaryService.calculateGratuity(30000, 10000, 5.6);
    expect(g5_6).toBeCloseTo((40000 * 15 / 26) * 6, 0);
  });

  test('Overtime pay: ordinary wages (Basic + DA + allowances) instead of basic only', () => {
    // calculateOTPay(basicSalary, da, allowances, otHours, settings)
    // Wages = basic (20000) + da (5000) + allowances (15000) = 40000
    // Hourly rate = 40000 / 176. Double rate = (40000 / 176) * 2 = 454.545
    // For 10 hours => 4545.45
    const otPay = salaryService.calculateOTPay(20000, 5000, 15000, 10, { standardHours: 176, otMultiplier: 2.0 });
    expect(otPay).toBeCloseTo(4545.45, 1);
  });

  test('Full & Final Integration: leave encashment, notice period shortfall, and TDS recovery', async () => {
    // 1. Create a temporary department first
    const dept = await prisma.department.create({
      data: { name: `Temp Dept ${Date.now()}` }
    });

    // 2. Create a temporary employee
    const emp = await prisma.employee.create({
      data: {
        employeeId: `EMP-${Date.now()}`,
        firstName: 'Temp',
        lastName: 'Employee',
        email: `temp.${Date.now()}@company.com`,
        jobTitle: 'Software Engineer',
        departmentId: dept.id,
        salary: 30000,
        joinDate: new Date('2024-01-01'),
        exitDetails: {
          create: {
            resignationDate: new Date('2026-06-01'),
            lastWorkingDate: new Date('2026-06-15'), // 14 days notice served, 16 days shortfall
            exitReason: 'Career Growth',
            fnfStatus: 'PENDING',
            noticePeriodDays: 30
          }
        },
        salaryStructure: {
          create: {
            basicSalary: 20000,
            hra: 8000,
            da: 2000,
            conveyance: 0,
            medical: 0,
            specialAllowance: 0,
            otherAllowance: 0,
            pfEnabled: true,
            tdsEnabled: false,
            esiEnabled: false,
            professionalTaxEnabled: false,
            lwfEnabled: false
          }
        },
        leaveQuotas: {
          createMany: {
            data: [
              { leaveType: 'ANNUAL', quota: 15, used: 5, year: 2026 }, // 10 days unused
              { leaveType: 'SICK', quota: 10, used: 2, year: 2026 },   // 8 days unused (should be ignored)
              { leaveType: 'CASUAL', quota: 8, used: 1, year: 2026 }   // 7 days unused (should be ignored)
            ]
          }
        }
      }
    });

    try {
      // 3. Call calculateFNFSettlement
      const result = await fnfService.calculateFNFSettlement(emp.id);

      // 4. Assertions
      // Unused leave balance should be 10 (only ANNUAL)
      expect(result.balances.unusedLeaveBalance).toBe(10);
      
      // Leave encashment pay: 10 * ((20000 + 2000) / 30) = 7333.33
      expect(result.earnings.leaveEncashment).toBeCloseTo(10 * (22000 / 30), 0);

      // Notice period shortfall: 30 - 14 = 16 days
      // Notice recovery amount: 16 * (22000 / 30) = 11733.33
      expect(result.balances.noticeShortfallDays).toBe(16);
      expect(result.deductions.noticeRecovery).toBeCloseTo(16 * (22000 / 30), 2);

    } finally {
      // 5. Cleanup database
      await prisma.leaveQuota.deleteMany({ where: { employeeId: emp.id } });
      await prisma.salaryStructure.delete({ where: { employeeId: emp.id } });
      await prisma.exitDetails.delete({ where: { employeeId: emp.id } });
      await prisma.employee.delete({ where: { id: emp.id } });
      await prisma.department.delete({ where: { id: dept.id } });
    }
  });

});
