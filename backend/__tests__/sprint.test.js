const request = require('supertest');
const app = require('../src/index');
const prisma = require('../src/config/database');

const PNAME = 'QA-SPRINT-PROJECT';

async function cleanup() {
  const projects = await prisma.project.findMany({ where: { name: PNAME } }).catch(() => []);
  for (const p of projects) {
    await prisma.task.deleteMany({ where: { projectId: p.id } }).catch(() => {});
    await prisma.sprint.deleteMany({ where: { projectId: p.id } }).catch(() => {});
    await prisma.projectResource.deleteMany({ where: { projectId: p.id } }).catch(() => {});
    await prisma.project.delete({ where: { id: p.id } }).catch(() => {});
  }
}

describe('Sprints + burndown', () => {
  let adminToken, projectId, sprintId, empId;

  beforeAll(async () => {
    await cleanup();
    const a = await request(app).post('/api/auth/login').send({ email: 'admin@hrms.com', password: 'admin123' });
    adminToken = a.body.token;
    const emp = await prisma.employee.findUnique({ where: { email: 'rajesh.kumar@company.com' } });
    empId = emp.id;
    const project = await prisma.project.create({ data: { name: PNAME, managerId: emp.id, status: 'ACTIVE' } });
    projectId = project.id;
  });

  afterAll(async () => { await cleanup(); await prisma.$disconnect(); });

  it('creates a sprint', async () => {
    const res = await request(app).post(`/api/projects/${projectId}/sprints`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Sprint 1', goal: 'Ship MVP', startDate: '2099-01-01', endDate: '2099-01-10' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Sprint 1');
    sprintId = res.body.id;
  });

  it('rejects a sprint with end before start', async () => {
    const res = await request(app).post(`/api/projects/${projectId}/sprints`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Bad', startDate: '2099-02-10', endDate: '2099-02-01' });
    expect(res.status).toBe(400);
  });

  it('lists sprints with task counts', async () => {
    const res = await request(app).get(`/api/projects/${projectId}/sprints`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0]._count).toHaveProperty('tasks');
  });

  it('assigns tasks to the sprint and computes a burndown from completion', async () => {
    // 3 tasks, 5 story points each = 15 total; complete one inside the sprint window.
    const t1 = await prisma.task.create({ data: { title: 'T1', projectId, assigneeId: empId, storyPoints: 5, status: 'COMPLETED', completedAt: new Date('2099-01-03'), sprintId } });
    await prisma.task.create({ data: { title: 'T2', projectId, assigneeId: empId, storyPoints: 5, status: 'TODO', sprintId } });
    await prisma.task.create({ data: { title: 'T3', projectId, assigneeId: empId, storyPoints: 5, status: 'TODO', sprintId } });

    const res = await request(app).get(`/api/projects/sprints/${sprintId}/burndown`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.unit).toBe('points');
    expect(res.body.total).toBe(15);
    // Ideal line starts at total and ends at 0.
    expect(res.body.days[0].ideal).toBe(15);
    expect(res.body.days[res.body.days.length - 1].ideal).toBe(0);
    // Sprint is far in the future, so "remaining" (actual) is null for future days.
    expect(res.body.days[res.body.days.length - 1].remaining).toBeNull();
    expect(t1.storyPoints).toBe(5);
  });

  it('updates sprint status to ACTIVE', async () => {
    const res = await request(app).put(`/api/projects/sprints/${sprintId}`)
      .set('Authorization', `Bearer ${adminToken}`).send({ status: 'ACTIVE' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ACTIVE');
  });
});
