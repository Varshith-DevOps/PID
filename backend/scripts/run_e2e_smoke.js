/**
 * Non-destructive production-like E2E smoke suite for NexusHR.
 *
 * Requires the backend to be running at http://localhost:5000.
 * Optionally checks frontend pages at FRONTEND_URL, default http://localhost:3000.
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const API_URL = process.env.E2E_API_URL || 'http://localhost:5000/api';
const HEALTH_URL = process.env.E2E_HEALTH_URL || 'http://localhost:5000/health';
const FRONTEND_URL = process.env.E2E_FRONTEND_URL || 'http://localhost:3000';
const RUN_ID = `E2E-${Date.now()}`;
const reportPath = path.resolve(__dirname, '../../docs/HRMS_E2E_Execution_Report.md');

const results = [];
const cleanup = {
  employeeIds: [],
  userEmails: [],
  leaveIds: [],
  attendanceIds: [],
  projectIds: [],
  taskIds: [],
  timesheetIds: [],
  expenseClaimIds: [],
  jobOpeningIds: [],
  applicantIds: [],
};

const record = (id, module, name, status, details = '', severity = 'Medium') => {
  results.push({ id, module, name, status, details, severity });
  const marker = status === 'PASS' ? 'PASS' : 'FAIL';
  console.log(`[${marker}] ${id} ${module} - ${name}: ${details}`);
};

const request = async (method, url, { token, body, expected, raw = false } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined && !raw) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${API_URL}${url}`, {
    method,
    headers,
    body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
  });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();
  if (expected && !expected.includes(response.status)) {
    const message = typeof data === 'string' ? data : JSON.stringify(data);
    throw new Error(`${method} ${url} returned ${response.status}, expected ${expected.join('/')} :: ${message}`);
  }
  return { response, data };
};

const login = async (email, password) => {
  const { data } = await request('POST', '/auth/login', {
    body: { email, password },
    expected: [200],
  });
  return {
    token: data.token,
    user: data.user,
    permissions: data.permissions || [],
  };
};

const findSeedEmployee = async (email) => {
  const employee = await prisma.employee.findUnique({ where: { email }, include: { department: true, user: true } });
  if (!employee) throw new Error(`Seed employee not found: ${email}`);
  return employee;
};

const safeCleanup = async () => {
  try {
    await prisma.projectExpense.deleteMany({ where: { projectId: { in: cleanup.projectIds } } });
    await prisma.timesheet.deleteMany({ where: { id: { in: cleanup.timesheetIds } } });
    await prisma.task.deleteMany({ where: { id: { in: cleanup.taskIds } } });
    await prisma.projectResource.deleteMany({ where: { projectId: { in: cleanup.projectIds } } });
    await prisma.project.deleteMany({ where: { id: { in: cleanup.projectIds } } });
    await prisma.expenseClaim.deleteMany({ where: { id: { in: cleanup.expenseClaimIds } } });
    await prisma.leave.deleteMany({ where: { id: { in: cleanup.leaveIds } } });
    await prisma.attendance.deleteMany({ where: { id: { in: cleanup.attendanceIds } } });
    await prisma.jobApplicant.deleteMany({ where: { id: { in: cleanup.applicantIds } } });
    await prisma.jobOpening.deleteMany({ where: { id: { in: cleanup.jobOpeningIds } } });
    await prisma.salaryStructure.deleteMany({ where: { employeeId: { in: cleanup.employeeIds } } });
    await prisma.changeHistory.deleteMany({ where: { employeeId: { in: cleanup.employeeIds } } });
    await prisma.employee.deleteMany({ where: { id: { in: cleanup.employeeIds } } });
    const users = await prisma.user.findMany({ where: { email: { in: cleanup.userEmails } }, select: { id: true } });
    const userIds = users.map((user) => user.id);
    await prisma.permission.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { email: { in: cleanup.userEmails } } });
  } catch (error) {
    console.error(`[CLEANUP WARNING] ${error.message}`);
  }
};

const writeReport = () => {
  const passed = results.filter((item) => item.status === 'PASS').length;
  const failed = results.filter((item) => item.status === 'FAIL').length;
  const total = results.length;
  const readiness = total ? Math.round((passed / total) * 100) : 0;
  const decision = failed === 0 ? 'GO for covered smoke scope' : 'NO-GO until failed smoke items are resolved';
  const now = new Date().toISOString();

  const rows = results.map((item) =>
    `| ${item.id} | ${item.module} | ${item.name} | ${item.status} | ${item.severity} | ${String(item.details).replace(/\|/g, '\\|')} |`
  ).join('\n');

  const failures = results
    .filter((item) => item.status === 'FAIL')
    .map((item) => `- **${item.id} ${item.module}**: ${item.details}`)
    .join('\n') || '- No failed E2E smoke checks in this run.';

  const report = `# HRMS E2E Execution Report

## Run Summary

- Run ID: ${RUN_ID}
- Executed At: ${now}
- Backend: ${API_URL}
- Frontend: ${FRONTEND_URL}
- Total Checks: ${total}
- Passed: ${passed}
- Failed: ${failed}
- Readiness Score: ${readiness}%
- Decision: ${decision}

## Scope Covered

- Backend health and frontend page availability
- Authentication and profile loading
- RBAC unauthorized access denial
- Employee onboarding API
- Salary structure setup
- Leave request and approval
- Attendance manual marking
- Recruitment job and applicant flow
- Project, task, timesheet, and task actual-hour rollup
- Expense claim manager and finance approval
- Payroll preflight availability
- Report export authorization
- Token tampering rejection

## Detailed Results

| ID | Module | Test | Status | Severity | Details |
| --- | --- | --- | --- | --- | --- |
${rows}

## Failed Items

${failures}

## Notes

- This was a non-destructive smoke run. The runner created unique ${RUN_ID} records and attempted to remove only those records during cleanup.
- It does not replace full payroll golden-data verification, cross-browser UI automation, mobile app testing, or performance testing.
- Existing Jest regression and frontend production build should be reviewed together with this report for release readiness.
`;

  fs.writeFileSync(reportPath, report, 'utf8');
};

const run = async () => {
  let admin;
  let employeeLogin;
  let superAdmin;
  let employee;
  let managerEmployee;
  let department;

  try {
    const health = await fetch(HEALTH_URL);
    if (!health.ok) throw new Error(`Health returned ${health.status}`);
    record('E2E-001', 'Platform', 'Backend health check', 'PASS', 'Backend health endpoint returned OK.', 'Critical');
  } catch (error) {
    record('E2E-001', 'Platform', 'Backend health check', 'FAIL', error.message, 'Critical');
    writeReport();
    process.exitCode = 1;
    return;
  }

  try {
    admin = await login('admin@hrms.com', 'admin123');
    employeeLogin = await login('rajesh.kumar@company.com', 'employee123');
    superAdmin = await login('superadmin@hrms.com', 'admin123');
    employee = await findSeedEmployee('rajesh.kumar@company.com');
    managerEmployee = employee;
    department = employee.department || await prisma.department.findFirst();
    record('E2E-002', 'Authentication', 'Admin and employee login', 'PASS', 'Admin, employee, and super admin sessions established.', 'Critical');
  } catch (error) {
    record('E2E-002', 'Authentication', 'Admin and employee login', 'FAIL', error.message, 'Critical');
    writeReport();
    process.exitCode = 1;
    return;
  }

  try {
    const { data } = await request('GET', '/auth/profile', { token: employeeLogin.token, expected: [200] });
    if (!data.employeeId) throw new Error('Profile did not include linked employeeId.');
    record('E2E-003', 'Authentication', 'Profile includes employee scope', 'PASS', `Linked employeeId returned: ${data.employeeId}.`, 'High');
  } catch (error) {
    record('E2E-003', 'Authentication', 'Profile includes employee scope', 'FAIL', error.message, 'High');
  }

  try {
    const { response } = await request('POST', '/employees', {
      token: employeeLogin.token,
      body: {
        firstName: 'Blocked',
        lastName: 'Employee',
        email: `blocked-${RUN_ID}@example.test`,
        jobTitle: 'Unauthorized',
        departmentId: department.id,
        salary: 1,
      },
    });
    if (response.status !== 403) throw new Error(`Expected 403, received ${response.status}.`);
    record('E2E-004', 'RBAC', 'Employee cannot create employee profile', 'PASS', 'Unauthorized HR action blocked.', 'Critical');
  } catch (error) {
    record('E2E-004', 'RBAC', 'Employee cannot create employee profile', 'FAIL', error.message, 'Critical');
  }

  let createdEmployee;
  try {
    const email = `qa.employee.${RUN_ID.toLowerCase()}@example.test`;
    const { data } = await request('POST', '/employees', {
      token: admin.token,
      body: {
        firstName: 'QA',
        lastName: `Employee ${RUN_ID}`,
        email,
        phone: '9876500001',
        jobTitle: 'QA E2E Analyst',
        departmentId: department.id,
        salary: 65000,
        managerId: managerEmployee.id,
        joinDate: '2026-06-17',
        panNumber: 'ABCDE1234F',
      },
      expected: [201],
    });
    createdEmployee = data;
    cleanup.employeeIds.push(data.id);
    cleanup.userEmails.push(email);
    record('E2E-005', 'Employee', 'Admin creates employee', 'PASS', `Created employee ${data.employeeId}.`, 'Critical');
  } catch (error) {
    record('E2E-005', 'Employee', 'Admin creates employee', 'FAIL', error.message, 'Critical');
  }

  if (createdEmployee) {
    try {
      await request('PUT', `/payroll/structure/${createdEmployee.id}`, {
        token: admin.token,
        body: {
          employeeId: createdEmployee.id,
          basicSalary: 30000,
          hra: 12000,
          da: 3000,
          conveyance: 2000,
          medical: 1500,
          specialAllowance: 16500,
          pfEnabled: true,
          tdsEnabled: true,
          professionalTaxEnabled: true,
        },
        expected: [200],
      });
      record('E2E-006', 'Payroll', 'Salary structure setup', 'PASS', 'Salary structure saved for created employee.', 'High');
    } catch (error) {
      record('E2E-006', 'Payroll', 'Salary structure setup', 'FAIL', error.message, 'High');
    }
  }

  try {
    const { data: leave } = await request('POST', '/leave', {
      token: employeeLogin.token,
      body: {
        employeeId: employee.id,
        leaveType: 'CASUAL',
        startDate: '2026-12-07',
        endDate: '2026-12-07',
        reason: `${RUN_ID} leave approval smoke`,
      },
      expected: [201],
    });
    cleanup.leaveIds.push(leave.id);
    await request('PUT', `/leave/${leave.id}/approve`, { token: admin.token, expected: [200] });
    record('E2E-007', 'Leave', 'Employee leave request approved', 'PASS', `Leave ${leave.id} approved.`, 'Critical');
  } catch (error) {
    record('E2E-007', 'Leave', 'Employee leave request approved', 'FAIL', error.message, 'Critical');
  }

  try {
    const { data } = await request('POST', '/attendance/mark', {
      token: admin.token,
      body: {
        employeeId: employee.id,
        date: '2026-12-08',
        status: 'PRESENT',
        notes: `${RUN_ID} manual attendance smoke`,
      },
      expected: [200],
    });
    cleanup.attendanceIds.push(data.id);
    record('E2E-008', 'Attendance', 'Admin marks attendance', 'PASS', `Attendance ${data.id} upserted.`, 'Critical');
  } catch (error) {
    record('E2E-008', 'Attendance', 'Admin marks attendance', 'FAIL', error.message, 'Critical');
  }

  try {
    const { data: job } = await request('POST', '/recruitment/jobs', {
      token: admin.token,
      body: {
        title: `${RUN_ID} QA Automation Engineer`,
        departmentId: department.id,
        description: 'E2E smoke job opening.',
        requirements: 'Automation, API testing, HRMS domain.',
        location: 'Bangalore',
        employmentType: 'FULL_TIME',
        salaryRange: '800000-1200000',
        status: 'OPEN',
      },
      expected: [201],
    });
    cleanup.jobOpeningIds.push(job.id);
    const { data: applicant } = await request('POST', '/recruitment/applicants', {
      body: {
        jobOpeningId: job.id,
        fullName: `${RUN_ID} Candidate`,
        email: `candidate.${RUN_ID.toLowerCase()}@example.test`,
        phone: `98${String(Date.now()).slice(-8)}`,
        coverLetter: 'E2E smoke application.',
      },
      expected: [201],
    });
    cleanup.applicantIds.push(applicant.id);
    await request('PUT', `/recruitment/applicants/${applicant.id}/stage`, {
      token: admin.token,
      body: { stage: 'INTERVIEW', rating: 4, notes: `${RUN_ID} stage update` },
      expected: [200],
    });
    record('E2E-009', 'Recruitment', 'Job application pipeline', 'PASS', `Applicant ${applicant.id} moved to INTERVIEW.`, 'High');
  } catch (error) {
    record('E2E-009', 'Recruitment', 'Job application pipeline', 'FAIL', error.message, 'High');
  }

  try {
    const { data: project } = await request('POST', '/projects', {
      token: admin.token,
      body: {
        name: `${RUN_ID} Project Smoke`,
        description: 'E2E project smoke.',
        managerId: managerEmployee.id,
        resourceIds: [employee.id],
        status: 'ACTIVE',
        budget: 100000,
      },
      expected: [201],
    });
    cleanup.projectIds.push(project.id);
    const { data: task } = await request('POST', '/projects/tasks', {
      token: admin.token,
      body: {
        title: `${RUN_ID} Task Smoke`,
        projectId: project.id,
        assigneeId: employee.id,
        estimatedHours: 8,
        priority: 'HIGH',
      },
      expected: [201],
    });
    cleanup.taskIds.push(task.id);
    const { data: timesheet } = await request('POST', '/timesheet', {
      token: employeeLogin.token,
      body: {
        employeeId: employee.id,
        taskId: task.id,
        date: '2026-12-09',
        hoursWorked: 6,
        description: `${RUN_ID} timesheet smoke`,
      },
      expected: [200],
    });
    cleanup.timesheetIds.push(timesheet.id);
    const { data: tasks } = await request('GET', `/projects/tasks/all?projectId=${project.id}`, {
      token: employeeLogin.token,
      expected: [200],
    });
    const updatedTask = tasks.find((item) => item.id === task.id);
    if (!updatedTask || updatedTask.actualHours !== 6) {
      throw new Error(`Expected task actualHours=6, received ${updatedTask?.actualHours}.`);
    }
    record('E2E-010', 'Projects/Timesheets', 'Timesheet rolls up task hours', 'PASS', 'Employee task visibility and actual-hours rollup validated.', 'Critical');
  } catch (error) {
    record('E2E-010', 'Projects/Timesheets', 'Timesheet rolls up task hours', 'FAIL', error.message, 'Critical');
  }

  try {
    const { data: claim } = await request('POST', '/expenses/claims', {
      token: employeeLogin.token,
      body: {
        title: `${RUN_ID} Expense Smoke`,
        category: 'TRAVEL',
        amount: 1234,
        description: 'E2E smoke expense claim.',
      },
      expected: [201],
    });
    cleanup.expenseClaimIds.push(claim.id);
    await request('PUT', `/expenses/claims/${claim.id}/manager-approve`, {
      token: admin.token,
      body: { remarks: `${RUN_ID} manager approval` },
      expected: [200],
    });
    await request('PUT', `/expenses/claims/${claim.id}/finance-approve`, {
      token: admin.token,
      body: { remarks: `${RUN_ID} finance approval`, markAsPaid: true },
      expected: [200],
    });
    record('E2E-011', 'Expenses', 'Claim manager and finance approval', 'PASS', `Claim ${claim.id} approved and marked paid.`, 'High');
  } catch (error) {
    record('E2E-011', 'Expenses', 'Claim manager and finance approval', 'FAIL', error.message, 'High');
  }

  try {
    const { data } = await request('GET', '/payroll/preflight?month=12&year=2026', {
      token: admin.token,
      expected: [200],
    });
    record('E2E-012', 'Payroll', 'Payroll preflight loads', 'PASS', `Preflight returned ${Array.isArray(data?.issues) ? data.issues.length : 0} issue rows.`, 'High');
  } catch (error) {
    record('E2E-012', 'Payroll', 'Payroll preflight loads', 'FAIL', error.message, 'High');
  }

  try {
    const { response } = await request('POST', '/reports/export', {
      token: employeeLogin.token,
      body: { reportType: 'general' },
    });
    if (response.status !== 403) throw new Error(`Expected 403 for employee export, received ${response.status}.`);
    const adminExport = await request('POST', '/reports/export', {
      token: admin.token,
      body: { reportType: 'general' },
      expected: [200],
    });
    if (!adminExport.response.ok) throw new Error('Admin report export failed.');
    record('E2E-013', 'Reports', 'Report export permissions', 'PASS', 'Employee blocked; admin export allowed.', 'High');
  } catch (error) {
    record('E2E-013', 'Reports', 'Report export permissions', 'FAIL', error.message, 'High');
  }

  try {
    const { response } = await request('GET', '/employees', {
      token: `${superAdmin.token.slice(0, -6)}tamper`,
    });
    if (![401, 403].includes(response.status)) throw new Error(`Expected 401/403, received ${response.status}.`);
    record('E2E-014', 'Security', 'Tampered token rejected', 'PASS', `Invalid token rejected with ${response.status}.`, 'Critical');
  } catch (error) {
    record('E2E-014', 'Security', 'Tampered token rejected', 'FAIL', error.message, 'Critical');
  }

  try {
    const pages = ['/', '/login', '/features', '/pricing'];
    for (const page of pages) {
      const response = await fetch(`${FRONTEND_URL}${page}`);
      if (!response.ok) throw new Error(`${page} returned ${response.status}`);
    }
    record('E2E-015', 'Frontend', 'Public pages HTTP smoke', 'PASS', 'Public frontend routes responded successfully.', 'Medium');
  } catch (error) {
    record('E2E-015', 'Frontend', 'Public pages HTTP smoke', 'FAIL', error.message, 'Medium');
  }
};

run()
  .catch((error) => {
    record('E2E-999', 'Runner', 'Unhandled E2E runner error', 'FAIL', error.stack || error.message, 'Critical');
    process.exitCode = 1;
  })
  .finally(async () => {
    await safeCleanup();
    writeReport();
    await prisma.$disconnect();
    if (results.some((item) => item.status === 'FAIL')) {
      process.exitCode = 1;
    }
    console.log(`\nE2E report written to ${reportPath}`);
  });
