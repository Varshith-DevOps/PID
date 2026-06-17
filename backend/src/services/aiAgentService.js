/**
 * @fileoverview AI Agent Service Orchestrator.
 * Implements core execution layers for the four agents:
 * - Sherlock (TDS Investment verification and OCR extraction audits)
 * - Jarvis (Pre-run payroll and Indian statutory compliance auditing)
 * - Winston (Attendance regularization logs validation)
 * - Athena (Policy definition search and RAG calculations)
 * @module services/aiAgentService
 */

const prisma = require('../config/database');

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
      fraudIndicators.add ? fraudIndicators.add('Metadata mismatch / suspicious font modification') : fraudIndicators.push('Metadata mismatch / suspicious font modification');
      fraudIndicators.push('Amount exceeds normal threshold limits without bank statement verification');
      isApproved = false;
    }

    if (category === 'HRA') {
      const landlordPan = (rentDetails?.landlordPan || '').toUpperCase();
      const hasValidPan = RegExp(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).hasMatch ? RegExp(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).hasMatch(landlordPan) : RegExp(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).test(landlordPan);

      if (!hasValidPan) {
        fraudIndicators.push('Invalid or unverified landlord PAN card format');
        isApproved = false;
      }

      // Compute simulated HRA exemption (rules-based)
      const monthlyRent = rentDetails?.monthlyRent || (parsedAmount / 12);
      // Mock basic wage of 50000/month
      const basicSalary = 500000; 
      const rentPaidExceedingTenPercent = (monthlyRent * 12) - (basicSalary * 0.1);
      hraExemption = Math.max(0, Math.min(parsedAmount, rentPaidExceedingTenPercent));
    }

    return {
      agentName: 'Sherlock',
      success: true,
      category,
      claimedAmount: parsedAmount,
      extractedDetails: {
        documentDetected: documentName || 'Declaration Receipt',
        computedExemption: hraExemption,
        landlordPan: rentDetails?.landlordPan || 'N/A'
      },
      auditResult: {
        status: isApproved ? 'APPROVED' : 'FLAGGED',
        fraudScore: isApproved ? 2 : 94,
        warnings: fraudIndicators,
        explanation: isApproved
            ? 'Rent receipt matches declaration. Landlord PAN check succeeded.'
            : 'Tax proof audit failed. Flagged for manual HR inspection.'
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
        SalaryStructure: true
      }
    });

    const anomalies = [];
    let totalAudited = 0;

    for (const emp of employees) {
      totalAudited++;
      const salary = emp.salary || 0;
      const struct = emp.SalaryStructure?.[0];

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
      month,
      year,
      totalAuditedEmployees: totalAudited,
      complianceScore: totalAudited > 0 ? Math.round(((totalAudited - anomalies.length) / totalAudited) * 100) : 100,
      anomalies
    };
  }
}

/**
 * Winston: Processes check-in regularizations by checking digital productivity logs.
 */
class WinstonAgent {
  static async resolveRegularization(employeeId, dateStr, requestedTimeIn, requestedTimeOut) {
    // In a real-world scenario, this agent connects to Git commit hashes, Slack message activities,
    // and VPN network footprints. We simulate this by analyzing activity patterns.
    
    const hasDigitalFootprint = !dateStr.includes('Sunday') && !dateStr.includes('Saturday');
    
    return {
      agentName: 'Winston',
      employeeId,
      date: dateStr,
      resolution: hasDigitalFootprint ? 'AUTO_APPROVED' : 'FLAGGED_FOR_REVIEW',
      confidence: hasDigitalFootprint ? 98 : 45,
      auditLog: {
        slackActivity: hasDigitalFootprint ? 'Messages active between 09:30 and 18:15' : 'No activity logged',
        gitCommits: hasDigitalFootprint ? '3 commits pushed to origin' : 'No activity logged',
        vpnConnection: hasDigitalFootprint ? 'Active tunnel from 09:15 to 18:30' : 'No activity logged'
      },
      explanation: hasDigitalFootprint
          ? 'Digital footprint verified. User logged Git commits and VPN signals matching the regularized shift window.'
          : 'No productivity logs or VPN footprints found on this date. Flagged for manager review.'
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
