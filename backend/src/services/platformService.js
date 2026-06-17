const prisma = require('../config/database');

const parseJson = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const stringifyJson = (value, fallback = {}) => JSON.stringify(value === undefined ? fallback : value);

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const getOrCreateDefaultCompany = async () => {
  let company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: 'NexusHR Demo Company',
        code: 'NEXUS',
        domain: 'nexushr.local',
      },
    });
  }
  return company;
};

const getOrganizationSnapshot = async () => {
  const [companies, legalEntities, branches, locations, activeEmployees] = await Promise.all([
    prisma.company.findMany({ include: { legalEntities: true, branches: true, locations: true } }),
    prisma.legalEntity.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.branch.findMany({ orderBy: { name: 'asc' } }),
    prisma.location.findMany({ orderBy: { name: 'asc' } }),
    prisma.employee.count({ where: { isActive: true } }),
  ]);

  return {
    companies,
    legalEntities,
    branches,
    locations,
    activeEmployees,
    readiness: {
      hasCompany: companies.length > 0,
      hasLegalEntity: legalEntities.length > 0,
      hasBranches: branches.length > 0,
      hasLocations: locations.length > 0,
    },
  };
};

const seedPolicyTemplates = async (companyId, createdBy) => {
  const templates = [
    {
      policyType: 'LEAVE',
      name: 'India Growing Company Leave Policy',
      description: 'Configurable accrual, carry-forward, sandwich, probation, encashment and LOP rules.',
      rulesJson: {
        accrual: { earnedLeavePerMonth: 1.5, casualLeavePerYear: 7, sickLeavePerYear: 7 },
        carryForward: { enabled: true, maxDays: 30, expiresAfterMonths: 12 },
        sandwichLeave: { enabled: false },
        probation: { restrictPaidLeave: true, allowedLeaveTypes: ['SICK', 'UNPAID'] },
        encashment: { enabled: true, leaveTypes: ['EARNED'], maxDaysPerYear: 15 },
        approval: { managerRequired: true, hrRequiredAfterDays: 5 },
      },
    },
    {
      policyType: 'ATTENDANCE',
      name: 'Hybrid Attendance and Shift Policy',
      description: 'Geo/IP/selfie-ready attendance rules with late, half-day, OT, and regularization controls.',
      rulesJson: {
        lateThresholdMinutes: 15,
        halfDayThresholdHours: 4,
        fullDayThresholdHours: 8,
        geoFenceRequiredForFieldStaff: true,
        ipRestrictionRequiredForOffice: false,
        regularization: { monthlyLimit: 3, managerApprovalRequired: true },
        overtime: { approvalRequired: true, dailyMaxHours: 4, multiplier: 2 },
      },
    },
    {
      policyType: 'PAYROLL',
      name: 'India Payroll Close Policy',
      description: 'Month-end payroll controls for preflight, maker-checker, bank file, payslip and compliance release.',
      rulesJson: {
        preflight: ['BANK', 'PAN', 'UAN', 'ESI', 'SALARY_STRUCTURE', 'ATTENDANCE', 'LOP', 'TDS_DECLARATION'],
        makerChecker: { reviewerRole: 'PAYROLL_REVIEWER', approverRole: 'PAYROLL_APPROVER' },
        varianceThresholdPercent: 10,
        lockAfterApproval: true,
        payslipReleaseAfterApproval: true,
      },
    },
    {
      policyType: 'RECRUITMENT',
      name: 'Requisition to Offer Policy',
      description: 'Headcount approval, interview scorecards, offer approval, preboarding and candidate portal controls.',
      rulesJson: {
        requisitionApproval: ['MANAGER', 'HR', 'FINANCE'],
        offerApproval: ['HR', 'FINANCE'],
        scorecardsRequired: true,
        preboardingRequired: true,
      },
    },
  ];

  const created = [];
  for (const template of templates) {
    const existing = await prisma.policyDefinition.findFirst({
      where: { companyId, policyType: template.policyType, name: template.name },
    });
    if (!existing) {
      created.push(await prisma.policyDefinition.create({
        data: {
          companyId,
          policyType: template.policyType,
          name: template.name,
          description: template.description,
          status: 'ACTIVE',
          rulesJson: stringifyJson(template.rulesJson),
          createdBy,
        },
      }));
    }
  }
  return created;
};

const seedWorkflowTemplates = async (companyId, createdBy) => {
  const workflows = [
    {
      module: 'PAYROLL',
      name: 'Payroll Maker-Checker Close',
      triggerEvent: 'PAYROLL_RUN_CREATED',
      description: 'Review and approval sequence before salary payout, payslip release and compliance filing.',
      stepsJson: [
        { step: 1, title: 'Payroll review', assignedRole: 'PAYROLL_REVIEWER', dueInDays: 1 },
        { step: 2, title: 'Payroll approval', assignedRole: 'PAYROLL_APPROVER', dueInDays: 1 },
        { step: 3, title: 'Compliance and bank release', assignedRole: 'FINANCE', dueInDays: 1 },
      ],
    },
    {
      module: 'LEAVE',
      name: 'Leave Approval Matrix',
      triggerEvent: 'LEAVE_REQUEST_CREATED',
      description: 'Manager first, HR escalation for long leave or policy exceptions.',
      stepsJson: [
        { step: 1, title: 'Manager approval', assignedRole: 'MANAGER', dueInDays: 2 },
        { step: 2, title: 'HR policy review', assignedRole: 'HR', dueInDays: 1, conditional: 'days > 5 || policyException' },
      ],
    },
    {
      module: 'RECRUITMENT',
      name: 'Headcount and Offer Approval',
      triggerEvent: 'JOB_REQUISITION_CREATED',
      description: 'Headcount, compensation and offer approvals for controlled hiring.',
      stepsJson: [
        { step: 1, title: 'Hiring manager confirmation', assignedRole: 'MANAGER', dueInDays: 2 },
        { step: 2, title: 'HR validation', assignedRole: 'HR', dueInDays: 2 },
        { step: 3, title: 'Finance budget approval', assignedRole: 'FINANCE', dueInDays: 2 },
      ],
    },
    {
      module: 'EMPLOYEES',
      name: 'Lifecycle Change Approval',
      triggerEvent: 'EMPLOYEE_LIFECYCLE_CHANGE',
      description: 'Confirmation, transfer, promotion, compensation and separation lifecycle governance.',
      stepsJson: [
        { step: 1, title: 'Manager recommendation', assignedRole: 'MANAGER', dueInDays: 3 },
        { step: 2, title: 'HR approval', assignedRole: 'HR', dueInDays: 2 },
        { step: 3, title: 'Payroll impact review', assignedRole: 'FINANCE', dueInDays: 2 },
      ],
    },
  ];

  const created = [];
  for (const workflow of workflows) {
    const existing = await prisma.workflowDefinition.findFirst({
      where: { companyId, module: workflow.module, triggerEvent: workflow.triggerEvent },
    });
    if (!existing) {
      created.push(await prisma.workflowDefinition.create({
        data: {
          companyId,
          module: workflow.module,
          name: workflow.name,
          triggerEvent: workflow.triggerEvent,
          description: workflow.description,
          stepsJson: stringifyJson(workflow.stepsJson, []),
          createdBy,
        },
      }));
    }
  }
  return created;
};

const createWorkflowInstance = async ({
  module,
  entityType,
  entityId,
  title,
  requester,
  context = {},
  triggerEvent,
}) => {
  const company = await getOrCreateDefaultCompany();
  const definition = triggerEvent
    ? await prisma.workflowDefinition.findFirst({
      where: { companyId: company.id, module, triggerEvent, status: 'ACTIVE' },
    })
    : await prisma.workflowDefinition.findFirst({
      where: { companyId: company.id, module, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
    });

  const steps = parseJson(definition?.stepsJson, [
    { step: 1, title: 'Review request', assignedRole: 'HR', dueInDays: 2 },
  ]);

  return prisma.workflowInstance.create({
    data: {
      definitionId: definition?.id,
      module,
      entityType,
      entityId,
      title,
      requesterId: requester?.id,
      requesterEmail: requester?.email,
      contextJson: stringifyJson(context),
      tasks: {
        create: steps.map((step, index) => ({
          stepNumber: step.step || index + 1,
          title: step.title || `Approval step ${index + 1}`,
          assignedRole: step.assignedRole || 'HR',
          status: index === 0 ? 'PENDING' : 'WAITING',
          dueAt: step.dueInDays ? addDays(new Date(), step.dueInDays) : null,
        })),
      },
    },
    include: { tasks: true, definition: true },
  });
};

const actionWorkflowTask = async (taskId, actor, action, comments) => {
  const task = await prisma.workflowTask.findUnique({
    where: { id: taskId },
    include: { instance: { include: { tasks: { orderBy: { stepNumber: 'asc' } } } } },
  });
  if (!task) throw new Error('Workflow task not found');
  if (task.status !== 'PENDING') throw new Error('Only pending workflow tasks can be actioned');

  const normalizedAction = String(action || '').toUpperCase();
  const approved = ['APPROVE', 'APPROVED'].includes(normalizedAction);
  const rejected = ['REJECT', 'REJECTED'].includes(normalizedAction);
  if (!approved && !rejected) throw new Error('Action must be APPROVE or REJECT');

  await prisma.workflowTask.update({
    where: { id: taskId },
    data: {
      status: approved ? 'APPROVED' : 'REJECTED',
      action: approved ? 'APPROVED' : 'REJECTED',
      comments,
      assignedUserId: actor?.id || task.assignedUserId,
      assignedEmail: actor?.email || task.assignedEmail,
      actedAt: new Date(),
    },
  });

  if (rejected) {
    return prisma.workflowInstance.update({
      where: { id: task.instanceId },
      data: { status: 'REJECTED' },
      include: { tasks: { orderBy: { stepNumber: 'asc' } }, definition: true },
    });
  }

  const nextTask = task.instance.tasks.find((item) => item.stepNumber > task.stepNumber && item.status === 'WAITING');
  if (nextTask) {
    await prisma.workflowTask.update({
      where: { id: nextTask.id },
      data: { status: 'PENDING' },
    });
    return prisma.workflowInstance.update({
      where: { id: task.instanceId },
      data: { currentStep: nextTask.stepNumber },
      include: { tasks: { orderBy: { stepNumber: 'asc' } }, definition: true },
    });
  }

  return prisma.workflowInstance.update({
    where: { id: task.instanceId },
    data: { status: 'APPROVED' },
    include: { tasks: { orderBy: { stepNumber: 'asc' } }, definition: true },
  });
};

const buildComplianceObligations = async ({ month, year, legalEntityId, ownerRole = 'FINANCE' }) => {
  const targetMonth = Number(month);
  const targetYear = Number(year);
  const company = await getOrCreateDefaultCompany();
  const legalEntities = legalEntityId
    ? await prisma.legalEntity.findMany({ where: { id: legalEntityId } })
    : await prisma.legalEntity.findMany({ where: { companyId: company.id } });
  const entityIds = legalEntities.length ? legalEntities.map((entity) => entity.id) : [null];

  const obligations = [
    { obligationType: 'PF_ECR', name: 'PF ECR filing', day: 15, riskLevel: 'HIGH' },
    { obligationType: 'ESI_RETURN', name: 'ESI contribution filing', day: 15, riskLevel: 'HIGH' },
    { obligationType: 'PT_PAYMENT', name: 'Professional Tax payment', day: 20, riskLevel: 'MEDIUM' },
    { obligationType: 'TDS_PAYMENT', name: 'TDS deposit', day: 7, riskLevel: 'HIGH' },
    { obligationType: 'PAYROLL_REGISTER', name: 'Payroll register archive', day: 28, riskLevel: 'MEDIUM' },
    { obligationType: 'ATTENDANCE_REGISTER', name: 'Attendance and muster register archive', day: 28, riskLevel: 'MEDIUM' },
  ];

  const created = [];
  for (const entityId of entityIds) {
    for (const item of obligations) {
      const dueDate = new Date(targetYear, targetMonth - 1, item.day, 23, 59, 59, 999);
      const existing = await prisma.complianceObligation.findFirst({
        where: {
          companyId: company.id,
          legalEntityId: entityId,
          obligationType: item.obligationType,
          periodMonth: targetMonth,
          periodYear: targetYear,
        },
      });
      if (!existing) {
        created.push(await prisma.complianceObligation.create({
          data: {
            companyId: company.id,
            legalEntityId: entityId,
            obligationType: item.obligationType,
            name: item.name,
            periodMonth: targetMonth,
            periodYear: targetYear,
            dueDate,
            ownerRole,
            riskLevel: item.riskLevel,
          },
        }));
      }
    }
  }
  return created;
};

module.exports = {
  parseJson,
  stringifyJson,
  getOrCreateDefaultCompany,
  getOrganizationSnapshot,
  seedPolicyTemplates,
  seedWorkflowTemplates,
  createWorkflowInstance,
  actionWorkflowTask,
  buildComplianceObligations,
};
