/**
 * @fileoverview Indian Statutory Constants and Slab Rates configuration.
 * Centralized registry for EPF, ESIC, PT, LWF, Gratuity, NPS, and Income Tax (TDS).
 */

const STATUTORY_CONSTANTS = {
  // Provident Fund
  PF: {
    EMPLOYEE_RATE: 0.12,
    EMPLOYER_RATE: 0.12,
    EPS_RATE: 0.0833,
    EPF_RATE: 0.0367, // 12% - 8.33%
    WAGE_CEILING: 15000.0,
    ADMIN_CHARGES_RATE: 0.005,
    EDLI_RATE: 0.005,
  },

  // Employee State Insurance
  ESI: {
    EMPLOYEE_RATE: 0.0075,
    EMPLOYER_RATE: 0.0325,
    GROSS_CEILING: 21000.0,
  },

  // Gratuity
  GRATUITY: {
    CEILING: 2500000.0, // ₹25 Lakhs (FY 2024 onwards)
    SERVICE_YEARS_MIN: 5,
    SERVICE_DAYS_MIN_FOR_4Y_240D: 240,
    FORMULA_MULTIPLIER: 15 / 26,
  },

  // National Pension System (NPS)
  NPS: {
    MAX_EMPLOYER_CONTRIBUTION_PCT_PRIVATE: 0.10, // 10% under Sec 80CCD(2)
    MAX_EMPLOYER_CONTRIBUTION_PCT_GOVT: 0.14,    // 14% for government/designated employees
  },

  // Professional Tax State Slabs
  PT: {
    DEFAULT_RATE: 200.0,
    SLABS: {
      MAHARASHTRA: [
        { min: 0, max: 7500, rate: 0, gender: 'ALL' },
        { min: 7500, max: 10000, rate: 175, gender: 'MALE' },
        { min: 7500, max: 10000, rate: 0, gender: 'FEMALE' },
        { min: 10000, max: Infinity, rate: 200, gender: 'ALL', febRate: 300 } // February anomaly
      ],
      KARNATAKA: [
        { min: 0, max: 15000, rate: 0, gender: 'ALL' },
        { min: 15000, max: 25000, rate: 150, gender: 'ALL' },
        { min: 25000, max: Infinity, rate: 200, gender: 'ALL' }
      ],
      TELANGANA: [
        { min: 0, max: 15000, rate: 0, gender: 'ALL' },
        { min: 15000, max: 20000, rate: 150, gender: 'ALL' },
        { min: 20000, max: Infinity, rate: 200, gender: 'ALL' }
      ],
      WEST_BENGAL: [
        { min: 0, max: 10000, rate: 0, gender: 'ALL' },
        { min: 10000, max: 15000, rate: 110, gender: 'ALL' },
        { min: 15000, max: 25000, rate: 130, gender: 'ALL' },
        { min: 25000, max: 40000, rate: 150, gender: 'ALL' },
        { min: 40000, max: Infinity, rate: 200, gender: 'ALL' }
      ],
      ANDHRA_PRADESH: [
        { min: 0, max: 15000, rate: 0, gender: 'ALL' },
        { min: 15000, max: 20000, rate: 150, gender: 'ALL' },
        { min: 20000, max: Infinity, rate: 200, gender: 'ALL' }
      ],
      TAMIL_NADU: [
        { min: 0, max: 21000, rate: 0, gender: 'ALL' },
        { min: 21000, max: 30000, rate: 135, gender: 'ALL' }, // semi-annual rates converted/pro-rated or monthly equivalent
        { min: 30000, max: 45000, rate: 315, gender: 'ALL' },
        { min: 45000, max: 60000, rate: 690, gender: 'ALL' },
        { min: 60000, max: 75000, rate: 1025, gender: 'ALL' },
        { min: 75000, max: Infinity, rate: 1250, gender: 'ALL' }
      ], // Note: Tamil Nadu PT is collected semi-annually. In payroll it can be calculated monthly or semi-annually (pro-rated shown here is semi-annual slab, we will handle monthly equivalent or divided by 6 depending on configuration)
      GUJARAT: [
        { min: 0, max: 6000, rate: 0, gender: 'ALL' },
        { min: 6000, max: 9000, rate: 80, gender: 'ALL' },
        { min: 9000, max: 12000, rate: 150, gender: 'ALL' },
        { min: 12000, max: Infinity, rate: 200, gender: 'ALL' }
      ]
    }
  },

  // Labour Welfare Fund
  LWF: {
    SLABS: {
      MAHARASHTRA: {
        DEDUCTION_MONTHS: [6, 12], // June & December
        EMPLOYEE_RATE: 25.0,
        EMPLOYER_RATE: 75.0,
        GROSS_CEILING: Infinity
      },
      KARNATAKA: {
        DEDUCTION_MONTHS: [12], // December only
        EMPLOYEE_RATE: 20.0,
        EMPLOYER_RATE: 40.0,
        GROSS_CEILING: Infinity
      },
      TAMIL_NADU: {
        DEDUCTION_MONTHS: [12], // December
        EMPLOYEE_RATE: 20.0,
        EMPLOYER_RATE: 40.0,
        GROSS_CEILING: Infinity
      },
      GUJARAT: {
        DEDUCTION_MONTHS: [6, 12], // June & December
        EMPLOYEE_RATE: 15.0,
        EMPLOYER_RATE: 30.0,
        GROSS_CEILING: Infinity
      },
      ANDHRA_PRADESH: {
        DEDUCTION_MONTHS: [12], // December
        EMPLOYEE_RATE: 30.0,
        EMPLOYER_RATE: 70.0,
        GROSS_CEILING: Infinity
      }
    }
  },

  // Income Tax / TDS - FY 2025-26 New & Old regimes
  TDS: {
    CESS_RATE: 0.04,
    STANDARD_DEDUCTION_OLD: 50000.0,
    STANDARD_DEDUCTION_NEW: 75000.0,
    REBATE_87A_LIMIT_OLD: 500000.0,
    REBATE_87A_LIMIT_NEW: 700000.0,
    REBATE_87A_MAX_OLD: 12500.0,
    REBATE_87A_MAX_NEW: 25000.0,
    
    SURCHARGE: [
      { threshold: 5000000.0, rate: 0.10 },
      { threshold: 10000000.0, rate: 0.15 },
      { threshold: 20000000.0, rate: 0.25 }, // Capped at 25% for New Regime as well
      { threshold: 50000000.0, rate: 0.37 }  // 37% only u/s Old Regime, New Regime surcharge capped at 25%
    ],

    SLABS_OLD: [
      { min: 0, max: 250000, rate: 0.0 },
      { min: 250000, max: 500000, rate: 0.05 },
      { min: 500000, max: 1000000, rate: 0.20 },
      { min: 1000000, max: Infinity, rate: 0.30 }
    ],

    SLABS_NEW: [
      { min: 0, max: 300000, rate: 0.0 },
      { min: 300000, max: 600000, rate: 0.05 },
      { min: 600000, max: 900000, rate: 0.10 },
      { min: 900000, max: 1200000, rate: 0.15 },
      { min: 1200000, max: 1500000, rate: 0.20 },
      { min: 1500000, max: Infinity, rate: 0.30 }
    ]
  }
};

module.exports = STATUTORY_CONSTANTS;
