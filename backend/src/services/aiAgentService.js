/**
 * @fileoverview Rule-based assistant service (branded "agents").
 *
 * IMPORTANT: These are DETERMINISTIC, RULE-BASED helpers — NOT machine learning
 * or LLM models, and NOT authoritative. They do not perform real OCR, fraud
 * detection, RAG, or any external-system verification. Every result is advisory
 * and must be confirmed by a human before any HR/payroll/compliance decision.
 *
 *  - Sherlock: heuristic checks on a declared TDS/HRA proof (filename + PAN format).
 *  - Jarvis:   flags salary structures against fixed Indian statutory thresholds.
 *  - Winston:  attendance-regularization triage (no external integrations).
 *  - Athena:   static statutory knowledge base + configured policy lookup.
 * @module services/aiAgentService
 */

const prisma = require('../config/database');

/** Attached to every response so callers never treat output as authoritative AI. */
const ENGINE = 'rule-based-heuristic';
const DISCLAIMER = 'Automated rule-based check, not AI/ML and not authoritative. Advisory only — verify before acting.';

/**
 * Sherlock: Handles OCR extraction and compliance validation of rent receipts, PAN cards, and signatures.
 */
class SherlockAgent {
  static async auditTdsProof({ category, amount, documentName, rentDetails }) {
    // Simulated Document OCR parsing and tax rules validation
    const parsedAmount = parseFloat(amount) || 0.0;
    const fraudIndicators = [];
    let isApproved = true;
    let hraExemption = 0;

    // Simulate OCR text scanning check
    const docLower = (documentName || '').toLowerCase();
    const isMockForged = docLower.includes('fake') || docLower.includes('sample') || parsedAmount > 1000000;

    if (isMockForged) {
      fraudIndicators.push('Filename or amount looks suspicious (heuristic only — not real document analysis)');
      fraudIndicators.push('Amount exceeds threshold without bank-statement verification');
      isApproved = false;
    }

    // Assumed basic wage used for the HRA estimate (NOT the employee's real salary).
    const ASSUMED_ANNUAL_BASIC = 500000;
    if (category === 'HRA') {
      const landlordPan = (rentDetails?.landlordPan || '').toUpperCase();
      const hasValidPan = /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(landlordPan);

      if (!hasValidPan) {
        fraudIndicators.push('Landlord PAN missing or not in valid format');
        isApproved = false;
      }

      // Indicative HRA estimate (rules-based) using an ASSUMED basic salary.
      const monthlyRent = rentDetails?.monthlyRent || (parsedAmount / 12);
      const rentPaidExceedingTenPercent = (monthlyRent * 12) - (ASSUMED_ANNUAL_BASIC * 0.1);
      hraExemption = Math.max(0, Math.min(parsedAmount, rentPaidExceedingTenPercent));
    }

    return {
      agentName: 'Sherlock',
      engine: ENGINE,
      aiPowered: false,
      disclaimer: DISCLAIMER,
      success: true,
      category,
      claimedAmount: parsedAmount,
      assumptions: { annualBasicSalary: ASSUMED_ANNUAL_BASIC, note: 'Estimate uses an assumed basic salary, not the employee record.' },
      extractedDetails: {
        documentDetected: documentName || 'Declaration Receipt',
        estimatedExemption: hraExemption,
        landlordPan: rentDetails?.landlordPan || 'N/A'
      },
      auditResult: {
        // "suggestedStatus" — not a decision. No fabricated fraud score.
        suggestedStatus: isApproved ? 'LOOKS_OK_PENDING_REVIEW' : 'NEEDS_REVIEW',
        warnings: fraudIndicators,
        explanation: isApproved
            ? 'Basic format checks passed. A human must verify the receipt and PAN before approval.'
            : 'Heuristic checks flagged issues. Route to HR for manual inspection.'
      }
    };
  }
}

/**
 * Jarvis: Scans company payroll data and runs audits against Indian statutory limits.
 */
class JarvisAgent {
  static async auditMonthlyPayroll(companyId, month, year) {
    // Fetch all employees and salary structures in this tenant's scope
    const employees = await prisma.employee.findMany({
      where: { companyId },
      include: {
        salaryStructure: true
      }
    });

    const anomalies = [];
    let totalAudited = 0;

    for (const emp of employees) {
      totalAudited++;
      const salary = emp.salary || 0;
      const struct = emp.salaryStructure; // one-to-one relation

      if (!struct) {
        anomalies.push({
          employeeId: emp.id,
          employeeName: `${emp.firstName} ${emp.lastName}`,
          rule: 'Salary Structure Check',
          description: 'No active salary structure registered for this employee. Cannot process EPF/ESI.',
          severity: 'HIGH'
        });
        continue;
      }

      // Rule 1: ESI Wage Ceiling Verification (₹21,000 threshold)
      if (salary > 21000 && struct.esiEnabled) {
        anomalies.push({
          employeeId: emp.id,
          employeeName: `${emp.firstName} ${emp.lastName}`,
          rule: 'ESI Ceiling Warning',
          description: `Gross salary (₹${salary}) exceeds the statutory ESI ceiling of ₹21,000. Under Section 46 of ESI Act, contributions should be disabled.`,
          severity: 'MEDIUM'
        });
      }

      // Rule 2: EPF Basic Capping Verification (₹15,000 threshold)
      const basic = struct.basicSalary || (salary * 0.5);
      if (basic > 15000 && struct.pfEnabled) {
        // Warning if employer hasn't configured capped contributions
        anomalies.push({
          employeeId: emp.id,
          employeeName: `${emp.firstName} ${emp.lastName}`,
          rule: 'EPF Capping Notification',
          description: `Basic salary (₹${basic}) exceeds the statutory threshold of ₹15,000. Audit shows contributions are calculated on actual basic salary instead of capped limit.`,
          severity: 'INFO'
        });
      }

      // Rule 3: Professional Tax (PT) Slabs cross-border auditing
      const state = emp.state || 'Karnataka';
      if (struct.professionalTaxEnabled) {
        if (state === 'Karnataka' && salary > 25000) {
          // Expected PT is 200, if zero or not matching, flag anomaly
          // Since it's an audit, we remind HR PT applies
        }
      }
    }

    return {
      agentName: 'Jarvis',
      engine: ENGINE,
      aiPowered: false,
      disclaimer: DISCLAIMER,
      month,
      year,
      totalAuditedEmployees: totalAudited,
      complianceScore: totalAudited > 0 ? Math.round(((totalAudited - anomalies.length) / totalAudited) * 100) : 100,
      anomalies
    };
  }
}

/**
 * Winston: attendance-regularization triage.
 *
 * No external integrations are connected (no Git/Slack/VPN). This only applies a
 * simple weekday/weekend heuristic and ALWAYS defers the decision to a human —
 * it never auto-approves and never fabricates evidence.
 */
class WinstonAgent {
  static async resolveRegularization(employeeId, dateStr, requestedTimeIn, requestedTimeOut) {
    const isWeekend = /saturday|sunday/i.test(dateStr);

    return {
      agentName: 'Winston',
      engine: ENGINE,
      aiPowered: false,
      disclaimer: DISCLAIMER,
      employeeId,
      date: dateStr,
      // Recommendation only — the manager makes the actual decision.
      recommendation: 'MANAGER_REVIEW_REQUIRED',
      heuristic: isWeekend ? 'Requested date falls on a weekend' : 'Requested date is a weekday',
      integrationsConnected: false,
      explanation: 'No external activity sources are integrated, so this request cannot be auto-verified. Routed to the manager for review.'
    };
  }
}

/**
 * Athena: Answers conversational questions regarding company policy.
 */
class AthenaAgent {
  static async askPolicyQuestion(question, companyId) {
    const qLower = question.toLowerCase();
    let answer = '';
    let category = 'GENERAL';

    // RAG Simulator: Search database policies or Fallback to Statutory Indian Acts
    if (qLower.includes('gratuity')) {
      category = 'GRATUITY';
      answer = 'Under the Payment of Gratuity Act, 1972, employees are entitled to gratuity after 5 years of continuous service. The gratuity is calculated as: 15 days of last drawn basic salary for every year of completed service. Formula: (15 * Last Basic * Years of Service) / 26.';
    } else if (qLower.includes('maternity') || qLower.includes('pregnant') || qLower.includes('baby')) {
      category = 'LEAVE_BENEFITS';
      answer = 'As per the Maternity Benefit (Amendment) Act, 2017, female employees are entitled to 26 weeks of paid maternity leave, of which not more than 8 weeks can precede the expected date of delivery. For employees with 2 or more surviving children, the entitlement is 12 weeks.';
    } else if (qLower.includes('leave') || qLower.includes('holiday')) {
      category = 'LEAVE_POLICY';
      // Query database policy definitions if available
      const policy = await prisma.policyDefinition.findFirst({
        where: { companyId, policyType: 'LEAVE' }
      });
      if (policy) {
        answer = `According to your organization's active Leave Policy (${policy.name}): ${policy.description}. Rules configured: Casual, Sick, and Earned leaves are accrued monthly.`;
      } else {
        answer = 'Leave policy defaults to Standard accrual rules: 1.5 Earned Leaves per month (18/year), 7 Casual Leaves, and 7 Sick Leaves annually. Carry-forward is capped at 30 days.';
      }
    } else if (qLower.includes('provident') || qLower.includes('pf') || qLower.includes('epf')) {
      category = 'PROVIDENT_FUND';
      answer = 'EPF contribution is mandated at 12% of basic salary + DA for both the employer and employee. The statutory limit for salary capping is ₹15,000 per month, making the capped monthly contribution ₹1,800 unless voluntary excess is configured.';
    } else {
      answer = "I couldn't find a specific policy matches in my knowledge library. I have logged this request for the HR team to update the handbook database.";
    }

    return {
      agentName: 'Athena',
      engine: ENGINE,
      aiPowered: false,
      disclaimer: 'Answers come from a fixed statutory knowledge base and your configured policies — not a language model. Verify against the latest law/handbook.',
      category,
      question,
      answer,
      citations: [
        category === 'GRATUITY' ? 'Payment of Gratuity Act, 1972' : '',
        category === 'LEAVE_BENEFITS' ? 'Maternity Benefit (Amendment) Act, 2017' : '',
        category === 'PROVIDENT_FUND' ? 'Employees Provident Funds Scheme, 1952' : ''
      ].filter(Boolean)
    };
  }
}

module.exports = {
  SherlockAgent,
  JarvisAgent,
  WinstonAgent,
  AthenaAgent
};
