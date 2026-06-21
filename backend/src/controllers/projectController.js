/**
 * @fileoverview Project and task management controller.
 * Provides CRUD for projects, tasks, resources, and expense tracking.
 * @module controllers/projectController
 */

const prisma = require('../config/database');
const { getEmployeeScopeIds, getLinkedEmployeeId, isHr } = require('../services/accessControl');
const { computeProjectCosting } = require('../services/projectCostingService');

const scopedProjectAccessWhere = async (user) => {
  if (isHr(user)) return {};

  const ownEmployeeId = await getLinkedEmployeeId(user);
  const scopeIds = await getEmployeeScopeIds(user);
  const ids = scopeIds.length ? scopeIds : ownEmployeeId ? [ownEmployeeId] : [];
  if (!ids.length) return { id: '__no_project_scope__' };

  return {
    OR: [
      { managerId: { in: ids } },
      { resources: { some: { employeeId: { in: ids } } } },
      { tasks: { some: { assigneeId: { in: ids } } } },
    ],
  };
};

const scopedTaskAccessWhere = async (user) => {
  if (isHr(user)) return {};

  const ownEmployeeId = await getLinkedEmployeeId(user);
  const scopeIds = await getEmployeeScopeIds(user);
  const ids = scopeIds.length ? scopeIds : ownEmployeeId ? [ownEmployeeId] : [];
  if (!ids.length) return { id: '__no_task_scope__' };

  return {
    OR: [
      { assigneeId: { in: ids } },
      { project: { managerId: { in: ids } } },
      { project: { resources: { some: { employeeId: { in: ids } } } } },
    ],
  };
};

const canAccessProject = async (user, projectId) => {
  if (isHr(user)) return true;
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      ...(await scopedProjectAccessWhere(user)),
    },
    select: { id: true },
  });
  return Boolean(project);
};

const getProjects = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const filters = [{ isActive: true }, await scopedProjectAccessWhere(req.user)];

    if (status) filters.push({ status });
    if (search) {
      filters.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      });
    }
    const where = { AND: filters };

    const projects = await prisma.project.findMany({
      where,
      include: {
        manager: { select: { id: true, firstName: true, lastName: true } },
        resources: { include: { employee: { select: { id: true, firstName: true, lastName: true } } } },
        _count: { select: { tasks: true } },
      },
      skip: (page - 1) * limit,
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
    });

    const total = await prisma.project.count({ where });
    res.json({ projects, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!(await canAccessProject(req.user, id))) {
      return res.status(403).json({ error: 'Access denied for requested project.' });
    }

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        manager: { select: { id: true, firstName: true, lastName: true, email: true } },
        resources: { include: { employee: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        tasks: { include: { assignee: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' } },
        expenses: true,
      },
    });

    if (!project) return res.status(404).json({ error: 'Project not found' });

    const totalCost = project.tasks.reduce((sum, t) => sum + (t.actualHours || 0), 0);
    const totalExpense = project.expenses.reduce((sum, e) => sum + e.amount, 0);
    const completedTasks = project.tasks.filter((t) => t.status === 'COMPLETED').length;
    const completionPercent = project.tasks.length > 0 ? Math.round((completedTasks / project.tasks.length) * 100) : 0;

    res.json({ ...project, metrics: { totalCost, totalExpense, completionPercent } });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const createProject = async (req, res) => {
  try {
    const { name, description, startDate, deadline, budget, managerId, resourceIds, status } = req.body;

    if (!name || !managerId) {
      return res.status(400).json({ error: 'Name and manager required' });
    }
    if (req.user?.role === 'MANAGER') {
      const scopeIds = await getEmployeeScopeIds(req.user, { includeReports: false });
      if (!scopeIds.includes(managerId)) {
        return res.status(403).json({ error: 'Managers can only create projects they manage.' });
      }
    }

    const project = await prisma.project.create({
      data: {
        name,
        description,
        startDate: startDate ? new Date(startDate) : null,
        deadline: deadline ? new Date(deadline) : null,
        budget: budget || 0,
        status: status || 'PLANNING',
        managerId,
        resources: resourceIds?.length > 0 ? { create: resourceIds.map((id) => ({ employeeId: id })) } : undefined,
      },
      include: { manager: { select: { id: true, firstName: true, lastName: true } } },
    });

    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, startDate, deadline, budget, status, managerId, resourceIds } = req.body;

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!(await canAccessProject(req.user, id))) {
      return res.status(403).json({ error: 'Access denied for requested project.' });
    }

    if (resourceIds) {
      await prisma.projectResource.deleteMany({ where: { projectId: id } });
      await prisma.projectResource.createMany({
        data: resourceIds.map((employeeId) => ({ projectId: id, employeeId })),
      });
    }

    const updated = await prisma.project.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(deadline && { deadline: new Date(deadline) }),
        ...(budget !== undefined && { budget }),
        ...(status && { status }),
        ...(managerId && { managerId }),
      },
      include: { manager: { select: { id: true, firstName: true, lastName: true } } },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    await prisma.project.update({ where: { id }, data: { isActive: false } });
    res.json({ message: 'Project deactivated' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const addExpense = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { description, amount, date } = req.body;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!(await canAccessProject(req.user, projectId))) {
      return res.status(403).json({ error: 'Access denied for requested project.' });
    }

    const expense = await prisma.projectExpense.create({
      data: { projectId, description, amount, date: date ? new Date(date) : new Date(), createdBy: req.user?.id },
    });

    res.status(201).json(expense);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const getTasks = async (req, res) => {
  try {
    const { projectId, assigneeId, status, priority, page = 1, limit = 50 } = req.query;
    const filters = [];

    filters.push(await scopedTaskAccessWhere(req.user));
    if (projectId) filters.push({ projectId });
    if (assigneeId) filters.push({ assigneeId });
    if (status) filters.push({ status });
    if (priority) filters.push({ priority });
    const where = filters.length ? { AND: filters } : {};

    const tasks = await prisma.task.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, firstName: true, lastName: true } },
      },
      skip: (page - 1) * limit,
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
    });

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const createTask = async (req, res) => {
  try {
    const { title, description, projectId, assigneeId, estimatedHours, deadline, priority } = req.body;

    if (!title || !assigneeId) {
      return res.status(400).json({ error: 'Title and assignee required' });
    }
    const scopedEmployeeIds = isHr(req.user) ? null : await getEmployeeScopeIds(req.user);
    if (scopedEmployeeIds && !scopedEmployeeIds.includes(assigneeId)) {
      return res.status(403).json({ error: 'You can only assign tasks within your employee scope.' });
    }
    if (projectId && !(await canAccessProject(req.user, projectId))) {
      return res.status(403).json({ error: 'Access denied for requested project.' });
    }

    const task = await prisma.task.create({
      data: {
        title,
        description: description || null,
        projectId: projectId || null,
        assigneeId,
        estimatedHours: estimatedHours || null,
        deadline: deadline ? new Date(deadline) : null,
        priority: priority || 'MEDIUM',
        createdBy: req.user?.id,
      },
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true } },
        project: { select: { id: true, name: true } },
      },
    });

    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, projectId, assigneeId, estimatedHours, actualHours, deadline, priority, status, storyPoints, boardRank, billable } = req.body;

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const scopedTask = await prisma.task.findFirst({
      where: { id, ...(await scopedTaskAccessWhere(req.user)) },
      select: { id: true },
    });
    if (!scopedTask) {
      return res.status(403).json({ error: 'Access denied for requested task.' });
    }

    const isCompletion = status === 'COMPLETED' && task.status !== 'COMPLETED';

    const updated = await prisma.task.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(projectId && { projectId }),
        ...(assigneeId && { assigneeId }),
        ...(estimatedHours !== undefined && { estimatedHours }),
        ...(actualHours !== undefined && { actualHours }),
        ...(storyPoints !== undefined && { storyPoints }),
        ...(boardRank !== undefined && { boardRank }),
        ...(billable !== undefined && { billable }),
        ...(deadline && { deadline: new Date(deadline) }),
        ...(priority && { priority }),
        ...(status && { status }),
        ...(isCompletion ? { completedAt: new Date() } : {}),
      },
      include: { assignee: { select: { id: true, firstName: true, lastName: true } } },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const scopedTask = await prisma.task.findFirst({
      where: { id, ...(await scopedTaskAccessWhere(req.user)) },
      select: { id: true },
    });
    if (!scopedTask) {
      return res.status(403).json({ error: 'Access denied for requested task.' });
    }
    await prisma.task.delete({ where: { id } });
    res.json({ message: 'Task deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

/** Jira-style board columns (left → right workflow). */
const BOARD_COLUMNS = ['TODO', 'IN_PROGRESS', 'AWAITING_APPROVAL', 'REWORK', 'COMPLETED'];

/**
 * GET /api/projects/:id/board — tasks for a project grouped into board columns,
 * ordered by boardRank. Returns column metadata for a Kanban UI.
 */
const getProjectBoard = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await prisma.project.findFirst({
      where: { id, ...(await scopedProjectAccessWhere(req.user)) },
      select: { id: true, name: true },
    });
    if (!project) return res.status(403).json({ error: 'Access denied for requested project.' });

    const tasks = await prisma.task.findMany({
      where: { projectId: id, ...(await scopedTaskAccessWhere(req.user)) },
      include: { assignee: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: [{ boardRank: 'asc' }, { createdAt: 'asc' }],
    });

    const columns = BOARD_COLUMNS.map((status) => ({
      status,
      tasks: tasks.filter((t) => t.status === status),
    }));
    // Any task with a non-standard status is surfaced so nothing is hidden.
    const known = new Set(BOARD_COLUMNS);
    const other = tasks.filter((t) => !known.has(t.status));
    if (other.length) columns.push({ status: 'OTHER', tasks: other });

    res.json({ project, columns });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * PUT /api/projects/tasks/:id/move — move a task to a column (and position) on
 * the board. Sets status + boardRank in one call for drag-and-drop.
 */
const moveTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, boardRank } = req.body;
    if (status && !BOARD_COLUMNS.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Allowed: ${BOARD_COLUMNS.join(', ')}` });
    }

    const task = await prisma.task.findFirst({
      where: { id, ...(await scopedTaskAccessWhere(req.user)) },
    });
    if (!task) return res.status(403).json({ error: 'Access denied for requested task.' });

    const isCompletion = status === 'COMPLETED' && task.status !== 'COMPLETED';
    const updated = await prisma.task.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(boardRank !== undefined && { boardRank: Number(boardRank) }),
        ...(isCompletion ? { completedAt: new Date() } : {}),
        ...(status && status !== 'COMPLETED' && task.status === 'COMPLETED' ? { completedAt: null } : {}),
      },
      include: { assignee: { select: { id: true, firstName: true, lastName: true } } },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

/** GET /api/projects/:id/costing — full project costing breakdown. */
const getProjectCosting = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await prisma.project.findFirst({
      where: { id, ...(await scopedProjectAccessWhere(req.user)) },
      select: { id: true },
    });
    if (!project) return res.status(403).json({ error: 'Access denied for requested project.' });

    const costing = await computeProjectCosting(id);
    if (!costing) return res.status(404).json({ error: 'Project not found' });
    res.json(costing);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * PUT /api/projects/:projectId/resource-rate — set a resource's cost & bill
 * rates (creates the resource link if missing). Manager/Admin only.
 */
const setResourceRate = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { employeeId, costRate, billRate, allocationPct } = req.body;
    if (!employeeId) return res.status(400).json({ error: 'employeeId is required' });

    const project = await prisma.project.findFirst({
      where: { id: projectId, ...(await scopedProjectAccessWhere(req.user)) },
      select: { id: true },
    });
    if (!project) return res.status(403).json({ error: 'Access denied for requested project.' });

    const data = {
      ...(costRate !== undefined && { costRate: Number(costRate) }),
      ...(billRate !== undefined && { billRate: Number(billRate) }),
      ...(allocationPct !== undefined && { allocationPct: Number(allocationPct) }),
    };
    const resource = await prisma.projectResource.upsert({
      where: { projectId_employeeId: { projectId, employeeId } },
      update: data,
      create: { projectId, employeeId, ...data },
    });
    res.json(resource);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  addExpense,
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  getProjectBoard,
  moveTask,
  getProjectCosting,
  setResourceRate,
};
