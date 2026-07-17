const prisma = require('../../config/database');
const { getEmployeeScopeIds, getLinkedEmployeeId } = require('../accessControl');

const ADMIN_PROJECT_ROLES = new Set(['SUPER_ADMIN', 'ADMIN']);
const DONE_STATUSES = new Set(['COMPLETED', 'DONE']);

const hasAdminProjectAccess = (user) => Boolean(user?.role && ADMIN_PROJECT_ROLES.has(user.role));

const scopedProjectAccessWhere = async (user) => {
  if (hasAdminProjectAccess(user)) return {};

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

const formatDate = (value) => value ? new Date(value).toISOString().slice(0, 10) : 'No date';
const fullName = (employee) => [employee?.firstName, employee?.lastName].filter(Boolean).join(' ') || 'Unassigned';

const buildProjectSummary = (project, today = new Date()) => {
  const tasks = project.tasks || [];
  const completedTasks = tasks.filter((task) => DONE_STATUSES.has(String(task.status || '').toUpperCase()));
  const pendingTasks = tasks.filter((task) => !DONE_STATUSES.has(String(task.status || '').toUpperCase()));
  const delayedTasks = pendingTasks.filter((task) => task.deadline && new Date(task.deadline) < today);
  const completion = tasks.length ? Math.round((completedTasks.length / tasks.length) * 100) : 0;
  const allocation = (project.resources || []).reduce((sum, resource) => sum + (Number(resource.allocationPct) || 0), 0);

  return {
    id: project.id,
    name: project.name,
    status: project.status,
    manager: fullName(project.manager),
    startDate: formatDate(project.startDate),
    deadline: formatDate(project.deadline),
    completion,
    totalTasks: tasks.length,
    pendingTasks: pendingTasks.length,
    completedTasks: completedTasks.length,
    delayedTasks: delayedTasks.length,
    resourceCount: project.resources?.length || 0,
    allocation,
    resources: (project.resources || []).map((resource) => ({
      name: fullName(resource.employee),
      allocationPct: resource.allocationPct || 0,
    })),
    tasks: tasks.map((task) => ({
      title: task.title,
      status: task.status,
      priority: task.priority,
      deadline: formatDate(task.deadline),
      assignee: fullName(task.assignee),
    })),
    milestones: (project.sprints || []).map((sprint) => ({
      name: sprint.name,
      status: sprint.status,
      startDate: formatDate(sprint.startDate),
      endDate: formatDate(sprint.endDate),
    })),
  };
};

const lineList = (items, emptyText) => items.length ? items.map((item, index) => `${index + 1}. ${item}`).join('\n') : emptyText;

const answerProjectQuestion = (question, summaries) => {
  const q = String(question || '').toLowerCase();
  const today = new Date();
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);

  if (!summaries.length) return 'No accessible active project data was found.';

  if (q.includes('delayed')) {
    const delayed = summaries.filter((project) => project.delayedTasks > 0 || (project.deadline !== 'No date' && new Date(project.deadline) < today && project.completion < 100));
    return lineList(delayed.map((project) => `${project.name}: ${project.delayedTasks} delayed task(s), deadline ${project.deadline}, completion ${project.completion}%`), 'No delayed projects or delayed tasks were found.');
  }

  if (q.includes('due this week') || q.includes('deadline')) {
    const due = summaries.filter((project) => project.deadline !== 'No date' && new Date(project.deadline) >= today && new Date(project.deadline) <= weekEnd);
    return lineList(due.map((project) => `${project.name}: due ${project.deadline}, completion ${project.completion}%, manager ${project.manager}`), 'No accessible projects are due in the next 7 days.');
  }

  if (q.includes('who is working') || q.includes('assigned') || q.includes('resource')) {
    return summaries.map((project) => {
      const people = project.resources.map((resource) => `${resource.name}${resource.allocationPct ? ` (${resource.allocationPct}%)` : ''}`).join(', ') || 'No resources assigned';
      return `${project.name}: ${people}`;
    }).join('\n');
  }

  if (q.includes('workload') || q.includes('most tasks')) {
    const workload = new Map();
    summaries.forEach((project) => {
      project.tasks.forEach((task) => {
        const current = workload.get(task.assignee) || { total: 0, pending: 0 };
        current.total += 1;
        if (!DONE_STATUSES.has(String(task.status || '').toUpperCase())) current.pending += 1;
        workload.set(task.assignee, current);
      });
    });
    const rows = [...workload.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
      .map(([name, stats]) => `${name}: ${stats.total} task(s), ${stats.pending} pending`);
    return lineList(rows, 'No task workload data was found.');
  }

  if (q.includes('highest completion') || q.includes('highest progress')) {
    const best = [...summaries].sort((a, b) => b.completion - a.completion)[0];
    return `${best.name} has the highest completion at ${best.completion}% (${best.completedTasks}/${best.totalTasks} tasks complete).`;
  }

  if (q.includes('pending')) {
    const rows = summaries.flatMap((project) => project.tasks
      .filter((task) => !DONE_STATUSES.has(String(task.status || '').toUpperCase()))
      .slice(0, 8)
      .map((task) => `${project.name}: ${task.title} (${task.status}, ${task.assignee}, due ${task.deadline})`));
    return lineList(rows.slice(0, 20), 'No pending tasks were found.');
  }

  if (q.includes('completed')) {
    const rows = summaries.map((project) => `${project.name}: ${project.completedTasks} completed task(s), ${project.completion}% complete`);
    return lineList(rows, 'No completed task data was found.');
  }

  if (q.includes('milestone') || q.includes('timeline')) {
    const rows = summaries.flatMap((project) => project.milestones.map((milestone) => `${project.name}: ${milestone.name} (${milestone.status}) ${milestone.startDate} to ${milestone.endDate}`));
    return lineList(rows.slice(0, 20), 'No sprint or milestone timeline data was found.');
  }

  if (q.includes('risk')) {
    const risks = summaries.filter((project) => project.delayedTasks > 0 || project.completion < 50);
    return lineList(risks.map((project) => `${project.name}: ${project.delayedTasks} delayed task(s), ${project.completion}% complete, deadline ${project.deadline}`), 'No obvious schedule or progress risks were found.');
  }

  return summaries.map((project) => `${project.name}: ${project.completion}% complete, ${project.pendingTasks} pending, ${project.completedTasks} completed, ${project.resourceCount} resource(s), deadline ${project.deadline}`).join('\n');
};

const askProjectQuestion = async (question, user) => {
  const accessWhere = await scopedProjectAccessWhere(user);
  const projects = await prisma.project.findMany({
    where: { AND: [{ isActive: true }, accessWhere] },
    include: {
      manager: { select: { id: true, firstName: true, lastName: true } },
      resources: { include: { employee: { select: { id: true, firstName: true, lastName: true } } } },
      tasks: { include: { assignee: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { deadline: 'asc' } },
      sprints: { orderBy: { startDate: 'asc' } },
    },
    orderBy: [{ deadline: 'asc' }, { name: 'asc' }],
    take: 100,
  });

  const summaries = projects.map((project) => buildProjectSummary(project));
  return {
    success: true,
    agentName: 'Atlas',
    engine: 'rule-based-database-query',
    readOnly: true,
    answer: answerProjectQuestion(question, summaries),
    meta: { projectCount: summaries.length },
  };
};

module.exports = { askProjectQuestion };
