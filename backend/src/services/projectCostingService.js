/**
 * @fileoverview Project costing engine. Replaces the previously hardcoded
 * ₹500/hour labor rate with real per-resource cost & bill rates:
 *   labor cost  = Σ (task.actualHours × assignee costRate)
 *   revenue     = Σ (billable task.actualHours × assignee billRate)
 *   total cost  = labor cost + project expenses
 *   margin      = revenue − total cost
 * Falls back to DEFAULT_HOURLY_COST_RATE when a resource has no explicit rate,
 * preserving sensible behavior for projects created before rates existed.
 * @module services/projectCostingService
 */

const prisma = require('../config/database');
const { roundMoney } = require('../utils/money');

const DEFAULT_COST_RATE = Number(process.env.DEFAULT_HOURLY_COST_RATE || 500);

/**
 * Compute the full costing breakdown for a project.
 * @param {string} projectId
 * @returns {Promise<object|null>}
 */
async function computeProjectCosting(projectId) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      tasks: { include: { assignee: { select: { id: true, firstName: true, lastName: true } } } },
      expenses: true,
      resources: true,
    },
  });
  if (!project) return null;

  // Per-employee rate lookup from the project's resource roster.
  const rateByEmployee = {};
  for (const r of project.resources) {
    rateByEmployee[r.employeeId] = {
      cost: r.costRate > 0 ? r.costRate : DEFAULT_COST_RATE,
      bill: r.billRate || 0,
    };
  }

  let laborCost = 0;
  let revenue = 0;
  let totalHours = 0;
  let billableHours = 0;
  const byTask = [];

  for (const t of project.tasks) {
    const rate = rateByEmployee[t.assigneeId] || { cost: DEFAULT_COST_RATE, bill: 0 };
    const hours = t.actualHours || 0;
    const cost = roundMoney(hours * rate.cost);
    const isBillable = t.billable !== false && project.billingType !== 'NON_BILLABLE';
    const taskRevenue = isBillable ? roundMoney(hours * rate.bill) : 0;

    laborCost = roundMoney(laborCost + cost);
    revenue = roundMoney(revenue + taskRevenue);
    totalHours = roundMoney(totalHours + hours);
    if (isBillable) billableHours = roundMoney(billableHours + hours);

    byTask.push({
      taskId: t.id,
      title: t.title,
      assignee: t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : null,
      hours,
      costRate: rate.cost,
      billRate: rate.bill,
      cost,
      revenue: taskRevenue,
      billable: isBillable,
    });
  }

  const expenses = roundMoney(project.expenses.reduce((s, e) => s + (e.amount || 0), 0));
  const totalCost = roundMoney(laborCost + expenses);
  const margin = roundMoney(revenue - totalCost);
  const marginPct = revenue > 0 ? roundMoney((margin / revenue) * 100) : 0;
  const budgetUsage = project.budget > 0 ? roundMoney((totalCost / project.budget) * 100) : 0;
  const budgetRemaining = roundMoney((project.budget || 0) - totalCost);

  return {
    projectId,
    projectName: project.name,
    currency: project.currency || 'INR',
    billingType: project.billingType,
    budget: project.budget || 0,
    laborCost,
    expenses,
    totalCost,
    revenue,
    margin,
    marginPct,
    budgetUsage,
    budgetRemaining,
    totalHours,
    billableHours,
    byTask,
  };
}

module.exports = { computeProjectCosting, DEFAULT_COST_RATE };
