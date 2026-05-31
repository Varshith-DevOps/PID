/**
 * @fileoverview Project and task management controller.
 * Provides CRUD for projects, tasks, resources, and expense tracking.
 * @module controllers/projectController
 */

const prisma = require('../config/database');

const getProjects = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const where = { isActive: true };

    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

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
    const { name, description, startDate, deadline, budget, managerId, resourceIds } = req.body;

    if (!name || !managerId) {
      return res.status(400).json({ error: 'Name and manager required' });
    }

    const project = await prisma.project.create({
      data: {
        name,
        description,
        startDate: startDate ? new Date(startDate) : null,
        deadline: deadline ? new Date(deadline) : null,
        budget: budget || 0,
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
    const where = {};

    if (projectId) where.projectId = projectId;
    if (assigneeId) where.assigneeId = assigneeId;
    if (status) where.status = status;
    if (priority) where.priority = priority;

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
    const { title, description, projectId, assigneeId, estimatedHours, actualHours, deadline, priority, status } = req.body;

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) return res.status(404).json({ error: 'Task not found' });

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
    await prisma.task.delete({ where: { id } });
    res.json({ message: 'Task deleted' });
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
};