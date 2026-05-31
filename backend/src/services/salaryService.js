/**
 * @fileoverview Salary calculation service.
 * Implements Indian payroll calculations including PF (Provident Fund),
 * ESI (Employee State Insurance), Professional Tax, TDS (Tax Deducted at Source),
 * Gratuity, and overtime pay. Supports proportional salary for partial months.
 *
 * Tax Regime: New Tax Regime (FY 2025-26) with standard deduction of ₹75,000.
 * Section 87A rebate: Nil tax for taxable income up to ₹7,00,000.
 *
 * @module services/salaryService
 */

/**
 * Salary calculator with configurable rates for PF, ESI, PT, and overtime.
 * Maintains a singleton instance with settings that can be updated from the database.
 */
class SalaryCalculator {
  constructor() {
    this.pfRate = 0.12;
    this.maxPf = 2160;
    this.gratuityRate = 0.0481;
    this.otMultiplier = 1.5;
    this.standardHours = 176;
    this.ptRate = 200.0;
    this.esiRateEmployee = 0.0075;
    this.esiRateEmployer = 0.0325;
    this.esiGrossCeiling = 21000.0;
    this.pfWageCeiling = 15000.0;
    this.restrictPfToCeiling = true;
  }

  getSettings() {
    return {
      pfRate: this.pfRate,
      maxPf: this.maxPf,
      gratuityRate: this.gratuityRate,
      otMultiplier: this.otMultiplier,
      standardHours: this.standardHours,
      ptRate: this.ptRate,
      esiRateEmployee: this.esiRateEmployee,
      esiRateEmployer: this.esiRateEmployer,
      esiGrossCeiling: this.esiGrossCeiling,
      pfWageCeiling: this.pfWageCeiling,
      restrictPfToCeiling: this.restrictPfToCeiling,
    };
  }

  updateSettings(settings) {
    if (settings.pfRate !== undefined) this.pfRate = Number(settings.pfRate);
    if (settings.maxPf !== undefined) this.maxPf = Number(settings.maxPf);
    if (settings.gratuityRate !== undefined) this.gratuityRate = Number(settings.gratuityRate);
    if (settings.otMultiplier !== undefined) this.otMultiplier = Number(settings.otMultiplier);
    if (settings.standardHours !== undefined) this.standardHours = Number(settings.standardHours);
    if (settings.ptRate !== undefined) this.ptRate = Number(settings.ptRate);
    if (settings.esiRateEmployee !== undefined) this.esiRateEmployee = Number(settings.esiRateEmployee);
    if (settings.esiRateEmployer !== undefined) this.esiRateEmployer = Number(settings.esiRateEmployer);
    if (settings.esiGrossCeiling !== undefined) this.esiGrossCeiling = Number(settings.esiGrossCeiling);
    if (settings.pfWageCeiling !== undefined) this.pfWageCeiling = Number(settings.pfWageCeiling);
    if (settings.restrictPfToCeiling !== undefined) this.restrictPfToCeiling = Boolean(settings.restrictPfToCeiling);
  }

  calculateOTPay(basicSalary, otHours) {
    const hourlyRate = basicSalary / this.standardHours;
    const otRate = hourlyRate * this.otMultiplier;
    return Math.round(otHours * otRate * 100) / 100;
  }

  calculatePF(basicSalary, da = 0, employeeContribution = true) {
    if (!employeeContribution) return { employeePf: 0, employerPf: 0, employerEps: 0, employerEpf: 0, adminCharges: 0, edliCharges: 0 };

    const pfWages = this.restrictPfToCeiling
      ? Math.min(basicSalary + da, this.pfWageCeiling)
      : (basicSalary + da);

    // Employee contributes 12% to EPF
    const employeePf = pfWages * this.pfRate;

    // Employer's 12% is split: 8.33% to EPS (capped at ₹15,000 wages = max ₹1,250), rest to EPF
    const epsWages = Math.min(basicSalary + da, this.pfWageCeiling);
    const employerEps = Math.min(epsWages * 0.0833, 1250);
    const employerEpf = (pfWages * this.pfRate) - employerEps;
    const employerPf = employerEps + employerEpf;

    // Admin charges: 0.5% of PF wages, EDLI: 0.5% of PF wages
    const adminCharges = Math.round(pfWages * 0.005 * 100) / 100;
    const edliCharges = Math.round(pfWages * 0.005 * 100) / 100;

    return {
      employeePf: Math.round(employeePf * 100) / 100,
      employerPf: Math.round(employerPf * 100) / 100,
      employerEps: Math.round(employerEps * 100) / 100,
      employerEpf: Math.round(employerEpf * 100) / 100,
      adminCharges,
      edliCharges,
    };
  }

  /**
   * Calculate ESI contributions.
   * @param {number} grossEarnings - Monthly gross earnings
   * @param {boolean} enabled - Whether ESI is enabled for the employee
   * @param {boolean} esiCycleEligible - Whether the employee was eligible at the start of the current
   *   ESI contribution cycle (Apr-Sep or Oct-Mar). If true, contributions continue even if gross
   *   exceeds the ceiling mid-cycle, per the ESI Act.
   */
  calculateESI(grossEarnings, enabled = true, esiCycleEligible = null) {
    // If ESI is globally disabled for this employee, skip
    if (!enabled) {
      return { employeeEsi: 0, employerEsi: 0 };
    }

    // If cycle eligibility was explicitly determined, use it;
    // otherwise fall back to current-month ceiling check
    const isEligible = esiCycleEligible !== null
      ? esiCycleEligible
      : (grossEarnings <= this.esiGrossCeiling);

    if (!isEligible) {
      return { employeeEsi: 0, employerEsi: 0 };
    }

    const employeeEsi = grossEarnings * this.esiRateEmployee;
    const employerEsi = grossEarnings * this.esiRateEmployer;

    return {
      employeeEsi: Math.round(employeeEsi * 100) / 100,
      employerEsi: Math.round(employerEsi * 100) / 100,
    };
  }

  /**
   * Calculate Professional Tax based on state-specific slabs.
   * Supports Maharashtra, Karnataka, West Bengal, Telangana, and a default fallback.
   * @param {number} grossEarnings - Monthly gross earnings
   * @param {boolean} enabled - Whether PT is enabled for the employee
   * @param {string} state - Indian state code (e.g. 'Maharashtra', 'Karnataka')
   * @param {string} gender - 'Male' or 'Female' (for state-specific exemptions)
   * @param {number} month - Calendar month (1-12), used for state-specific anomalies
   */
  calculatePT(grossEarnings, enabled = true, state = 'DEFAULT', gender = 'Male', month = null) {
    if (!enabled) return 0;

    const currentMonth = month || (new Date().getMonth() + 1);

    switch (state) {
      case 'Maharashtra':
        if (gender === 'Female' && grossEarnings <= 25000) return 0;
        if (grossEarnings <= 7500) return 0;
        if (grossEarnings <= 10000) return 175;
        // February anomaly: ₹300 in Feb to round up annual total to ₹2,500
        return currentMonth === 2 ? 300 : 200;

      case 'Karnataka':
        if (grossEarnings <= 15000) return 0;
        if (grossEarnings <= 20000) return 150;
        return 200;

      case 'West Bengal':
        if (grossEarnings <= 10000) return 0;
        if (grossEarnings <= 15000) return 110;
        if (grossEarnings <= 25000) return 130;
        if (grossEarnings <= 40000) return 150;
        return 200;

      case 'Telangana':
        if (grossEarnings <= 15000) return 0;
        if (grossEarnings <= 20000) return 150;
        return 200;

      default:
        // Generic fallback for states without specific rules
        if (grossEarnings <= 25000) return 0;
        return this.ptRate;
    }
  }

  /**
   * Calculate gratuity per the Payment of Gratuity Act, 1972.
   * Eligibility: 5 years of continuous service (except death/disablement).
   * Formula: (Basic + DA) / 26 * 15 * completed years of service.
   * @param {number} basicSalary - Monthly basic salary
   * @param {number} da - Monthly dearness allowance (defaults to 0)
   * @param {number} yearsOfService - Total years of service
   */
  calculateGratuity(basicSalary, da = 0, yearsOfService) {
    // Statutory eligibility: minimum 5 years of continuous service
    if (yearsOfService < 5) return 0;

    // Use completed (whole) years, capped at 30
    const completedYears = Math.min(Math.floor(yearsOfService), 30);
    // Statutory divisor: 26 working days per month (not 365 calendar days)
    const monthlyWages = basicSalary + da;
    const gratuity = (monthlyWages / 26) * 15 * completedYears;

    return Math.round(gratuity * 100) / 100;
  }

  /**
   * Calculate TDS (Tax Deducted at Source).
   * Supports both Old and New tax regimes with investment declarations.
   * @param {number} monthlyGross - Monthly gross salary
   * @param {Object} taxOptions - Tax calculation options
   * @param {string} taxOptions.regime - 'NEW' or 'OLD' (defaults to 'NEW')
   * @param {number} taxOptions.section80C - Annual 80C deductions (PPF, ELSS, etc.)
   * @param {number} taxOptions.section80D - Annual 80D deductions (health insurance)
   * @param {number} taxOptions.homeLoanInterest - Annual home loan interest (Section 24b)
   * @param {number} taxOptions.hraExemption - Annual HRA exemption (Section 10(13A))
   * @param {number} taxOptions.otherDeductions - Any other eligible annual deductions
   */
  calculateTDS(monthlyGross, taxOptions = {}) {
    const regime = taxOptions.regime || 'NEW';
    const annualGross = monthlyGross * 12;

    let taxableIncome;

    if (regime === 'OLD') {
      // Old Regime: Standard deduction ₹50,000 + various chapter VI-A deductions
      const standardDeduction = 50000;
      const sec80C = Math.min(taxOptions.section80C || 0, 150000); // Cap at ₹1.5L
      const sec80D = Math.min(taxOptions.section80D || 0, 75000);  // Cap at ₹75K (senior citizen + family)
      const homeLoan = Math.min(taxOptions.homeLoanInterest || 0, 200000); // Cap at ₹2L
      const hraExemption = taxOptions.hraExemption || 0;
      const otherDeductions = taxOptions.otherDeductions || 0;

      const totalDeductions = standardDeduction + sec80C + sec80D + homeLoan + hraExemption + otherDeductions;
      taxableIncome = Math.max(0, annualGross - totalDeductions);

      // Old regime tax slabs (FY 2025-26)
      let annualTax = 0;
      if (taxableIncome <= 250000) {
        annualTax = 0;
      } else if (taxableIncome <= 500000) {
        annualTax = (taxableIncome - 250000) * 0.05;
      } else if (taxableIncome <= 1000000) {
        annualTax = 12500 + (taxableIncome - 500000) * 0.20;
      } else {
        annualTax = 112500 + (taxableIncome - 1000000) * 0.30;
      }

      // Section 87A rebate (old regime): Nil tax for taxable income up to ₹5,00,000
      if (taxableIncome <= 500000) annualTax = 0;

      // Surcharge for high incomes
      if (taxableIncome > 5000000 && taxableIncome <= 10000000) {
        annualTax *= 1.10; // 10% surcharge
      } else if (taxableIncome > 10000000 && taxableIncome <= 20000000) {
        annualTax *= 1.15; // 15% surcharge
      } else if (taxableIncome > 20000000 && taxableIncome <= 50000000) {
        annualTax *= 1.25; // 25% surcharge
      } else if (taxableIncome > 50000000) {
        annualTax *= 1.37; // 37% surcharge
      }

      // 4% Health & Education Cess
      const cess = annualTax * 0.04;
      const totalAnnualTax = annualTax + cess;
      return Math.round((totalAnnualTax / 12) * 100) / 100;
    }

    // New Regime (default)
    const standardDeduction = 75000;
    taxableIncome = Math.max(0, annualGross - standardDeduction);

    // Section 87A Tax Rebate for taxable income up to 7 Lakhs (Nil Tax)
    if (taxableIncome <= 700000) {
      return 0;
    }

    let annualTax = 0;
    if (taxableIncome <= 300000) {
      annualTax = 0;
    } else if (taxableIncome <= 700000) {
      annualTax = (taxableIncome - 300000) * 0.05;
    } else if (taxableIncome <= 1000000) {
      annualTax = 20000 + (taxableIncome - 700000) * 0.10;
    } else if (taxableIncome <= 1200000) {
      annualTax = 50000 + (taxableIncome - 1000000) * 0.15;
    } else if (taxableIncome <= 1500000) {
      annualTax = 80000 + (taxableIncome - 1200000) * 0.20;
    } else {
      annualTax = 140000 + (taxableIncome - 1500000) * 0.30;
    }

    // Surcharge for high incomes (new regime)
    if (taxableIncome > 5000000 && taxableIncome <= 10000000) {
      annualTax *= 1.10;
    } else if (taxableIncome > 10000000 && taxableIncome <= 20000000) {
      annualTax *= 1.15;
    } else if (taxableIncome > 20000000) {
      annualTax *= 1.25; // New regime caps surcharge at 25%
    }

    // Add 4% Health & Education Cess
    const cess = annualTax * 0.04;
    const totalAnnualTax = annualTax + cess;
    const monthlyTDS = totalAnnualTax / 12;

    return Math.round(monthlyTDS * 100) / 100;
  }

  calculateGrossEarnings(structure) {
    return (
      structure.basicSalary +
      structure.hra +
      structure.da +
      (structure.conveyance || structure.conveyence || 0) +
      structure.medical +
      structure.specialAllowance +
      structure.otherAllowance
    );
  }

  calculateTotalDeductions(structure, options = {}) {
    const monthlyGross = this.calculateGrossEarnings(structure);
    const pf = this.calculatePF(structure.basicSalary, structure.da || 0, options.employeePf !== false);
    const esi = this.calculateESI(monthlyGross, structure.esiEnabled !== false, options.esiCycleEligible !== undefined ? options.esiCycleEligible : null);
    const pt = this.calculatePT(monthlyGross, structure.professionalTaxEnabled !== false, options.state || 'DEFAULT', options.gender || 'Male', options.month || null);
    const tds = options.tdsEnabled ? this.calculateTDS(monthlyGross, options.taxOptions || {}) : 0;

    return {
      employeePf: pf.employeePf,
      employerPf: pf.employerPf,
      employeeEsi: esi.employeeEsi,
      employerEsi: esi.employerEsi,
      professionalTax: pt,
      tds: tds,
      tdsBreakdown: {
        gross: monthlyGross,
        annualGross: monthlyGross * 12,
        monthlyTax: tds,
        annualTax: tds * 12,
        taxSlab: this.getTaxSlab(Math.max(0, monthlyGross * 12 - 75000)),
      },
      insurance: structure.insurance || 0,
      otherDeductions: structure.otherDeduction || 0,
    };
  }

  getTaxSlab(annualNetTaxable) {
    if (annualNetTaxable <= 300000) return 'Nil';
    if (annualNetTaxable <= 700000) return '5%';
    if (annualNetTaxable <= 1000000) return '10%';
    if (annualNetTaxable <= 1200000) return '15%';
    if (annualNetTaxable <= 1500000) return '20%';
    return '30%';
  }

  calculateNetSalary(structure, options = {}) {
    const grossEarnings = this.calculateGrossEarnings(structure);
    const deductions = this.calculateTotalDeductions(structure, options);

    const employeeDeductions =
      deductions.employeePf +
      deductions.employeeEsi +
      deductions.professionalTax +
      deductions.tds +
      deductions.insurance +
      deductions.otherDeductions;

    const totalDeductions = employeeDeductions;
    const netSalary = grossEarnings - totalDeductions;

    const monthlyGross = grossEarnings;
    const annualCost = monthlyGross * 12 + deductions.employerPf * 12 + deductions.employerEsi * 12;

    return {
      grossEarnings,
      employeeDeductions,
      totalDeductions,
      netSalary,
      breakdowns: {
        earnings: {
          basicSalary: structure.basicSalary,
          hra: structure.hra,
          da: structure.da,
          conveyance: structure.conveyance || structure.conveyence || 0,
          medical: structure.medical,
          specialAllowance: structure.specialAllowance,
          otherAllowance: structure.otherAllowance,
        },
        deductions: {
          employeePf: deductions.employeePf,
          employerPf: deductions.employerPf,
          employeeEsi: deductions.employeeEsi,
          employerEsi: deductions.employerEsi,
          professionalTax: deductions.professionalTax,
          tds: deductions.tds,
          insurance: deductions.insurance,
          otherDeductions: deductions.otherDeductions,
        },
        monthlyBreakdown: {
          grossEarnings,
          employeePf: deductions.employeePf,
          employeeEsi: deductions.employeeEsi,
          professionalTax: deductions.professionalTax,
          tds: deductions.tds,
          insurance: deductions.insurance,
          other: deductions.otherDeductions,
        },
      },
      annual: {
        grossSalary: monthlyGross * 12,
        employerContribution: (deductions.employerPf + deductions.employerEsi) * 12,
        tds: deductions.tds * 12,
        totalCostToCompany: annualCost,
        taxSlab: deductions.tdsBreakdown.taxSlab,
      },
    };
  }

  calculateProportionalSalary(structure, daysWorked, workDays, options = {}) {
    const proportion = daysWorked / workDays;

    const baseSalary = structure.basicSalary * proportion;
    const daSalary = (structure.da || 0) * proportion;
    const earnings = {
      basicSalary: Math.round(baseSalary * 100) / 100,
      hra: Math.round(structure.hra * proportion * 100) / 100,
      da: Math.round((structure.da || 0) * proportion * 100) / 100,
      conveyance: Math.round((structure.conveyance || structure.conveyence || 0) * proportion * 100) / 100,
      medical: Math.round(structure.medical * proportion * 100) / 100,
      specialAllowance: Math.round(structure.specialAllowance * proportion * 100) / 100,
      otherAllowance: Math.round(structure.otherAllowance * proportion * 100) / 100,
    };

    const monthlyGross = Object.values(earnings).reduce((a, b) => a + b, 0);
    const pf = this.calculatePF(baseSalary, daSalary, options.employeePf !== false);
    const esi = this.calculateESI(monthlyGross, structure.esiEnabled !== false, options.esiCycleEligible !== undefined ? options.esiCycleEligible : null);
    const pt = this.calculatePT(monthlyGross, structure.professionalTaxEnabled !== false, options.state || 'DEFAULT', options.gender || 'Male', options.month || null);
    const tds = options.tdsEnabled ? this.calculateTDS(monthlyGross, options.taxOptions || {}) : 0;

    const employeeDeductions =
      pf.employeePf +
      esi.employeeEsi +
      pt +
      tds +
      (structure.insurance || 0) * proportion +
      (structure.otherDeduction || 0) * proportion;

    const netSalary = monthlyGross - employeeDeductions;

    return {
      grossEarnings: Math.round(monthlyGross * 100) / 100,
      totalDeductions: Math.round(employeeDeductions * 100) / 100,
      netSalary: Math.round(netSalary * 100) / 100,
      daysWorked,
      proportion: (proportion * 100).toFixed(1) + '%',
      breakdowns: {
        earnings,
        deductions: {
          employeePf: pf.employeePf,
          employerPf: pf.employerPf,
          employeeEsi: esi.employeeEsi,
          employerEsi: esi.employerEsi,
          professionalTax: pt,
          tds: tds,
          insurance: Math.round((structure.insurance || 0) * proportion * 100) / 100,
          otherDeductions: Math.round((structure.otherDeduction || 0) * proportion * 100) / 100,
        },
      },
    };
  }

  calculateAllEmployees(employees, attendances) {
    return employees.map((employee) => {
      const structure = employee.salaryStructure;
      if (!structure) {
        return { employeeId: employee.id, error: 'No salary structure' };
      }

      const attendance = attendances.find((a) => a.employeeId === employee.id);
      const daysWorked = attendance?.workDays || 20;
      const workDays = 20;

      return {
        employee: {
          id: employee.id,
          firstName: employee.firstName,
          lastName: employee.lastName,
          employeeId: employee.employeeId,
        },
        calculation:
          daysWorked < workDays
            ? this.calculateProportionalSalary(structure, daysWorked, workDays)
            : this.calculateNetSalary(structure),
      };
    });
  }
}

const salaryCalculator = new SalaryCalculator();

module.exports = salaryCalculator;
