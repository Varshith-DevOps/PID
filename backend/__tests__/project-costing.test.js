const request = require('supertest');
const app = require('../src/index');
const prisma = require('../src/config/database');

const PNAME = 'QA-COSTING-PROJECT';

async function cleanup() {
  const projects = await prisma.project.findMany({ where: { name: PNAME } }).catch(() => []);
  for (const p of projects) {
    await prisma.task.deleteMany({ where: { projectId: p.id } }).catch(() => {});
    await prisma.projectExpense.deleteMany({ where: { projectId: p.id } }).catch(() => {});
    await prisma.projectResource.deleteMany({ where: { projectId: p.id } }).catch(() => {});
    await prisma.project.delete({ where: { id: p.id } }).catch(() => {});
  }
}

describe('Project costing + Jira board', () => {
  let adminToken, projectId, taskBillableId, resourceEmpId;

  beforeAll(async () => {
    await cleanup();
    const a = await request(app).post('/api/auth/login').send({ email: 'admin@hrms.com', password: 'admin123' });
    adminToken = a.body.token;
    const emp = await prisma.employee.findUnique({ where: { email: 'rajesh.kumar@company.com' } });
    resourceEmpId = emp.id;

    const project = await prisma.project.create({
      data: { name: PNAME, budget: 50000, currency: 'INR', managerId: emp.id, status: 'ACTIVE', companyId: emp.companyId },
    });
    projectId = project.id;

    // Resource with explicit rates (cost ₹1000/hr, bill ₹2000/hr).
    await prisma.projectResource.create({ data: { projectId, employeeId: emp.id, costRate: 1000, billRate: 2000 } });

    // Billable task: 10h -> cost 10000, revenue 20000.
    const t1 = await prisma.task.create({ data: { title: 'Billable', projectId, assigneeId: emp.id, actualHours: 10, billable: true, status: 'TODO', companyId: emp.companyId } });
    taskBillableId = t1.id;
    // Non-billable task: 5h -> cost 5000, revenue 0.
    await prisma.task.create({ data: { title: 'Internal', projectId, assigneeId: emp.id, actualHours: 5, billable: false, status: 'TODO', companyId: emp.companyId } });
    // Expense ₹3000.
    await prisma.projectExpense.create({ data: { projectId, description: 'Cloud', amount: 3000 } });
  });

  afterAll(async () => { await cleanup(); await prisma.$disconnect(); });

  it('computes costing from real per-resource rates (no more ₹500 hardcode)', async () => {
    const res = await request(app).get(`/api/projects/${projectId}/costing`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const c = res.body;
    expect(c.laborCost).toBe(15000);      // 10*1000 + 5*1000
    expect(c.expenses).toBe(3000);
    expect(c.totalCost).toBe(18000);      // labor + expenses
    expect(c.revenue).toBe(20000);        // only the billable task: 10*2000
    expect(c.margin).toBe(2000);          // 20000 - 18000
    expect(c.marginPct).toBe(10);
    expect(c.budgetUsage).toBe(36);       // 18000 / 50000
  });

  it('returns a Jira board grouped by status column', async () => {
    const res = await request(app).get(`/api/projects/${projectId}/board`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const todo = res.body.columns.find((col) => col.status === 'TODO');
    expect(todo.tasks.length).toBe(2);
    expect(res.body.columns.map((c) => c.status)).toEqual(
      expect.arrayContaining(['TODO', 'IN_PROGRESS', 'AWAITING_APPROVAL', 'REWORK', 'COMPLETED']),
    );
  });

  it('moves a task across columns (status + rank) like a drag-drop', async () => {
    const res = await request(app).put(`/api/projects/tasks/${taskBillableId}/move`)
      .set('Authorization', `Bearer ${adminToken}`).send({ status: 'IN_PROGRESS', boardRank: 1.5 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('IN_PROGRESS');
    const t = await prisma.task.findUnique({ where: { id: taskBillableId } });
    expect(t.boardRank).toBe(1.5);
  });

  it('rejects an invalid board status on move', async () => {
    const res = await request(app).put(`/api/projects/tasks/${taskBillableId}/move`)
      .set('Authorization', `Bearer ${adminToken}`).send({ status: 'NONSENSE' });
    expect(res.status).toBe(400);
  });

  it('sets a resource cost/bill rate via the API (upsert)', async () => {
    const res = await request(app).put(`/api/projects/${projectId}/resource-rate`)
      .set('Authorization', `Bearer ${adminToken}`).send({ employeeId: resourceEmpId, costRate: 1200, billRate: 2500 });
    expect(res.status).toBe(200);
    expect(res.body.costRate).toBe(1200);
    expect(res.body.billRate).toBe(2500);
  });
});
