/**
 * @fileoverview Sprint management + burndown.
 * Sprints group tasks into time-boxed iterations. The burndown is computed from
 * real task completion timestamps (completedAt) against an ideal linear line, so
 * no daily snapshot job is required.
 * @module controllers/sprintController
 */

const prisma = require('../config/database');

/** Work unit for a task: story points, else estimated hours, else 1 (count). */
const pointOf = (t, unit) => {
  if (unit === 'tasks') return 1;
  if (unit === 'hours') return t.estimatedHours || 0;
  return t.storyPoints != null ? t.storyPoints : 0;
};

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const endOfDay = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };

const createSprint = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { name, goal, startDate, endDate, status } = req.body;
    if (!name || !startDate || !endDate) {
      return res.status(400).json({ error: 'name, startDate and endDate are required' });
    }
    if (new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({ error: 'endDate must be on or after startDate' });
    }
    const sprint = await prisma.sprint.create({
      data: { projectId, name, goal: goal || null, startDate: new Date(startDate), endDate: new Date(endDate), status: status || 'PLANNING' },
    });
    res.status(201).json(sprint);
  } catch (error) {
    console.error('[CREATE SPRINT ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const getSprints = async (req, res) => {
  try {
    const { projectId } = req.params;
    const sprints = await prisma.sprint.findMany({
      where: { projectId },
      orderBy: { startDate: 'desc' },
      include: { _count: { select: { tasks: true } } },
    });
    res.json(sprints);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const updateSprint = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, goal, startDate, endDate, status } = req.body;
    const sprint = await prisma.sprint.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(goal !== undefined && { goal }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(status && { status }),
      },
    });
    res.json(sprint);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

/** PUT /api/projects/tasks/:id/sprint — assign or unassign a task to a sprint. */
const assignTaskToSprint = async (req, res) => {
  try {
    const { id } = req.params;
    const { sprintId } = req.body; // null to remove
    const task = await prisma.task.update({ where: { id }, data: { sprintId: sprintId || null } });
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * GET /api/projects/sprints/:id/burndown — ideal vs actual remaining work per day.
 * Actual remaining is derived from task.completedAt, so it reflects real progress.
 */
const getBurndown = async (req, res) => {
  try {
    const { id } = req.params;
    const sprint = await prisma.sprint.findUnique({ where: { id }, include: { tasks: true } });
    if (!sprint) return res.status(404).json({ error: 'Sprint not found' });

    // Choose the work unit: story points if present, else estimated hours, else task count.
    let unit = 'points';
    let total = sprint.tasks.reduce((s, t) => s + pointOf(t, 'points'), 0);
    if (total === 0) { unit = 'hours'; total = sprint.tasks.reduce((s, t) => s + pointOf(t, 'hours'), 0); }
    if (total === 0) { unit = 'tasks'; total = sprint.tasks.length; }

    const start = startOfDay(sprint.startDate);
    const end = startOfDay(sprint.endDate);
    const dayMs = 24 * 60 * 60 * 1000;
    const totalDays = Math.max(1, Math.round((end - start) / dayMs));
    const today = startOfDay(new Date());

    const days = [];
    for (let i = 0; i <= totalDays; i++) {
      const day = new Date(start.getTime() + i * dayMs);
      const ideal = Math.round(total * (1 - i / totalDays) * 100) / 100;

      let remaining = null;
      if (day <= today) {
        const cutoff = endOfDay(day);
        const completed = sprint.tasks
          .filter((t) => t.status === 'COMPLETED' && t.completedAt && new Date(t.completedAt) <= cutoff)
          .reduce((s, t) => s + pointOf(t, unit), 0);
        remaining = Math.round((total - completed) * 100) / 100;
      }
      days.push({ date: day.toISOString().slice(0, 10), ideal, remaining });
    }

    res.json({ sprintId: id, name: sprint.name, status: sprint.status, unit, total, taskCount: sprint.tasks.length, days });
  } catch (error) {
    console.error('[BURNDOWN ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { createSprint, getSprints, updateSprint, assignTaskToSprint, getBurndown };
