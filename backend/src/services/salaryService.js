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
    if (!employeeContribution) return { employeePf: 0, employerPf: 0 };

    const pfWages = this.restrictPfToCeiling
      ? Math.min(basicSalary + da, this.pfWageCeiling)
      : (basicSalary + da);

    const employeePf = pfWages * this.pfRate;
    const employerPf = pfWages * this.pfRate;

    return {
      employeePf: Math.round(employeePf * 100) / 100,
      employerPf: Math.round(employerPf * 100) / 100,
    };
  }

  calculateESI(grossEarnings, enabled = true) {
    if (!enabled || grossEarnings > this.esiGrossCeiling) {
      return { employeeEsi: 0, employerEsi: 0 };
    }

    const employeeEsi = grossEarnings * this.esiRateEmployee;
    const employerEsi = grossEarnings * this.esiRateEmployer;

    return {
      employeeEsi: Math.round(employeeEsi * 100) / 100,
      employerEsi: Math.round(employerEsi * 100) / 100,
    };
  }

  calculatePT(grossEarnings, enabled = true) {
    if (!enabled || grossEarnings <= 25000) {
      return 0;
    }
    return this.ptRate;
  }

  calculateGratuity(basicSalary, yearsOfService) {
    if (yearsOfService < 1) return 0;

    const serviceYears = Math.min(yearsOfService, 30);
    const dailyWages = (basicSalary * 12) / 365;
    const gratuity = dailyWages * 15 * serviceYears;

    return Math.round(gratuity * 100) / 100;
  }

  calculateTDS(monthlyGross) {
    const annualGross = monthlyGross * 12;
    const standardDeduction = 75000;
    const taxableIncome = Math.max(0, annualGross - standardDeduction);

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
    const esi = this.calculateESI(monthlyGross, structure.esiEnabled !== false);
    const pt = this.calculatePT(monthlyGross, structure.professionalTaxEnabled !== false);
    const tds = options.tdsEnabled ? this.calculateTDS(monthlyGross) : 0;

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
    const esi = this.calculateESI(monthlyGross, structure.esiEnabled !== false);
    const pt = this.calculatePT(monthlyGross, structure.professionalTaxEnabled !== false);
    const tds = options.tdsEnabled ? this.calculateTDS(monthlyGross) : 0;

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
