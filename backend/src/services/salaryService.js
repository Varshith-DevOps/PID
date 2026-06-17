/**
 * @fileoverview Salary calculation service.
 * Implements Indian payroll calculations including PF (Provident Fund),
 * ESI (Employee State Insurance), Professional Tax, TDS (Tax Deducted at Source),
 * Gratuity, and overtime pay. Supports proportional salary for partial months.
 * Fully compliant with Indian payroll regulations and statutory ceilings.
 *
 * @module services/salaryService
 */

const STATUTORY_CONSTANTS = require('./statutoryConstants');
const { projectTDS } = require('./tdsEngine');

class SalaryCalculator {
  constructor() {
    this.pfRate = STATUTORY_CONSTANTS.PF.EMPLOYEE_RATE;
    this.maxPf = STATUTORY_CONSTANTS.PF.WAGE_CEILING * STATUTORY_CONSTANTS.PF.EMPLOYEE_RATE; // 1800
    this.gratuityRate = STATUTORY_CONSTANTS.GRATUITY.FORMULA_MULTIPLIER;
    this.otMultiplier = 1.5;
    this.standardHours = 176;
    this.ptRate = STATUTORY_CONSTANTS.PT.DEFAULT_RATE;
    this.esiRateEmployee = STATUTORY_CONSTANTS.ESI.EMPLOYEE_RATE;
    this.esiRateEmployer = STATUTORY_CONSTANTS.ESI.EMPLOYER_RATE;
    this.esiGrossCeiling = STATUTORY_CONSTANTS.ESI.GROSS_CEILING;
    this.pfWageCeiling = STATUTORY_CONSTANTS.PF.WAGE_CEILING;
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

  calculateOTPay(basicSalary, daOrOtHours = 0, allowances = 0, otHours = null, settings = {}) {
    let da = 0;
    let otHrs = 0;
    let otMult = this.otMultiplier;
    let stdHrs = this.standardHours;

    if (otHours === null) {
      // Called with old signature: calculateOTPay(basicSalary, otHours)
      otHrs = Number(daOrOtHours);
    } else {
      // Called with new signature: calculateOTPay(basicSalary, da, allowances, otHours, settings)
      da = Number(daOrOtHours);
      otHrs = Number(otHours);
      if (settings?.otMultiplier !== undefined) otMult = Number(settings.otMultiplier);
      if (settings?.standardHours !== undefined) stdHrs = Number(settings.standardHours);
    }

    const ordinaryWages = basicSalary + da + allowances;
    const hourlyRate = ordinaryWages / stdHrs;
    const otRate = hourlyRate * otMult;
    return Math.round(otHrs * otRate * 100) / 100;
  }

  /**
   * Calculate PF split including VPF.
   * @param {number} basicSalary 
   * @param {number} da 
   * @param {boolean} employeeContribution 
   * @param {number} vpfPercentage - Voluntary PF percentage
   */
  calculatePF(basicSalary, da = 0, employeeContribution = true, vpfPercentage = 0) {
    if (!employeeContribution) {
      return { employeePf: 0, employerPf: 0, employerEps: 0, employerEpf: 0, adminCharges: 0, edliCharges: 0, vpfAmount: 0 };
    }

    const pfWages = this.restrictPfToCeiling
      ? Math.min(basicSalary + da, this.pfWageCeiling)
      : (basicSalary + da);

    // Employee statutory contribution (12% of PF wages)
    const employeePf = pfWages * this.pfRate;

    // VPF is calculated on the same PF wages (or actual basic + DA if specified, but usually basic + DA)
    // Capped at 100% of basic + DA minus statutory PF
    const actualWages = basicSalary + da;
    const rawVpf = actualWages * (vpfPercentage / 100);
    const maxVpf = Math.max(0, actualWages - employeePf);
    const vpfAmount = Math.min(rawVpf, maxVpf);

    // Employer's 12% is split: 8.33% to EPS (capped at ₹15,000 wages = max ₹1,250), rest to EPF
    const epsWages = Math.min(basicSalary + da, this.pfWageCeiling);
    const employerEps = Math.min(epsWages * STATUTORY_CONSTANTS.PF.EPS_RATE, 1250);
    const employerEpf = (pfWages * this.pfRate) - employerEps;
    const employerPf = employerEps + employerEpf;

    // Admin charges (0.5% of PF wages) & EDLI (0.5% of PF wages capped at statutory ₹15,000 ceiling)
    const adminCharges = Math.round(pfWages * STATUTORY_CONSTANTS.PF.ADMIN_CHARGES_RATE * 100) / 100;
    const edliWages = Math.min(basicSalary + da, STATUTORY_CONSTANTS.PF.WAGE_CEILING);
    const edliCharges = Math.round(edliWages * STATUTORY_CONSTANTS.PF.EDLI_RATE * 100) / 100;

    return {
      employeePf: Math.round(employeePf * 100) / 100,
      employerPf: Math.round(employerPf * 100) / 100,
      employerEps: Math.round(employerEps * 100) / 100,
      employerEpf: Math.round(employerEpf * 100) / 100,
      adminCharges,
      edliCharges,
      vpfAmount: Math.round(vpfAmount * 100) / 100
    };
  }

  /**
   * Calculate ESI contributions.
   */
  calculateESI(grossEarnings, enabled = true, esiCycleEligible = null) {
    if (!enabled) {
      return { employeeEsi: 0, employerEsi: 0 };
    }

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
   * Calculate State-wise Professional Tax using consolidated STATUTORY_CONSTANTS.
   */
  calculatePT(grossEarnings, enabled = true, state = 'DEFAULT', gender = 'Male', month = null) {
    if (!enabled) return 0;

    const stateKey = state.toUpperCase().replace(/\s/g, '_');
    const slabs = STATUTORY_CONSTANTS.PT.SLABS[stateKey] || STATUTORY_CONSTANTS.PT.SLABS[state] || null;

    if (!slabs) {
      if (state && state !== 'DEFAULT') {
        return 0; // State explicitly set to a state without PT (e.g. Delhi, Haryana)
      }
      // Fallback default
      return grossEarnings <= 25000 ? 0 : this.ptRate;
    }

    const currentMonth = month || (new Date().getMonth() + 1);
    const upperGender = gender.toUpperCase();

    for (const slab of slabs) {
      const checkGross = stateKey === 'TAMIL_NADU' ? grossEarnings * 6 : grossEarnings;
      if (checkGross > slab.min && checkGross <= slab.max) {
        // Gender filter
        if (slab.gender !== 'ALL' && slab.gender !== upperGender) {
          continue;
        }
        // February anomaly handling
        let rate = slab.rate;
        if (currentMonth === 2 && slab.febRate !== undefined) {
          rate = slab.febRate;
        }

        // Tamil Nadu semi-annual rate pro-rating (divided by 6)
        if (stateKey === 'TAMIL_NADU') {
          return Math.round((rate / 6) * 100) / 100;
        }
        return rate;
      }
    }

    return 0;
  }

  /**
   * Calculate Labour Welfare Fund (LWF) contributions.
   */
  calculateLWF(grossEarnings, enabled = true, state = 'DEFAULT', month = null) {
    if (!enabled) return { employeeLwf: 0, employerLwf: 0 };

    const stateKey = state.toUpperCase().replace(/\s/g, '_');
    const rules = STATUTORY_CONSTANTS.LWF.SLABS[stateKey] || STATUTORY_CONSTANTS.LWF.SLABS[state] || null;

    if (!rules) {
      return { employeeLwf: 0, employerLwf: 0 };
    }

    const currentMonth = month || (new Date().getMonth() + 1);
    if (!rules.DEDUCTION_MONTHS.includes(currentMonth)) {
      return { employeeLwf: 0, employerLwf: 0 };
    }

    if (grossEarnings > rules.GROSS_CEILING) {
      return { employeeLwf: 0, employerLwf: 0 };
    }

    return {
      employeeLwf: rules.EMPLOYEE_RATE,
      employerLwf: rules.EMPLOYER_RATE
    };
  }

  /**
   * Calculate NPS contribution.
   */
  calculateNPS(basicSalary, da = 0, enabled = false, employeeRate = 10, employerRate = 10) {
    if (!enabled) {
      return { employeeNps: 0, employerNps: 0 };
    }

    const npsWages = basicSalary + da;
    const employeeNps = npsWages * (employeeRate / 100);
    
    // Employer NPS contribution is capped at private sector limit of 10%
    const maxEmployerNpsRate = Math.min(employerRate, STATUTORY_CONSTANTS.NPS.MAX_EMPLOYER_CONTRIBUTION_PCT_PRIVATE * 100);
    const employerNps = npsWages * (maxEmployerNpsRate / 100);

    return {
      employeeNps: Math.round(employeeNps * 100) / 100,
      employerNps: Math.round(employerNps * 100) / 100
    };
  }

  /**
   * Calculate gratuity per the Payment of Gratuity Act, 1972.
   * Eligibility: 5 years of continuous service (except death/disablement).
   * Supports 4 years 240 days rule.
   * Capped at statutory ceiling of ₹25 Lakhs.
   */
  calculateGratuity(basicSalary, da = 0, yearsOfService, totalWorkingDays = null, exitReason = null) {
    const isDeathOrDisablement = exitReason === 'DEATH' || exitReason === 'DISABLEMENT';
    
    // Check eligibility
    let isEligible = false;
    if (isDeathOrDisablement) {
      isEligible = true;
    } else if (yearsOfService >= 5) {
      isEligible = true;
    } else if (yearsOfService >= 4.0 && totalWorkingDays !== null && totalWorkingDays >= STATUTORY_CONSTANTS.GRATUITY.SERVICE_DAYS_MIN_FOR_4Y_240D) {
      isEligible = true;
    }

    if (!isEligible) return 0;

    const frac = yearsOfService - Math.floor(yearsOfService);
    const completedYears = frac >= 0.5 ? Math.ceil(yearsOfService) : Math.floor(yearsOfService);
    const monthlyWages = basicSalary + da;
    const gratuity = (monthlyWages * STATUTORY_CONSTANTS.GRATUITY.FORMULA_MULTIPLIER) * completedYears;

    // Cap at the statutory ceiling (₹2,500,000)
    return Math.round(Math.min(gratuity, STATUTORY_CONSTANTS.GRATUITY.CEILING) * 100) / 100;
  }

  /**
   * Legacy synchronous TDS fallback calculation.
   */
  calculateTDS(monthlyGross, taxOptions = {}) {
    const regime = taxOptions.regime || 'NEW';
    const annualGross = monthlyGross * 12;

    let taxableIncome;

    if (regime === 'OLD') {
      const standardDeduction = STATUTORY_CONSTANTS.TDS.STANDARD_DEDUCTION_OLD;
      const sec80C = Math.min(taxOptions.section80C || 0, 150000);
      const sec80D = Math.min(taxOptions.section80D || 0, 75000);
      const homeLoan = Math.min(taxOptions.homeLoanInterest || 0, 200000);
      const hraExemption = taxOptions.hraExemption || 0;
      const otherDeductions = taxOptions.otherDeductions || 0;

      const totalDeductions = standardDeduction + sec80C + sec80D + homeLoan + hraExemption + otherDeductions;
      taxableIncome = Math.max(0, annualGross - totalDeductions);

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

      if (taxableIncome <= STATUTORY_CONSTANTS.TDS.REBATE_87A_LIMIT_OLD) annualTax = 0;

      // Surcharge
      if (taxableIncome > 5000000 && taxableIncome <= 10000000) {
        annualTax *= 1.10;
      } else if (taxableIncome > 10000000 && taxableIncome <= 20000000) {
        annualTax *= 1.15;
      } else if (taxableIncome > 20000000 && taxableIncome <= 50000000) {
        annualTax *= 1.25;
      } else if (taxableIncome > 50000000) {
        annualTax *= 1.37;
      }

      const cess = annualTax * STATUTORY_CONSTANTS.TDS.CESS_RATE;
      const totalAnnualTax = annualTax + cess;
      return Math.round((totalAnnualTax / 12) * 100) / 100;
    }

    // New Regime
    const standardDeduction = STATUTORY_CONSTANTS.TDS.STANDARD_DEDUCTION_NEW;
    taxableIncome = Math.max(0, annualGross - standardDeduction);

    if (taxableIncome <= STATUTORY_CONSTANTS.TDS.REBATE_87A_LIMIT_NEW) {
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

    if (taxableIncome > 5000000 && taxableIncome <= 10000000) {
      annualTax *= 1.10;
    } else if (taxableIncome > 10000000 && taxableIncome <= 20000000) {
      annualTax *= 1.15;
    } else if (taxableIncome > 20000000) {
      annualTax *= 1.25;
    }

    const cess = annualTax * STATUTORY_CONSTANTS.TDS.CESS_RATE;
    const totalAnnualTax = annualTax + cess;
    return Math.round((totalAnnualTax / 12) * 100) / 100;
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

  /**
   * Asynchronous calculator for deductions.
   */
  async calculateTotalDeductions(structure, options = {}) {
    const monthlyGross = this.calculateGrossEarnings(structure);
    const pf = this.calculatePF(structure.basicSalary, structure.da || 0, options.employeePf !== false, options.vpfPercentage || 0);
    const esi = this.calculateESI(monthlyGross, structure.esiEnabled !== false, options.esiCycleEligible !== undefined ? options.esiCycleEligible : null);
    const pt = this.calculatePT(monthlyGross, structure.professionalTaxEnabled !== false, options.state || 'DEFAULT', options.gender || 'Male', options.month || null);
    const lwf = this.calculateLWF(monthlyGross, structure.lwfEnabled !== false, options.state || 'DEFAULT', options.month || null);
    const nps = this.calculateNPS(structure.basicSalary, structure.da || 0, structure.npsEnabled || false, options.npsEmployeeRate || 10, options.npsEmployerRate || 10);

    let tds = 0;
    let tdsBreakdown = {
      gross: monthlyGross,
      annualGross: monthlyGross * 12,
      monthlyTax: 0,
      annualTax: 0,
      taxSlab: 'Nil'
    };

    if (options.tdsEnabled) {
      if (options.employeeId && options.month && options.year) {
        try {
          const projection = await projectTDS(
            options.employeeId,
            options.month,
            options.year,
            monthlyGross,
            structure.basicSalary,
            structure.da || 0
          );
          tds = projection.tdsAmount;
          tdsBreakdown = {
            gross: monthlyGross,
            annualGross: projection.annualGross,
            monthlyTax: tds,
            annualTax: projection.totalAnnualTax,
            taxSlab: this.getTaxSlab(projection.taxableIncome),
            regime: projection.regime
          };
        } catch (err) {
          console.error('[TDS ENGINE ERROR]: Falling back to legacy TDS:', err.message);
          tds = this.calculateTDS(monthlyGross, options.taxOptions || {});
        }
      } else {
        tds = this.calculateTDS(monthlyGross, options.taxOptions || {});
      }
    }

    return {
      employeePf: pf.employeePf,
      employerPf: pf.employerPf,
      employerEps: pf.employerEps,
      employerEpf: pf.employerEpf,
      vpfAmount: pf.vpfAmount,
      employeeEsi: esi.employeeEsi,
      employerEsi: esi.employerEsi,
      professionalTax: pt,
      employeeLwf: lwf.employeeLwf,
      employerLwf: lwf.employerLwf,
      employeeNps: nps.employeeNps,
      employerNps: nps.employerNps,
      tds: tds,
      tdsBreakdown: tdsBreakdown,
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

  async calculateNetSalary(structure, options = {}) {
    const grossEarnings = this.calculateGrossEarnings(structure);
    const deductions = await this.calculateTotalDeductions(structure, options);

    const employeeDeductions =
      deductions.employeePf +
      deductions.vpfAmount +
      deductions.employeeEsi +
      deductions.professionalTax +
      deductions.employeeLwf +
      deductions.employeeNps +
      deductions.tds +
      deductions.insurance +
      deductions.otherDeductions;

    const totalDeductions = employeeDeductions;
    const netSalary = grossEarnings - totalDeductions;

    const monthlyGross = grossEarnings;
    const annualCost = monthlyGross * 12 + deductions.employerPf * 12 + deductions.employerEsi * 12 + deductions.employerLwf * 12 + deductions.employerNps * 12;

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
          employerEps: deductions.employerEps,
          employerEpf: deductions.employerEpf,
          vpfAmount: deductions.vpfAmount,
          employeeEsi: deductions.employeeEsi,
          employerEsi: deductions.employerEsi,
          professionalTax: deductions.professionalTax,
          employeeLwf: deductions.employeeLwf,
          employerLwf: deductions.employerLwf,
          employeeNps: deductions.employeeNps,
          employerNps: deductions.employerNps,
          tds: deductions.tds,
          insurance: deductions.insurance,
          otherDeductions: deductions.otherDeductions,
        },
        monthlyBreakdown: {
          grossEarnings,
          employeePf: deductions.employeePf,
          vpfAmount: deductions.vpfAmount,
          employeeEsi: deductions.employeeEsi,
          professionalTax: deductions.professionalTax,
          employeeLwf: deductions.employeeLwf,
          employeeNps: deductions.employeeNps,
          tds: deductions.tds,
          insurance: deductions.insurance,
          other: deductions.otherDeductions,
        },
      },
      annual: {
        grossSalary: monthlyGross * 12,
        employerContribution: (deductions.employerPf + deductions.employerEsi + deductions.employerLwf + deductions.employerNps) * 12,
        tds: deductions.tdsBreakdown.annualTax,
        totalCostToCompany: annualCost,
        taxSlab: deductions.tdsBreakdown.taxSlab,
      },
    };
  }

  async calculateProportionalSalary(structure, daysWorked, workDays, options = {}) {
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
    const deductions = await this.calculateTotalDeductions(
      {
        ...structure,
        basicSalary: earnings.basicSalary,
        hra: earnings.hra,
        da: earnings.da,
        conveyance: earnings.conveyance,
        medical: earnings.medical,
        specialAllowance: earnings.specialAllowance,
        otherAllowance: earnings.otherAllowance
      },
      options
    );

    const employeeDeductions =
      deductions.employeePf +
      deductions.vpfAmount +
      deductions.employeeEsi +
      deductions.professionalTax +
      deductions.employeeLwf +
      deductions.employeeNps +
      deductions.tds +
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
          employeePf: deductions.employeePf,
          employerPf: deductions.employerPf,
          employerEps: deductions.employerEps,
          employerEpf: deductions.employerEpf,
          vpfAmount: deductions.vpfAmount,
          employeeEsi: deductions.employeeEsi,
          employerEsi: deductions.employerEsi,
          professionalTax: deductions.professionalTax,
          employeeLwf: deductions.employeeLwf,
          employerLwf: deductions.employerLwf,
          employeeNps: deductions.employeeNps,
          employerNps: deductions.employerNps,
          tds: deductions.tds,
          insurance: Math.round((structure.insurance || 0) * proportion * 100) / 100,
          otherDeductions: Math.round((structure.otherDeduction || 0) * proportion * 100) / 100,
        },
      },
    };
  }

  async calculateAllEmployees(employees, attendances) {
    const results = [];
    for (const employee of employees) {
      const structure = employee.salaryStructure;
      if (!structure) {
        results.push({ employeeId: employee.id, error: 'No salary structure' });
        continue;
      }

      const attendance = attendances.find((a) => a.employeeId === employee.id);
      const daysWorked = attendance?.workDays || 20;
      const workDays = 20;

      const calculation = daysWorked < workDays
        ? await this.calculateProportionalSalary(structure, daysWorked, workDays)
        : await this.calculateNetSalary(structure);

      results.push({
        employee: {
          id: employee.id,
          firstName: employee.firstName,
          lastName: employee.lastName,
          employeeId: employee.employeeId,
        },
        calculation,
      });
    }
    return results;
  }
}

const salaryCalculator = new SalaryCalculator();

module.exports = salaryCalculator;
