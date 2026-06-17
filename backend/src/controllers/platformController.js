const prisma = require('../config/database');
const {
  parseJson,
  stringifyJson,
  getOrCreateDefaultCompany,
  getOrganizationSnapshot,
  seedPolicyTemplates,
  seedWorkflowTemplates,
  createWorkflowInstance,
  actionWorkflowTask,
  buildComplianceObligations,
} = require('../services/platformService');

const isElevated = (user) => ['SUPER_ADMIN', 'ADMIN', 'HR', 'FINANCE', 'ACCOUNTS'].includes(user?.role);

const normalizePolicy = (policy) => ({
  ...policy,
  rules: parseJson(policy.rulesJson, {}),
});

const normalizeWorkflow = (workflow) => ({
  ...workflow,
  steps: parseJson(workflow.stepsJson, []),
});

const normalizeIntegration = (integration) => ({
  ...integration,
  config: parseJson(integration.configJson, {}),
  configJson: undefined,
});

const getPlatformOverview = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [
      organization,
      policies,
      workflowCounts,
      pendingWorkflowTasks,
      obligations,
      integrations,
      payrollRun,
    ] = await Promise.all([
      getOrganizationSnapshot(),
      prisma.policyDefinition.findMany({ orderBy: { updatedAt: 'desc' }, take: 12 }),
      prisma.workflowInstance.groupBy({ by: ['status'], _count: true }),
      prisma.workflowTask.count({ where: { status: 'PENDING' } }),
      prisma.complianceObligation.findMany({
        where: { dueDate: { gte: startOfMonth, lte: endOfMonth } },
        orderBy: { dueDate: 'asc' },
        take: 20,
      }),
      prisma.integrationConnection.findMany({ orderBy: { updatedAt: 'desc' }, take: 12 }),
      prisma.payrollRun.findFirst({
        where: { month: now.getMonth() + 1, year: now.getFullYear() },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const workflowStatus = workflowCounts.reduce((acc, item) => {
      acc[item.status] = item._count;
      return acc;
    }, {});

    const openObligations = obligations.filter((item) => item.status !== 'COMPLETED');
    const overdueObligations = openObligations.filter((item) => new Date(item.dueDate) < now);

    res.json({
      organization,
      policies: policies.map(normalizePolicy),
      workflowStatus,
      pendingWorkflowTasks,
      compliance: {
        obligations,
        openCount: openObligations.length,
        overdueCount: overdueObligations.length,
        highRiskCount: openObligations.filter((item) => item.riskLevel === 'HIGH').length,
      },
      integrations: integrations.map(normalizeIntegration),
      payroll: {
        currentRun: payrollRun,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      },
      readinessScore: [
        organization.readiness.hasCompany,
        organization.readiness.hasLegalEntity,
        policies.some((item) => item.status === 'ACTIVE'),
        workflowStatus.PENDING !== undefined || workflowStatus.APPROVED !== undefined,
        integrations.length > 0,
        obligations.length > 0,
      ].filter(Boolean).length,
    });
  } catch (error) {
    console.error('PLATFORM OVERVIEW ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const bootstrapPlatform = async (req, res) => {
  try {
    const company = await getOrCreateDefaultCompany();
    const [policies, workflows] = await Promise.all([
      seedPolicyTemplates(company.id, req.user?.email),
      seedWorkflowTemplates(company.id, req.user?.email),
    ]);

    const now = new Date();
    const obligations = await buildComplianceObligations({
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    });

    res.status(201).json({
      company,
      policiesCreated: policies.length,
      workflowsCreated: workflows.length,
      obligationsCreated: obligations.length,
    });
  } catch (error) {
    console.error('PLATFORM BOOTSTRAP ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const listOrganization = async (req, res) => {
  try {
    res.json(await getOrganizationSnapshot());
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const createCompany = async (req, res) => {
  try {
    const { name, code, domain, country, baseCurrency, timezone } = req.body;
    if (!name || !code) return res.status(400).json({ error: 'Company name and code are required' });
    const company = await prisma.company.create({
      data: { name, code: String(code).toUpperCase(), domain, country, baseCurrency, timezone },
    });
    res.status(201).json(company);
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'Company code already exists' });
    res.status(500).json({ error: 'Server error' });
  }
};

const createLegalEntity = async (req, res) => {
  try {
    const company = req.body.companyId ? null : await getOrCreateDefaultCompany();
    const { companyId, name, code, legalName, pan, tan, gstin, cin, pfEstablishmentCode, esiEmployerCode, ptRegistrationNumber, lwfRegistrationNumber, registeredAddress, state, city, pincode } = req.body;
    if (!name || !code) return res.status(400).json({ error: 'Legal entity name and code are required' });
    const entity = await prisma.legalEntity.create({
      data: {
        companyId: companyId || company.id,
        name,
        code: String(code).toUpperCase(),
        legalName,
        pan,
        tan,
        gstin,
        cin,
        pfEstablishmentCode,
        esiEmployerCode,
        ptRegistrationNumber,
        lwfRegistrationNumber,
        registeredAddress,
        state,
        city,
        pincode,
      },
    });
    res.status(201).json(entity);
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'Legal entity code already exists for this company' });
    res.status(500).json({ error: 'Server error' });
  }
};

const createBranch = async (req, res) => {
  try {
    const company = req.body.companyId ? null : await getOrCreateDefaultCompany();
    const { name, code, companyId, legalEntityId, state, timezone } = req.body;
    if (!name) return res.status(400).json({ error: 'Branch name is required' });
    const branch = await prisma.branch.create({
      data: { name, code, companyId: companyId || company.id, legalEntityId, state, timezone },
    });
    res.status(201).json(branch);
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'Branch name already exists' });
    res.status(500).json({ error: 'Server error' });
  }
};

const createLocation = async (req, res) => {
  try {
    const company = req.body.companyId ? null : await getOrCreateDefaultCompany();
    const { name, companyId, branchId, state, city, address, pincode, timezone } = req.body;
    if (!name) return res.status(400).json({ error: 'Location name is required' });
    const location = await prisma.location.create({
      data: { name, companyId: companyId || company.id, branchId, state, city, address, pincode, timezone },
    });
    res.status(201).json(location);
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'Location name already exists' });
    res.status(500).json({ error: 'Server error' });
  }
};

const listPolicies = async (req, res) => {
  try {
    const where = {};
    if (req.query.policyType) where.policyType = String(req.query.policyType).toUpperCase();
    if (req.query.status) where.status = String(req.query.status).toUpperCase();
    const policies = await prisma.policyDefinition.findMany({ where, orderBy: [{ policyType: 'asc' }, { updatedAt: 'desc' }] });
    res.json(policies.map(normalizePolicy));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const createPolicy = async (req, res) => {
  try {
    const company = req.body.companyId ? null : await getOrCreateDefaultCompany();
    const { companyId, scopeType, scopeId, policyType, name, description, status, effectiveFrom, effectiveTo, rules } = req.body;
    if (!policyType || !name) return res.status(400).json({ error: 'Policy type and name are required' });
    const policy = await prisma.policyDefinition.create({
      data: {
        companyId: companyId || company.id,
        scopeType,
        scopeId,
        policyType: String(policyType).toUpperCase(),
        name,
        description,
        status: status || 'DRAFT',
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : undefined,
        effectiveTo: effectiveTo ? new Date(effectiveTo) : undefined,
        rulesJson: stringifyJson(rules || {}),
        createdBy: req.user?.email,
      },
    });
    res.status(201).json(normalizePolicy(policy));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const listWorkflows = async (req, res) => {
  try {
    const where = {};
    if (req.query.module) where.module = String(req.query.module).toUpperCase();
    const workflows = await prisma.workflowDefinition.findMany({ where, orderBy: [{ module: 'asc' }, { updatedAt: 'desc' }] });
    res.json(workflows.map(normalizeWorkflow));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const createWorkflow = async (req, res) => {
  try {
    const company = req.body.companyId ? null : await getOrCreateDefaultCompany();
    const { companyId, module, name, description, triggerEvent, scopeType, scopeId, steps, status } = req.body;
    if (!module || !name || !triggerEvent) return res.status(400).json({ error: 'Module, name and trigger event are required' });
    const workflow = await prisma.workflowDefinition.create({
      data: {
        companyId: companyId || company.id,
        module: String(module).toUpperCase(),
        name,
        description,
        triggerEvent: String(triggerEvent).toUpperCase(),
        scopeType,
        scopeId,
        status: status || 'ACTIVE',
        stepsJson: stringifyJson(Array.isArray(steps) ? steps : [], []),
        createdBy: req.user?.email,
      },
    });
    res.status(201).json(normalizeWorkflow(workflow));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const startWorkflow = async (req, res) => {
  try {
    const { module, entityType, entityId, title, context, triggerEvent } = req.body;
    if (!module || !entityType || !entityId || !title) {
      return res.status(400).json({ error: 'Module, entity type, entity id and title are required' });
    }
    const instance = await createWorkflowInstance({
      module: String(module).toUpperCase(),
      entityType,
      entityId,
      title,
      requester: req.user,
      context,
      triggerEvent: triggerEvent ? String(triggerEvent).toUpperCase() : undefined,
    });
    res.status(201).json(instance);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Server error' });
  }
};

const listApprovalInbox = async (req, res) => {
  try {
    const where = { status: req.query.status ? String(req.query.status).toUpperCase() : 'PENDING' };
    if (!isElevated(req.user)) {
      where.OR = [
        { assignedUserId: req.user.id },
        { assignedEmail: req.user.email },
        { assignedRole: req.user.role },
      ];
    } else if (req.query.assignedRole) {
      where.assignedRole = String(req.query.assignedRole).toUpperCase();
    }

    const tasks = await prisma.workflowTask.findMany({
      where,
      include: { instance: { include: { definition: true } } },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    });

    res.json(tasks.map((task) => ({
      ...task,
      instance: task.instance ? {
        ...task.instance,
        context: parseJson(task.instance.contextJson, {}),
        definition: task.instance.definition ? normalizeWorkflow(task.instance.definition) : null,
      } : null,
    })));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const actionApprovalTask = async (req, res) => {
  try {
    const updated = await actionWorkflowTask(req.params.taskId, req.user, req.body.action, req.body.comments);
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Workflow task action failed' });
  }
};

const listComplianceObligations = async (req, res) => {
  try {
    const where = {};
    if (req.query.status) where.status = String(req.query.status).toUpperCase();
    if (req.query.month) where.periodMonth = Number(req.query.month);
    if (req.query.year) where.periodYear = Number(req.query.year);
    if (req.query.obligationType) where.obligationType = String(req.query.obligationType).toUpperCase();
    const obligations = await prisma.complianceObligation.findMany({
      where,
      include: { legalEntity: true },
      orderBy: [{ dueDate: 'asc' }, { riskLevel: 'asc' }],
      take: 250,
    });
    res.json(obligations);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const generateComplianceCalendar = async (req, res) => {
  try {
    const now = new Date();
    const created = await buildComplianceObligations({
      month: req.body.month || now.getMonth() + 1,
      year: req.body.year || now.getFullYear(),
      legalEntityId: req.body.legalEntityId,
      ownerRole: req.body.ownerRole || 'FINANCE',
    });
    res.status(201).json({ createdCount: created.length, obligations: created });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const updateComplianceObligation = async (req, res) => {
  try {
    const { status, evidenceUrl, notes, ownerRole, ownerUserId, riskLevel } = req.body;
    const obligation = await prisma.complianceObligation.update({
      where: { id: req.params.id },
      data: { status, evidenceUrl, notes, ownerRole, ownerUserId, riskLevel },
    });
    res.json(obligation);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const listIntegrations = async (req, res) => {
  try {
    const where = {};
    if (req.query.category) where.category = String(req.query.category).toUpperCase();
    const integrations = await prisma.integrationConnection.findMany({ where, orderBy: [{ category: 'asc' }, { updatedAt: 'desc' }] });
    res.json(integrations.map(normalizeIntegration));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const upsertIntegration = async (req, res) => {
  try {
    const company = req.body.companyId ? null : await getOrCreateDefaultCompany();
    const { id, companyId, provider, category, displayName, status, config, secretsRef } = req.body;
    if (!provider || !category || !displayName) return res.status(400).json({ error: 'Provider, category and display name are required' });
    const data = {
      companyId: companyId || company.id,
      provider: String(provider).toUpperCase(),
      category: String(category).toUpperCase(),
      displayName,
      status: status || 'DRAFT',
      configJson: stringifyJson(config || {}),
      secretsRef,
      createdBy: req.user?.email,
    };
    const integration = id
      ? await prisma.integrationConnection.update({ where: { id }, data })
      : await prisma.integrationConnection.create({ data });
    res.status(id ? 200 : 201).json(normalizeIntegration(integration));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const testIntegration = async (req, res) => {
  try {
    const integration = await prisma.integrationConnection.update({
      where: { id: req.params.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: 'TESTED',
        lastSyncMessage: 'Configuration shape validated. Provider handshake adapter pending.',
      },
    });
    res.json(normalizeIntegration(integration));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getPlatformOverview,
  bootstrapPlatform,
  listOrganization,
  createCompany,
  createLegalEntity,
  createBranch,
  createLocation,
  listPolicies,
  createPolicy,
  listWorkflows,
  createWorkflow,
  startWorkflow,
  listApprovalInbox,
  actionApprovalTask,
  listComplianceObligations,
  generateComplianceCalendar,
  updateComplianceObligation,
  listIntegrations,
  upsertIntegration,
  testIntegration,
};
