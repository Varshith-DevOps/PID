class SalaryCalculator {
  constructor() {
    this.pfRate = 0.12;
    this.maxPf = 2160;
    this.gratuityRate = 0.0481;
    this.otMultiplier = 1.5;
    this.standardHours = 176;
  }

  getSettings() {
    return {
      pfRate: this.pfRate,
      maxPf: this.maxPf,
      gratuityRate: this.gratuityRate,
      otMultiplier: this.otMultiplier,
      standardHours: this.standardHours,
    };
  }

  updateSettings(settings) {
    if (settings.pfRate !== undefined) this.pfRate = settings.pfRate;
    if (settings.maxPf !== undefined) this.maxPf = settings.maxPf;
    if (settings.gratuityRate !== undefined) this.gratuityRate = settings.gratuityRate;
    if (settings.otMultiplier !== undefined) this.otMultiplier = settings.otMultiplier;
    if (settings.standardHours !== undefined) this.standardHours = settings.standardHours;
  }

  calculateOTPay(basicSalary, otHours) {
    const hourlyRate = basicSalary / this.standardHours;
    const otRate = hourlyRate * this.otMultiplier;
    return Math.round(otHours * otRate * 100) / 100;
  }

  calculatePF(basicSalary, employeeContribution = true) {
    if (!employeeContribution) return { employeePf: 0, employerPf: 0 };

    const employeePf = Math.min(basicSalary * this.pfRate, this.maxPf);
    const employerPf = Math.min(basicSalary * this.pfRate, this.maxPf);

    return {
      employeePf: Math.round(employeePf * 100) / 100,
      employerPf: Math.round(employerPf * 100) / 100,
    };
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

    let annualTax = 0;
    if (annualGross <= 250000) {
      annualTax = 0;
    } else if (annualGross <= 500000) {
      annualTax = (annualGross - 250000) * 0.05;
    } else if (annualGross <= 750000) {
      annualTax = 12500 + (annualGross - 500000) * 0.10;
    } else if (annualGross <= 1000000) {
      annualTax = 37500 + (annualGross - 750000) * 0.15;
    } else if (annualGross <= 1250000) {
      annualTax = 75000 + (annualGross - 1000000) * 0.20;
    } else if (annualGross <= 1500000) {
      annualTax = 125000 + (annualGross - 1250000) * 0.25;
    } else {
      annualTax = 187500 + (annualGross - 1500000) * 0.30;
    }

    const monthlyTDS = annualTax / 12;
    return Math.round(monthlyTDS * 100) / 100;
  }

  calculateCess(annualGross) {
    if (annualGross <= 500000) return 0;
    if (annualGross <= 1000000) return 0;
    return annualGross > 1000000 ? (annualGross - 1000000) * 0.02 : 0;
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
    const pf = this.calculatePF(structure.basicSalary, options.employeePf !== false);
    const monthlyGross = this.calculateGrossEarnings(structure);
    const tds = options.tdsEnabled ? this.calculateTDS(monthlyGross) : 0;

    return {
      employeePf: pf.employeePf,
      employerPf: pf.employerPf,
      tds: tds,
      tdsBreakdown: {
        gross: monthlyGross,
        annualGross: monthlyGross * 12,
        monthlyTax: tds,
        annualTax: tds * 12,
        taxSlab: this.getTaxSlab(monthlyGross * 12),
      },
      insurance: structure.insurance || 0,
      otherDeductions: structure.otherDeduction || 0,
    };
  }

  getTaxSlab(annualGross) {
    if (annualGross <= 250000) return 'Nil';
    if (annualGross <= 500000) return '5%';
    if (annualGross <= 750000) return '10%';
    if (annualGross <= 1000000) return '15%';
    if (annualGross <= 1250000) return '20%';
    if (annualGross <= 1500000) return '25%';
    return '30%';
  }

  calculateNetSalary(structure, options = {}) {
    const grossEarnings = this.calculateGrossEarnings(structure);
    const deductions = this.calculateTotalDeductions(structure, options);

    const employeeDeductions =
      deductions.employeePf +
      deductions.tds +
      deductions.insurance +
      deductions.otherDeductions;

    const totalDeductions = employeeDeductions;
    const netSalary = grossEarnings - totalDeductions;

    const monthlyGross = grossEarnings;
    const annualCost = monthlyGross * 12 + deductions.employerPf * 12;

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
          tds: deductions.tds,
          insurance: deductions.insurance,
          otherDeductions: deductions.otherDeductions,
        },
        monthlyBreakdown: {
          grossEarnings,
          employeePf: deductions.employeePf,
          tds: deductions.tds,
          insurance: deductions.insurance,
          other: deductions.otherDeductions,
        },
      },
      annual: {
        grossSalary: monthlyGross * 12,
        employerContribution: deductions.employerPf * 12,
        tds: deductions.tds * 12,
        totalCostToCompany: annualCost,
        taxSlab: deductions.tdsBreakdown.taxSlab,
      },
    };
  }

  calculateProportionalSalary(structure, daysWorked, workDays, options = {}) {
    const proportion = daysWorked / workDays;

    const baseSalary = structure.basicSalary * proportion;
    const earnings = {
      basicSalary: Math.round(baseSalary * 100) / 100,
      hra: Math.round(structure.hra * proportion * 100) / 100,
      da: Math.round(structure.da * proportion * 100) / 100,
      conveyance: Math.round((structure.conveyance || structure.conveyence || 0) * proportion * 100) / 100,
      medical: Math.round(structure.medical * proportion * 100) / 100,
      specialAllowance: Math.round(structure.specialAllowance * proportion * 100) / 100,
      otherAllowance: Math.round(structure.otherAllowance * proportion * 100) / 100,
    };

    const pf = this.calculatePF(baseSalary, options.employeePf !== false);
    const monthlyGross = Object.values(earnings).reduce((a, b) => a + b, 0);
    const tds = options.tdsEnabled ? this.calculateTDS(monthlyGross) : 0;

    const employeeDeductions =
      pf.employeePf +
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
          tds: tds,
          insurance: (structure.insurance || 0) * proportion,
          otherDeductions: (structure.otherDeduction || 0) * proportion,
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
