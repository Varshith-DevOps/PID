const request = require('supertest');
const app = require('../src/index');
const prisma = require('../src/config/database');

describe('Enterprise Access Control Hardening', () => {
  let employeeToken;
  let adminToken;
  let managerToken;
  let employeeId;
  let otherEmployeeId;

  beforeAll(async () => {
    const empRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'rajesh.kumar@company.com', password: 'employee123' });
    employeeToken = empRes.body.token;

    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@hrms.com', password: 'admin123' });
    adminToken = adminRes.body.token;

    const managerRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'manager@hrms.com', password: 'admin123' });
    managerToken = managerRes.body.token;

    const employee = await prisma.employee.findUnique({ where: { email: 'rajesh.kumar@company.com' } });
    const otherEmployee = await prisma.employee.findUnique({ where: { email: 'priya.sharma@company.com' } });
    employeeId = employee.id;
    otherEmployeeId = otherEmployee.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('enriches authenticated profile responses with linked employee id', async () => {
    const res = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.employeeId).toBeTruthy();
  });

  it('serves a personalized employee dashboard without requiring admin report grants', async () => {
    const res = await request(app)
      .get('/api/dashboard/me')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.dashboardType).toBe('EMPLOYEE');
    expect(res.body).toHaveProperty('focus');
    expect(res.body.cards).toHaveProperty('tasks');
    expect(res.body.cards).toHaveProperty('teamAvailability');
  });

  it('serves a manager cockpit with team workload and availability details', async () => {
    const res = await request(app)
      .get('/api/dashboard/me')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.dashboardType).toBe('MANAGER');
    expect(res.body.cards).toHaveProperty('workload');
    expect(res.body.cards).toHaveProperty('teamAvailability');
  });

  it('serves an admin executive dashboard with payroll and workforce signals', async () => {
    const res = await request(app)
      .get('/api/dashboard/me')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.dashboardType).toBe('ADMIN');
    expect(res.body).toHaveProperty('payroll');
    expect(res.body.cards).toHaveProperty('departments');
  });

  it('allows employees to create their own expense claims through default EXPENSES grants', async () => {
    const res = await request(app)
      .post('/api/expenses/claims')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        title: 'Local travel reimbursement',
        category: 'TRAVEL',
        amount: 250,
        description: 'Regression test claim for employee self-service access',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('employeeId');
    expect(res.body.status).toBe('PENDING');
  });

  it('blocks employees from finance-approving expense claims', async () => {
    const claim = await prisma.expenseClaim.findFirst();

    const res = await request(app)
      .put(`/api/expenses/claims/${claim.id}/finance-approve`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ remarks: 'Should not be allowed', markAsPaid: true });

    expect(res.status).toBe(403);
  });

  it('rejects invalid expense claim amounts', async () => {
    const res = await request(app)
      .post('/api/expenses/claims')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        title: 'Negative claim regression',
        category: 'TRAVEL',
        amount: -1,
        description: 'Invalid amount should be rejected',
      });

    expect(res.status).toBe(400);
  });

  it('prevents employees from querying another employee expense claims', async () => {
    const res = await request(app)
      .get(`/api/expenses/claims?employeeId=${otherEmployeeId}`)
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(403);
  });

  it('prevents employees from reading another employee leave balance', async () => {
    const res = await request(app)
      .get(`/api/leave/balance?employeeId=${otherEmployeeId}`)
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(403);
  });

  it('validates timesheet ownership and hour boundaries', async () => {
    const otherEmployeeRes = await request(app)
      .post('/api/timesheet')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        employeeId: otherEmployeeId,
        date: '2026-06-10',
        hoursWorked: 8,
        description: 'Unauthorized timesheet',
      });

    expect(otherEmployeeRes.status).toBe(403);

    const boundaryRes = await request(app)
      .post('/api/timesheet')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        employeeId,
        date: '2026-06-10',
        hoursWorked: 25,
        description: 'Invalid hours',
      });

    expect(boundaryRes.status).toBe(400);
  });

  it('keeps project task collection route from being swallowed by project id route', async () => {
    const res = await request(app)
      .get('/api/projects/tasks/all')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('lets employees see assigned tasks and rolls timesheet hours into task actuals', async () => {
    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `QA Timesheet Project ${Date.now()}`,
        managerId: employeeId,
        status: 'ACTIVE',
      });

    expect(projectRes.status).toBe(201);

    const taskRes = await request(app)
      .post('/api/projects/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `QA Assigned Task ${Date.now()}`,
        projectId: projectRes.body.id,
        assigneeId: employeeId,
        estimatedHours: 8,
      });

    expect(taskRes.status).toBe(201);

    const employeeTasksRes = await request(app)
      .get('/api/projects/tasks/all')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(employeeTasksRes.status).toBe(200);
    expect(employeeTasksRes.body.some((task) => task.id === taskRes.body.id)).toBe(true);

    const timesheetRes = await request(app)
      .post('/api/timesheet')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        employeeId,
        taskId: taskRes.body.id,
        date: '2026-06-11',
        hoursWorked: 6,
        description: 'Task rollup regression',
      });

    expect(timesheetRes.status).toBe(200);

    const updatedTask = await prisma.task.findUnique({ where: { id: taskRes.body.id } });
    expect(updatedTask.actualHours).toBe(6);
  });

  it('rejects timesheet logging against a task assigned to another employee', async () => {
    const project = await prisma.project.findFirst();
    const taskRes = await request(app)
      .post('/api/projects/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `QA Other Employee Task ${Date.now()}`,
        projectId: project.id,
        assigneeId: otherEmployeeId,
      });

    expect(taskRes.status).toBe(201);

    const res = await request(app)
      .post('/api/timesheet')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        employeeId,
        taskId: taskRes.body.id,
        date: '2026-06-12',
        hoursWorked: 4,
        description: 'Wrong task assignment',
      });

    expect(res.status).toBe(400);
  });

  it('integrates asset module with admin create and employee self-service view only', async () => {
    const tag = `QA-ASSET-${Date.now()}`;
    const createRes = await request(app)
      .post('/api/assets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ assetTag: tag, name: 'QA Laptop', category: 'Laptop' });

    expect(createRes.status).toBe(201);

    const employeeCreateRes = await request(app)
      .post('/api/assets')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ assetTag: `${tag}-EMP`, name: 'Unauthorized Asset', category: 'Laptop' });

    expect(employeeCreateRes.status).toBe(403);

    const employeeListRes = await request(app)
      .get('/api/assets')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(employeeListRes.status).toBe(200);
    expect(employeeListRes.body.find((asset) => asset.assetTag === tag)).toBeUndefined();
  });

  it('integrates learning, helpdesk and notification module permissions', async () => {
    const courseRes = await request(app)
      .post('/api/learning/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: `QA Course ${Date.now()}`, category: 'Compliance' });

    expect(courseRes.status).toBe(201);

    const enrollmentRes = await request(app)
      .post('/api/learning/enrollments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ courseId: courseRes.body.id, employeeId });

    expect(enrollmentRes.status).toBe(201);

    const employeeEnrollmentsRes = await request(app)
      .get('/api/learning/enrollments')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(employeeEnrollmentsRes.status).toBe(200);
    expect(employeeEnrollmentsRes.body.every((item) => item.employeeId === employeeId)).toBe(true);

    const ticketRes = await request(app)
      .post('/api/helpdesk/tickets')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ category: 'HR', subject: 'QA ticket', description: 'Regression helpdesk ticket' });

    expect(ticketRes.status).toBe(201);
    expect(ticketRes.body.employeeId).toBe(employeeId);

    const notificationDeniedRes = await request(app)
      .post('/api/notifications')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ title: 'Unauthorized', message: 'Employees should not broadcast' });

    expect(notificationDeniedRes.status).toBe(403);

    const notificationRes = await request(app)
      .post('/api/notifications')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ employeeId, title: 'QA notification', message: 'Regression notification' });

    expect(notificationRes.status).toBe(201);

    const inboxRes = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(inboxRes.status).toBe(200);
    expect(inboxRes.body.some((item) => item.id === notificationRes.body.id)).toBe(true);
  });

  it('requires REPORTS.EXPORT permission for report exports', async () => {
    const employeeRes = await request(app)
      .post('/api/reports/export')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ reportType: 'general' });

    expect(employeeRes.status).toBe(403);

    const adminRes = await request(app)
      .post('/api/reports/export')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reportType: 'general' });

    expect(adminRes.status).toBe(200);
  });
});
