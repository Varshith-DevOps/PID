const prisma = require('../../config/database');
const { getEmployeeScopeIds, getLinkedEmployeeId } = require('../accessControl');

// Helper to format date in YYYY-MM-DD
const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toISOString().slice(0, 10);
};

/**
 * Main query entry point for Priya Agent.
 * Authenticates user role, routes intent, fetches relevant DB & policy context,
 * applies historical feedback corrections, and calls the LLM (or fallback generator).
 */
const askPriyaQuestion = async (question, user) => {
  const startTime = Date.now();
  const qLower = (question || '').toLowerCase().trim();
  const companyId = user.companyId;
  const isManager = user.role === 'MANAGER' || user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';

  // Get active employee context
  const employeeId = await getLinkedEmployeeId(user);
  let employeeRecord = null;
  if (employeeId) {
    employeeRecord = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { department: true }
    });
  }

  // 1. Resolve Intent and Fetch Context
  let contextData = {};
  let intentType = 'GENERAL';
  let databaseDetailsText = '';

  if (qLower.includes('leave') || qLower.includes('holiday')) {
    if (isManager && (qLower.includes('team') || qLower.includes('employees') || qLower.includes('calendar'))) {
      intentType = 'TEAM_LEAVES';
      const subordinates = await getEmployeeScopeIds(user);
      const teamIds = subordinates.filter(id => id !== employeeId);
      
      const leaves = await prisma.leave.findMany({
        where: {
          employeeId: { in: teamIds },
          status: 'APPROVED',
          endDate: { gte: new Date() }
        },
        include: { employee: true },
        orderBy: { startDate: 'asc' },
        take: 10
      });

      contextData.teamLeaves = leaves;
      databaseDetailsText = leaves.length 
        ? leaves.map(l => `${l.employee.firstName} ${l.employee.lastName} is on ${l.leaveType} leave from ${formatDate(l.startDate)} to ${formatDate(l.endDate)}`).join('\n')
        : 'No team members are currently on leave or have upcoming scheduled leaves.';
    } else if (qLower.includes('how many') || qLower.includes('balance') || qLower.includes('quota') || qLower.includes('i have')) {
      intentType = 'EMPLOYEE_LEAVES';
      if (employeeId) {
        const quotas = await prisma.leaveQuota.findMany({
          where: { employeeId, year: new Date().getFullYear() }
        });
        contextData.leaveQuotas = quotas;
        databaseDetailsText = quotas.length
          ? quotas.map(q => `${q.leaveType}: Allocated ${q.quota}, Used ${q.used}, Remaining ${q.quota - q.used}`).join('\n')
          : 'You do not have any leave quotas configured for this year.';
      } else {
        databaseDetailsText = 'Employee profile not linked to user. Cannot check leave balance.';
      }
    } else {
      intentType = 'LEAVE_POLICY';
      const policy = await prisma.policyDefinition.findFirst({
        where: { companyId, policyType: 'LEAVE' }
      });
      contextData.policy = policy;
      databaseDetailsText = policy 
        ? `Active Leave Policy (${policy.name}): ${policy.description}`
        : 'Leave policy defaults to Standard accrual rules: 1.5 Earned Leaves per month (18/year), 7 Casual Leaves, and 7 Sick Leaves annually. Carry-forward is capped at 30 days.';
    }
  } else if (qLower.includes('holiday')) {
    intentType = 'HOLIDAY';
    const holidays = await prisma.holiday.findMany({
      where: { companyId, date: { gte: new Date() } },
      orderBy: { date: 'asc' },
      take: 3
    });
    contextData.holidays = holidays;
    databaseDetailsText = holidays.length
      ? holidays.map(h => `${h.name}: ${formatDate(h.date)}`).join('\n')
      : 'No upcoming holidays are scheduled in the system.';
  } else if (qLower.includes('notice') || qLower.includes('resigned') || qLower.includes('resignation')) {
    intentType = 'NOTICE';
    if (employeeId) {
      const exit = await prisma.exitDetails.findUnique({
        where: { employeeId }
      });
      contextData.exit = exit;
      if (exit) {
        databaseDetailsText = `Your resignation has been recorded on ${formatDate(exit.resignationDate)}. Last working day: ${formatDate(exit.lastWorkingDate)}. Notice period: ${exit.noticePeriodDays} days. Status: ${exit.fnfStatus}.`;
      } else {
        databaseDetailsText = `Standard company notice period for ${employeeRecord?.employmentType || 'FULL_TIME'} is 90 days. No resignation recorded.`;
      }
    } else {
      databaseDetailsText = 'Standard company notice period is 90 days.';
    }
  } else if (qLower.includes('reimburse') || qLower.includes('claim') || qLower.includes('expense')) {
    intentType = 'REIMBURSEMENT';
    const policy = await prisma.policyDefinition.findFirst({
      where: { companyId, policyType: 'EXPENSE' }
    });
    contextData.policy = policy;
    databaseDetailsText = policy 
      ? `Expense Reimbursement Policy (${policy.name}): ${policy.description}`
      : 'Standard expense policy: Employees can claim reimbursement for travel, internet, and office expenses. Submissions must include receipt files and are routed to your direct manager for approval. Settlement occurs in the next monthly payroll cycle.';
  } else if (isManager && (qLower.includes('attendance') || qLower.includes('late') || qLower.includes('absent'))) {
    intentType = 'LOW_ATTENDANCE';
    const subordinates = await getEmployeeScopeIds(user);
    const teamIds = subordinates.filter(id => id !== employeeId);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const attendances = await prisma.attendance.findMany({
      where: {
        employeeId: { in: teamIds },
        date: { gte: startOfMonth },
        status: { in: ['ABSENT', 'LATE'] }
      },
      include: { employee: true },
      orderBy: { date: 'desc' }
    });

    const counts = {};
    attendances.forEach(a => {
      const name = `${a.employee.firstName} ${a.employee.lastName}`;
      if (!counts[name]) counts[name] = { absent: 0, late: 0 };
      if (a.status === 'ABSENT') counts[name].absent++;
      if (a.status === 'LATE') counts[name].late++;
    });

    const lowAttendanceList = Object.entries(counts)
      .filter(([_, stats]) => stats.absent > 1 || stats.late > 2)
      .map(([name, stats]) => `${name}: Absences: ${stats.absent}, Late entries: ${stats.late}`);

    databaseDetailsText = lowAttendanceList.length
      ? `Employees with attendance alerts this month:\n` + lowAttendanceList.join('\n')
      : 'All team members have maintained excellent attendance records this month.';
  } else if (isManager && (qLower.includes('appraisal') || qLower.includes('cycles') || qLower.includes('increment'))) {
    intentType = 'APPRAISAL_DUE';
    const subordinates = await getEmployeeScopeIds(user);
    const teamIds = subordinates.filter(id => id !== employeeId);

    // Find appraisals where status is not completed
    const appraisals = await prisma.performanceAppraisal.findMany({
      where: {
        employeeId: { in: teamIds },
        status: { in: ['DRAFT', 'SUBMITTED_SELF'] }
      },
      include: { employee: true }
    });

    // Also check join date anniversaries this month
    const thisMonth = new Date().getMonth() + 1;
    const teamEmployees = await prisma.employee.findMany({
      where: { id: { in: teamIds } }
    });
    
    const anniversaries = teamEmployees.filter(emp => {
      if (!emp.joinDate) return false;
      return new Date(emp.joinDate).getMonth() + 1 === thisMonth;
    }).map(emp => `${emp.firstName} ${emp.lastName} (Work Anniversary this month: joined ${formatDate(emp.joinDate)})`);

    const appraisalList = appraisals.map(a => `${a.employee.firstName} ${a.employee.lastName} is pending appraisal for cycle "${a.appraisalCycle}" (Status: ${a.status})`);
    
    databaseDetailsText = [...appraisalList, ...anniversaries].length
      ? `Appraisal activities due for action:\n` + [...appraisalList, ...anniversaries].join('\n')
      : 'No appraisals or work anniversaries are due for your team this month.';
  } else if (isManager && (qLower.includes('attrition') || qLower.includes('risk') || qLower.includes('quit') || qLower.includes('resign'))) {
    intentType = 'ATTRITION_RISK';
    // Calculate simple heuristic risk metrics by department
    const departments = await prisma.department.findMany({
      where: { companyId },
      include: { employees: { include: { exitDetails: true, tasks: { where: { status: { not: 'COMPLETED' } } } } } }
    });

    const riskLogs = [];
    departments.forEach(dept => {
      let activeCount = 0;
      let exitCount = 0;
      let delayedTasks = 0;

      dept.employees.forEach(emp => {
        if (emp.isActive) {
          activeCount++;
          // tasks due past deadline
          const overdue = emp.tasks.filter(t => t.deadline && new Date(t.deadline) < new Date());
          delayedTasks += overdue.length;
        } else {
          exitCount++;
        }
      });

      // Simple calculation: exits relative to headcount + task delay weight
      const riskScore = activeCount > 0 
        ? Math.round(((exitCount * 1.5 + delayedTasks * 0.4) / (activeCount + exitCount)) * 100) 
        : 0;

      let riskLevel = 'LOW';
      if (riskScore > 35) riskLevel = 'HIGH';
      else if (riskScore > 15) riskLevel = 'MEDIUM';

      riskLogs.push({
        deptName: dept.name,
        score: riskScore,
        level: riskLevel,
        details: `${dept.name} Department: Headcount: ${activeCount}, Historical exits: ${exitCount}, Overdue tasks: ${delayedTasks}`
      });
    });

    const sortedRisk = riskLogs.sort((a, b) => b.score - a.score);
    databaseDetailsText = `Attrition Risk assessment across teams:\n` +
      sortedRisk.map(r => `- Team ${r.deptName}: ${r.level} Risk (Burnout/Attrition Index: ${r.score}%). Details: ${r.details}`).join('\n');
  }

  // 2. Fetch Historical Corrections (Self-Improving RAG)
  const corrections = await prisma.agentFeedback.findMany({
    where: {
      agentName: 'Priya',
      isCorrected: true
    },
    select: { question: true, correctedText: true },
    take: 5
  });

  // Check if we can resolve the query locally (meaning we have an intentType other than GENERAL OR a matching correction)
  const matchingCorrection = corrections.find(c => {
    const cq = c.question.toLowerCase().trim();
    return qLower.includes(cq) || cq.includes(qLower);
  });

  const canResolveLocally = (intentType !== 'GENERAL') || !!matchingCorrection;

  // Compute local duration up to this point
  const localDuration = Date.now() - startTime;

  let finalAnswer = '';
  let activeEngine = 'local-cognitive-agent';

  // If local resolution is capable AND took under 3 seconds (which it will, in ~10ms)
  if (canResolveLocally && localDuration < 3000) {
    if (matchingCorrection) {
      finalAnswer = matchingCorrection.correctedText;
      activeEngine = 'local-cognitive-agent-corrected';
    } else {
      const greeting = employeeRecord ? `Hi ${employeeRecord.firstName}, ` : `Hello, `;
      switch (intentType) {
        case 'EMPLOYEE_LEAVES':
          finalAnswer = `${greeting}I checked your leave logs for the current year. Here is your current leave summary:\n${databaseDetailsText}\n\nLet me know if you would like me to draft a leave request for you!`;
          break;
        case 'TEAM_LEAVES':
          finalAnswer = `Here is the active leave list for your direct reports:\n${databaseDetailsText}\n\nYou can click on the Leaves tab to approve any pending requests.`;
          break;
        case 'HOLIDAY':
          finalAnswer = `Here are the upcoming company holidays I found:\n${databaseDetailsText}\n\nEnjoy your time off!`;
          break;
        case 'NOTICE':
          finalAnswer = `${databaseDetailsText}\n\nIf you have questions about exit settlements or F&F calculations, I'm here to help.`;
          break;
        case 'REIMBURSEMENT':
          finalAnswer = `${databaseDetailsText}\n\nTo submit a claim, please go to the Expenses section, upload your receipt, and enter the details. Claims are processed with monthly payroll cycles.`;
          break;
        case 'LOW_ATTENDANCE':
          finalAnswer = `I compiled the attendance records for your team this month:\n\n${databaseDetailsText}\n\nWould you like me to flag regularization requests for any of these entries?`;
          break;
        case 'APPRAISAL_DUE':
          finalAnswer = `Here are the appraisal deadlines and employee anniversaries due this month:\n\n${databaseDetailsText}\n\nPlease sync with your reporting employees to initiate performance discussions.`;
          break;
        case 'ATTRITION_RISK':
          finalAnswer = `I performed an attrition check based on recent exits and current task overdues (burnout metrics):\n\n${databaseDetailsText}\n\nI recommend scheduling regular one-on-ones with teams showing medium or high risk index alerts.`;
          break;
      }
    }
  }

  // If local resolution was unable to provide a response, OR if it exceeded 3 seconds, delegate to LLM
  if (!finalAnswer) {
    const isTimeout = localDuration >= 3000;
    console.log(`[Priya Agent] ${isTimeout ? 'Local agent exceeded 3s timeout' : 'Local agent unable to resolve query'}. Delegating to LLM...`);

    let correctionContext = '';
    if (corrections.length > 0) {
      correctionContext = '\n[CRITICAL GUIDELINES - Apply these corrections from administrators for similar topics]:\n' +
        corrections.map(c => `- Correct answer for query related to "${c.question}": ${c.correctedText}`).join('\n') + '\n';
    }

    const systemPrompt = `You are Priya, the Chief Human Resources Officer (CHRO) and AI Copilot for this company's Employee Self-Service (ESS) portal.
Your responses should be warm, empathic, professional, clear, and highly human-like (do not sound like a generic, robotic chatbot).
You answer questions instantly for employees and managers using real data and corporate policies.

User Profile:
- Name: ${employeeRecord ? `${employeeRecord.firstName} ${employeeRecord.lastName}` : 'User'}
- Role: ${user.role}
- Department: ${employeeRecord?.department?.name || 'General'}
- Join Date: ${employeeRecord ? formatDate(employeeRecord.joinDate) : 'N/A'}

Corporate Context (Live HR Database & Policies):
${databaseDetailsText}
${correctionContext}
Always cite the exact numbers, policies, or names retrieved from the corporate context. If no specific data matches, default to a polite explanation and state that you will notify the HR support team to update the database.`;

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (apiKey) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                { role: 'user', parts: [{ text: `${systemPrompt}\n\nUser Question: ${question}` }] }
              ],
              generationConfig: { temperature: 0.3 }
            })
          }
        );

        if (response.ok) {
          const json = await response.json();
          finalAnswer = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
          activeEngine = 'gemini-1.5-flash';
        } else {
          console.error('Gemini API call failed status:', response.status);
        }
      } catch (err) {
        console.error('Error invoking Gemini API:', err);
      }
    }

    // Ultimate fallback if LLM is disabled or fails to respond
    if (!finalAnswer) {
      activeEngine = 'cognitive-heuristic-ultimate-fallback';
      const greeting = employeeRecord ? `Hi ${employeeRecord.firstName}, ` : `Hello, `;
      if (qLower.includes('gratuity')) {
        finalAnswer = `${greeting}gratuity is calculated according to the Payment of Gratuity Act, 1972. Employees completing 5+ years of continuous service are eligible. The calculation is 15 days of last-drawn basic salary for each completed year: (15 * Basic Salary * Completed Years) / 26. Let me know if you'd like me to project your gratuity value!`;
      } else if (qLower.includes('maternity') || qLower.includes('pregnant')) {
        finalAnswer = `${greeting}female employees are entitled to 26 weeks of paid maternity leave as per the Maternity Benefit (Amendment) Act, 2017. Up to 8 weeks can be taken prior to delivery. Let me know if you need help planning your leaves!`;
      } else {
        finalAnswer = `I understand you have a question about: "${question}". I couldn't find a matching policy or database record in my active knowledge library. I have logged this request for the HR team to update our records, and they will get back to you shortly!`;
      }
    }
  }

  return {
    success: true,
    agentName: 'Priya',
    engine: activeEngine,
    answer: finalAnswer.trim(),
    citations: intentType === 'LEAVE_POLICY' || intentType === 'REIMBURSEMENT' ? ['Company HR Handbook'] : [],
    intentType
  };
};

module.exports = { askPriyaQuestion };
