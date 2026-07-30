'use client';

import React, { useState, useMemo } from 'react';

export default function TaxSandbox() {
  const [grossSalary, setGrossSalary] = useState<number>(1200000);
  const [sec80C, setSec80C] = useState<number>(150000);
  const [sec80D, setSec80D] = useState<number>(25000);
  const [homeLoanInterest, setHomeLoanInterest] = useState<number>(0);
  const [hraExemption, setHraExemption] = useState<number>(0);
  const [otherAllowances, setOtherAllowances] = useState<number>(0);

  // FY 2025-26 Indian Income Tax Rules Constants
  const TDS = {
    STANDARD_DEDUCTION_OLD: 50000,
    STANDARD_DEDUCTION_NEW: 75000,
    REBATE_87A_LIMIT_OLD: 500000,
    REBATE_87A_LIMIT_NEW: 700000,
    REBATE_87A_MAX_OLD: 12500,
    REBATE_87A_MAX_NEW: 25000,
    CESS_RATE: 0.04,
    
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
  };

  const calculateOldRegime = useMemo(() => {
    const totalDeductions = 
      TDS.STANDARD_DEDUCTION_OLD + 
      Math.min(sec80C, 150000) + 
      Math.min(sec80D, 75000) + 
      Math.min(homeLoanInterest, 200000) + 
      hraExemption + 
      otherAllowances;

    const taxableIncome = Math.max(0, grossSalary - totalDeductions);
    
    // Base Tax calculation
    let baseTax = 0;
    for (const slab of TDS.SLABS_OLD) {
      if (taxableIncome > slab.min) {
        const taxableAmount = Math.min(taxableIncome - slab.min, slab.max - slab.min);
        baseTax += taxableAmount * slab.rate;
      }
    }

    // Rebate 87A
    let rebate = 0;
    if (taxableIncome <= TDS.REBATE_87A_LIMIT_OLD) {
      rebate = Math.min(baseTax, TDS.REBATE_87A_MAX_OLD);
    }
    const taxAfterRebate = Math.max(0, baseTax - rebate);

    // Surcharge
    let surchargeRate = 0;
    if (taxableIncome > 5000000 && taxableIncome <= 10000000) surchargeRate = 0.10;
    else if (taxableIncome > 10000000 && taxableIncome <= 20000000) surchargeRate = 0.15;
    else if (taxableIncome > 20000000 && taxableIncome <= 50000000) surchargeRate = 0.25;
    else if (taxableIncome > 50000000) surchargeRate = 0.37;

    const surcharge = taxAfterRebate * surchargeRate;
    const cess = (taxAfterRebate + surcharge) * TDS.CESS_RATE;
    const totalTax = taxAfterRebate + surcharge + cess;

    return {
      taxableIncome: Math.round(taxableIncome),
      totalDeductions: Math.round(totalDeductions),
      baseTax: Math.round(baseTax),
      rebate: Math.round(rebate),
      surcharge: Math.round(surcharge),
      cess: Math.round(cess),
      totalTax: Math.round(totalTax)
    };
  }, [grossSalary, sec80C, sec80D, homeLoanInterest, hraExemption, otherAllowances]);

  const calculateNewRegime = useMemo(() => {
    // New regime only gets Standard Deduction, no 80C, 80D, HRA or home loan interest exemptions
    const totalDeductions = TDS.STANDARD_DEDUCTION_NEW;
    const taxableIncome = Math.max(0, grossSalary - totalDeductions);

    // Base Tax calculation
    let baseTax = 0;
    for (const slab of TDS.SLABS_NEW) {
      if (taxableIncome > slab.min) {
        const taxableAmount = Math.min(taxableIncome - slab.min, slab.max - slab.min);
        baseTax += taxableAmount * slab.rate;
      }
    }

    // Rebate 87A (New Regime rebate up to 25,000 for income up to 7L net taxable)
    let rebate = 0;
    if (taxableIncome <= TDS.REBATE_87A_LIMIT_NEW) {
      rebate = Math.min(baseTax, TDS.REBATE_87A_MAX_NEW);
    }
    const taxAfterRebate = Math.max(0, baseTax - rebate);

    // Surcharge (New regime surcharge is capped at 25%)
    let surchargeRate = 0;
    if (taxableIncome > 5000000 && taxableIncome <= 10000000) surchargeRate = 0.10;
    else if (taxableIncome > 10000000 && taxableIncome <= 20000000) surchargeRate = 0.15;
    else if (taxableIncome > 20000000) surchargeRate = 0.25;

    const surcharge = taxAfterRebate * surchargeRate;
    const cess = (taxAfterRebate + surcharge) * TDS.CESS_RATE;
    const totalTax = taxAfterRebate + surcharge + cess;

    return {
      taxableIncome: Math.round(taxableIncome),
      totalDeductions: Math.round(totalDeductions),
      baseTax: Math.round(baseTax),
      rebate: Math.round(rebate),
      surcharge: Math.round(surcharge),
      cess: Math.round(cess),
      totalTax: Math.round(totalTax)
    };
  }, [grossSalary]);

  const recommendation = useMemo(() => {
    const diff = calculateOldRegime.totalTax - calculateNewRegime.totalTax;
    if (diff > 0) {
      return {
        regime: 'NEW',
        savings: diff,
        class: 'success-banner',
        text: `We recommend the NEW tax regime. You save ₹${diff.toLocaleString('en-IN')} annually.`
      };
    } else if (diff < 0) {
      return {
        regime: 'OLD',
        savings: Math.abs(diff),
        class: 'info-banner',
        text: `We recommend the OLD tax regime. You save ₹${Math.abs(diff).toLocaleString('en-IN')} annually.`
      };
    } else {
      return {
        regime: 'EQUAL',
        savings: 0,
        class: 'neutral-banner',
        text: 'Both tax regimes result in the exact same tax liability.'
      };
    }
  }, [calculateOldRegime, calculateNewRegime]);

  // Max tax for visual scaling in charts
  const maxTaxVal = Math.max(calculateOldRegime.totalTax, calculateNewRegime.totalTax, 50000);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Tax Regime Sandbox</h2>
        <p style={styles.subtitle}>FY 2025-26 Side-by-Side Comparative Calculator</p>
      </div>

      <div style={styles.grid}>
        {/* Left Side: Inputs Card */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Income & Declarations</h3>
          
          <div style={styles.formGroup}>
            <label style={styles.label}>Annual Gross Income (₹)</label>
            <input 
              type="number" 
              value={grossSalary} 
              onChange={(e) => setGrossSalary(Number(e.target.value))} 
              style={styles.input}
              placeholder="e.g. 1200000"
            />
          </div>

          <div style={styles.separator} />
          
          <div style={styles.secTitle}>Deductions (Old Regime Only)</div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Section 80C (EPF, LIC, PPF - Capped at ₹1.5L)</label>
            <input 
              type="number" 
              value={sec80C} 
              onChange={(e) => setSec80C(Number(e.target.value))} 
              style={styles.input}
              placeholder="e.g. 150000"
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Section 80D (Health Insurance - Capped at ₹75k)</label>
            <input 
              type="number" 
              value={sec80D} 
              onChange={(e) => setSec80D(Number(e.target.value))} 
              style={styles.input}
              placeholder="e.g. 25000"
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Section 24(b) (Home Loan Interest - Capped at ₹2L)</label>
            <input 
              type="number" 
              value={homeLoanInterest} 
              onChange={(e) => setHomeLoanInterest(Number(e.target.value))} 
              style={styles.input}
              placeholder="e.g. 100000"
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>House Rent Allowance (HRA) Exemption</label>
            <input 
              type="number" 
              value={hraExemption} 
              onChange={(e) => setHraExemption(Number(e.target.value))} 
              style={styles.input}
              placeholder="e.g. 50000"
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Other Exemptions / Tax Free Allowances</label>
            <input 
              type="number" 
              value={otherAllowances} 
              onChange={(e) => setOtherAllowances(Number(e.target.value))} 
              style={styles.input}
              placeholder="e.g. 20000"
            />
          </div>
        </div>

        {/* Right Side: Analysis & Visual Charts */}
        <div style={styles.analyticsColumn}>
          {/* Recommendation Banner */}
          <div style={{
            ...styles.banner,
            ...(recommendation.regime === 'NEW' ? styles.successBanner : 
                recommendation.regime === 'OLD' ? styles.infoBanner : styles.neutralBanner)
          }}>
            <div style={styles.bannerIcon}>💡</div>
            <div>{recommendation.text}</div>
          </div>

          {/* Comparative Metrics Table */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Side-by-Side Comparison</h3>
            
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Computation item</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Old Regime</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>New Regime</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={styles.td}>Annual Gross Earnings</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>₹{grossSalary.toLocaleString('en-IN')}</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>₹{grossSalary.toLocaleString('en-IN')}</td>
                </tr>
                <tr>
                  <td style={styles.td}>Standard Deduction</td>
                  <td style={{ ...styles.td, textAlign: 'right', color: '#aeaeaf' }}>-₹{TDS.STANDARD_DEDUCTION_OLD.toLocaleString('en-IN')}</td>
                  <td style={{ ...styles.td, textAlign: 'right', color: '#aeaeaf' }}>-₹{TDS.STANDARD_DEDUCTION_NEW.toLocaleString('en-IN')}</td>
                </tr>
                <tr style={styles.shadedRow}>
                  <td style={styles.td}>Declared Slabs / Exemptions</td>
                  <td style={{ ...styles.td, textAlign: 'right', color: '#aeaeaf' }}>-₹{(calculateOldRegime.totalDeductions - TDS.STANDARD_DEDUCTION_OLD).toLocaleString('en-IN')}</td>
                  <td style={{ ...styles.td, textAlign: 'right', color: '#aeaeaf' }}>-₹0</td>
                </tr>
                <tr style={styles.highlightRow}>
                  <td style={styles.tdBold}>Net Taxable Income</td>
                  <td style={{ ...styles.tdBold, textAlign: 'right' }}>₹{calculateOldRegime.taxableIncome.toLocaleString('en-IN')}</td>
                  <td style={{ ...styles.tdBold, textAlign: 'right' }}>₹{calculateNewRegime.taxableIncome.toLocaleString('en-IN')}</td>
                </tr>
                <tr>
                  <td style={styles.td}>Base Calculated Tax</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>₹{calculateOldRegime.baseTax.toLocaleString('en-IN')}</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>₹{calculateNewRegime.baseTax.toLocaleString('en-IN')}</td>
                </tr>
                <tr>
                  <td style={styles.td}>Section 87A Rebate</td>
                  <td style={{ ...styles.td, textAlign: 'right', color: '#ffcc00' }}>-₹{calculateOldRegime.rebate.toLocaleString('en-IN')}</td>
                  <td style={{ ...styles.td, textAlign: 'right', color: '#ffcc00' }}>-₹{calculateNewRegime.rebate.toLocaleString('en-IN')}</td>
                </tr>
                <tr>
                  <td style={styles.td}>Cess + Surcharges (4%)</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>₹{(calculateOldRegime.cess + calculateOldRegime.surcharge).toLocaleString('en-IN')}</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>₹{(calculateNewRegime.cess + calculateNewRegime.surcharge).toLocaleString('en-IN')}</td>
                </tr>
                <tr style={styles.finalRow}>
                  <td style={styles.finalTdLabel}>Net Annual Tax Liability</td>
                  <td style={{ ...styles.finalTdValue, color: recommendation.regime === 'NEW' ? '#aeaeaf' : '#34c759' }}>
                    ₹{calculateOldRegime.totalTax.toLocaleString('en-IN')}
                  </td>
                  <td style={{ ...styles.finalTdValue, color: recommendation.regime === 'OLD' ? '#aeaeaf' : '#34c759' }}>
                    ₹{calculateNewRegime.totalTax.toLocaleString('en-IN')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Visual Chart Card */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Tax Liability Chart</h3>
            
            {/* SVG Visualizing the difference */}
            <div style={styles.chartWrapper}>
              <svg viewBox="0 0 400 160" width="100%" height="160" style={styles.svg}>
                {/* Background lines */}
                <line x1="100" y1="30" x2="380" y2="30" stroke="#444" strokeDasharray="3,3" />
                <line x1="100" y1="80" x2="380" y2="80" stroke="#444" strokeDasharray="3,3" />
                <line x1="100" y1="130" x2="380" y2="130" stroke="#444" strokeDasharray="3,3" />

                {/* Labels */}
                <text x="10" y="55" fill="#aaa" fontSize="12" fontWeight="600">Old Regime</text>
                <text x="10" y="105" fill="#aaa" fontSize="12" fontWeight="600">New Regime</text>

                {/* Bar Old Regime */}
                <rect 
                  x="100" 
                  y="40" 
                  width={calculateOldRegime.totalTax > 0 ? (280 * calculateOldRegime.totalTax / maxTaxVal) : 5} 
                  height="22" 
                  rx="4" 
                  fill={recommendation.regime === 'NEW' ? '#8e8e93' : '#34c759'} 
                />
                <text 
                  x={Math.max(110, 100 + (280 * calculateOldRegime.totalTax / maxTaxVal) - 60)} 
                  y="55" 
                  fill="#fff" 
                  fontSize="11" 
                  fontWeight="bold"
                >
                  ₹{calculateOldRegime.totalTax.toLocaleString('en-IN')}
                </text>

                {/* Bar New Regime */}
                <rect 
                  x="100" 
                  y="90" 
                  width={calculateNewRegime.totalTax > 0 ? (280 * calculateNewRegime.totalTax / maxTaxVal) : 5} 
                  height="22" 
                  rx="4" 
                  fill={recommendation.regime === 'OLD' ? '#8e8e93' : '#34c759'} 
                />
                <text 
                  x={Math.max(110, 100 + (280 * calculateNewRegime.totalTax / maxTaxVal) - 60)} 
                  y="105" 
                  fill="#fff" 
                  fontSize="11" 
                  fontWeight="bold"
                >
                  ₹{calculateNewRegime.totalTax.toLocaleString('en-IN')}
                </text>
              </svg>
            </div>
            
            <div style={styles.legend}>
              <span style={styles.legendItem}><span style={{ ...styles.colorBox, backgroundColor: '#34c759' }} /> Optimal Choice</span>
              <span style={styles.legendItem}><span style={{ ...styles.colorBox, backgroundColor: '#8e8e93' }} /> Suboptimal Choice</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px',
    backgroundColor: '#0a0a0c',
    color: '#f5f5f7',
    borderRadius: '12px',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  },
  header: {
    marginBottom: '28px',
    borderBottom: '1px solid #1c1c1e',
    paddingBottom: '16px',
  },
  title: {
    fontSize: '26px',
    fontWeight: '700',
    color: '#ffffff',
    margin: 0,
    letterSpacing: '-0.5px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#8e8e93',
    margin: '4px 0 0 0',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
    gap: '24px',
    alignItems: 'start',
  },
  card: {
    backgroundColor: '#151518',
    borderRadius: '12px',
    border: '1px solid #222225',
    padding: '24px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
    marginBottom: '20px',
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 0,
    marginBottom: '20px',
    borderBottom: '1px solid #222225',
    paddingBottom: '10px',
  },
  formGroup: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '12px',
    fontWeight: '500',
    color: '#8e8e93',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  input: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#0e0e11',
    border: '1px solid #2d2d30',
    borderRadius: '8px',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: '500',
    outline: 'none',
    boxSizing: 'border-box',
  },
  separator: {
    height: '1px',
    backgroundColor: '#222225',
    margin: '24px 0',
  },
  secTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#34c759',
    marginBottom: '16px',
    textTransform: 'uppercase',
  },
  analyticsColumn: {
    display: 'flex',
    flexDirection: 'column',
  },
  banner: {
    padding: '16px 20px',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: '600',
    marginBottom: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
  },
  successBanner: {
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
    color: '#34c759',
    border: '1px solid rgba(52, 199, 89, 0.3)',
  },
  infoBanner: {
    backgroundColor: 'rgba(10, 132, 255, 0.12)',
    color: '#0a84ff',
    border: '1px solid rgba(10, 132, 255, 0.3)',
  },
  neutralBanner: {
    backgroundColor: 'rgba(142, 142, 147, 0.12)',
    color: '#8e8e93',
    border: '1px solid rgba(142, 142, 147, 0.3)',
  },
  bannerIcon: {
    fontSize: '20px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px',
  },
  th: {
    padding: '12px',
    color: '#8e8e93',
    fontSize: '12px',
    fontWeight: '600',
    borderBottom: '1px solid #222225',
    textTransform: 'uppercase',
  },
  td: {
    padding: '12px',
    color: '#d1d1d6',
    borderBottom: '1px solid #1c1c1e',
  },
  tdBold: {
    padding: '12px',
    color: '#ffffff',
    fontWeight: '600',
    borderBottom: '1px solid #1c1c1e',
  },
  shadedRow: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  highlightRow: {
    backgroundColor: 'rgba(52, 199, 89, 0.04)',
    borderLeft: '4px solid #34c759',
  },
  finalRow: {
    borderTop: '2px solid #34c759',
    backgroundColor: 'rgba(52, 199, 89, 0.08)',
  },
  finalTdLabel: {
    padding: '16px 12px',
    fontWeight: '700',
    color: '#ffffff',
    fontSize: '15px',
  },
  finalTdValue: {
    padding: '16px 12px',
    fontWeight: '700',
    fontSize: '16px',
    textAlign: 'right',
  },
  chartWrapper: {
    backgroundColor: '#0e0e11',
    borderRadius: '8px',
    border: '1px solid #222225',
    padding: '16px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  svg: {
    overflow: 'visible',
  },
  legend: {
    display: 'flex',
    justifyContent: 'center',
    gap: '20px',
    marginTop: '16px',
    fontSize: '12px',
    color: '#8e8e93',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  colorBox: {
    width: '12px',
    height: '12px',
    borderRadius: '3px',
    display: 'inline-block',
  }
};
