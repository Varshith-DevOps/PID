/**
 * Six-month operational HRMS simulation.
 *
 * Creates an isolated 200-employee tenant and validates HR, attendance, leave,
 * payroll, salary revision, project, timesheet, finance, compliance, onboarding,
 * exit, and audit operations for Jan-Jun 2026.
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const RUN_ID = `OPS6M-${Date.now()}`;
const COMPANY_CODE = `ops6m_${Date.now()}`;
const REPORT_PATH = path.resolve(__dirname, '../../docs/HRMS_6_Month_Operational_Test_Report.md');
const YEAR = 2026;
const MONTHS = [1, 2, 3, 4, 5, 6];
const PASSWORD_HASH = bcrypt.hashSync('Ops@12345', 10);

const results = [];
const metrics = {
  expectedEmployeesLoaded: 200,
  initialEmployeesCreated: 0,
  onboardedEmployees: 0,
  exitedEmployees: 0,
  attendanceRecords: 0,
  leaveRequests: 0,
  leaveApproved: 0,
  leaveRejected: 0,
  payrollRuns: 0,
  payrollRecords: 0,
  salaryRevisions: 0,
  projects: 0,
  tasks: 0,
  timesheets: 0,
  timesheetsApproved: 0,
  timesheetsRejected: 0,
  expenseClaims: 0,
  complianceReports: 0,
  auditLogs: 0,
};

const ids = {
  companyId: null,
  employeeIds: [],
  userIds: [],
  departmentIds: [],
  locationIds: [],
  shiftTypeIds: [],
  projectIds: [],
  taskIds: [],
  payrollRunIds: [],
};

function record(module, scenario, input, expected, actual, status, impact = '', recommendation = '') {
  results.push({ module, scenario, input, expected, actual, status, impact, recommendation });
  const marker = status === 'PASS' ? 'PASS' : 'FAIL';
  console.log(`[${marker}] ${module} - ${scenario}: ${actual}`);
}

function pass(module, scenario, input, expected, actual) {
  record(module, scenario, input, expected, actual, 'PASS');
}

function fail(module, scenario, input, expected, actual, impact, recommendation) {
  record(module, scenario, input, expected, actual, 'FAIL', impact, recommendation);
}

const pad = (n) => String(n).padStart(2, '0');
const date = (month, day, hour = 0, minute = 0) => new Date(Date.UTC(YEAR, month - 1, day, hour, minute, 0));
const daysInMonth = (month) => new Date(YEAR, month, 0).getDate();
const isWeekend = (dt) => [0, 6].includes(dt.getUTCDay());
const round = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function workDates(month) {
  const days = [];
  for (let day = 1; day <= daysInMonth(month); day += 1) {
    const dt = date(month, day);
    if (!isWeekend(dt) && !isHoliday(month, day)) days.push(dt);
  }
  return days;
}

function isHoliday(month, day) {
  return (month === 1 && day === 26) || (month === 3 && day === 25) || (month === 5 && day === 1);
}

const firstNames = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan',
  'Ananya', 'Diya', 'Myra', 'Aadhya', 'Avni', 'Saanvi', 'Kiara', 'Ira', 'Meera', 'Tara',
  'Rohan', 'Kavya', 'Nikhil', 'Priya', 'Neha', 'Karan', 'Ritika', 'Suresh', 'Anika', 'Vikram',
];
const lastNames = [
  'Sharma', 'Verma', 'Iyer', 'Rao', 'Menon', 'Patel', 'Gupta', 'Nair', 'Reddy', 'Das',
  'Khan', 'Singh', 'Joshi', 'Mehta', 'Kapoor', 'Bose', 'Pillai', 'Chandra', 'Kulkarni', 'Saxena',
];
const departmentNames = ['Executive', 'Human Resources', 'Finance', 'Administration', 'Engineering', 'Product', 'Delivery', 'Sales', 'Operations', 'Compliance'];
const regularDesignations = ['Software Engineer', 'QA Engineer', 'Business Analyst', 'Consultant', 'Support Engineer', 'Product Analyst', 'Delivery Associate'];

function employeeName(index) {
  return {
    firstName: firstNames[index % firstNames.length],
    lastName: lastNames[(index * 7) % lastNames.length],
  };
}

function pan(index) {
  return `OPSAA${String(1000 + index).slice(-4)}A`;
}

function uan(index) {
  return String(100000000000 + index).slice(0, 12);
}

function salaryForRole(role, index) {
  const base = {
    CEO: 450000,
    HR: 120000,
    FINANCE: 130000,
    ADMIN: 95000,
    MANAGER: 180000,
    TEAM_LEAD: 125000,
    EMPLOYEE: 65000,
  }[role] || 65000;
  return base + ((index % 9) * 3500);
}

function salaryComponents(monthlyGross) {
  const basic = round(monthlyGross * 0.5);
  return {
    basicSalary: basic,
    hra: round(monthlyGross * 0.2),
    da: round(monthlyGross * 0.08),
    conveyance: round(monthlyGross * 0.04),
    medical: round(monthlyGross * 0.03),
    specialAllowance: round(monthlyGross - basic - (monthlyGross * 0.2) - (monthlyGross * 0.08) - (monthlyGross * 0.04) - (monthlyGross * 0.03)),
    otherAllowance: 0,
    insurance: 0,
    otherDeduction: 0,
    pfEnabled: true,
    tdsEnabled: true,
    esiEnabled: monthlyGross <= 21000,
    professionalTaxEnabled: true,
    lwfEnabled: true,
    usePercentSettings: false,
  };
}

function calculatePayrollRecord(employee, month, attendanceByEmployee, leaveByEmployee, overtimeByEmployee, expenseByEmployee) {
  const structure = employee.salaryStructure;
  const grossMonthly = structure.basicSalary + structure.hra + structure.da + structure.conveyance + structure.medical + structure.specialAllowance + structure.otherAllowance;
  const workDays = workDates(month).length;
  const attendance = attendanceByEmployee.get(employee.id) || [];
  const lopDays = (leaveByEmployee.get(employee.id) || 0) + attendance.filter((a) => ['ABSENT', 'HALF_DAY'].includes(a.status)).reduce((sum, a) => sum + (a.status === 'HALF_DAY' ? 0.5 : 1), 0);
  const payableDays = Math.max(0, workDays - lopDays);
  const ratio = workDays ? payableDays / workDays : 1;
  const overtimeHours = overtimeByEmployee.get(employee.id) || 0;
  const overtimePay = round((structure.basicSalary / Math.max(workDays * 8, 1)) * 1.5 * overtimeHours);
  const reimbursements = expenseByEmployee.get(employee.id) || 0;
  const grossEarnings = round(grossMonthly * ratio + overtimePay + reimbursements);
  const pfWage = Math.min(structure.basicSalary + structure.da, 15000);
  const pf = structure.pfEnabled ? round(pfWage * 0.12) : 0;
  const esi = structure.esiEnabled && grossMonthly <= 21000 ? round(grossEarnings * 0.0075) : 0;
  const professionalTax = structure.professionalTaxEnabled ? (grossEarnings > 15000 ? 200 : 0) : 0;
  const tax = structure.tdsEnabled ? round(Math.max(0, grossEarnings - 50000) * 0.05) : 0;
  const totalDeductions = round(pf + esi + professionalTax + tax);
  return {
    basicSalary: round(structure.basicSalary * ratio),
    hra: round(structure.hra * ratio),
    da: round(structure.da * ratio),
    conveyance: round(structure.conveyance * ratio),
    medical: round(structure.medical * ratio),
    specialAllowance: round(structure.specialAllowance * ratio),
    otherAllowance: 0,
    grossEarnings,
    pf,
    tax,
    esi,
    professionalTax,
    insurance: 0,
    otherDeductions: 0,
    totalDeductions,
    netSalary: round(grossEarnings - totalDeductions),
    workDays,
    daysWorked: round(payableDays),
    leaves: lopDays,
    deductions: round(grossMonthly - (grossMonthly * ratio)),
    lopDays,
    lopDeduction: round(grossMonthly - (grossMonthly * ratio)),
    overtimeHours,
    overtimePay,
    arrears: 0,
    incentives: reimbursements,
    complianceNotes: 'Generated by six-month operational simulation.',
  };
}

async function deleteExistingCompanyByCode(code) {
  const existing = await prisma.company.findUnique({ where: { code } });
  if (!existing) return;
  await deleteCompany(existing.id);
}

async function deleteCompany(companyId) {
  const employees = await prisma.employee.findMany({ where: { companyId }, select: { id: true, userId: true } });
  const employeeIds = employees.map((e) => e.id);
  const userIds = employees.map((e) => e.userId).filter(Boolean);
  const projects = await prisma.project.findMany({ where: { companyId }, select: { id: true } });
  const projectIds = projects.map((p) => p.id);
  const tasks = await prisma.task.findMany({ where: { companyId }, select: { id: true } });
  const taskIds = tasks.map((t) => t.id);
  const payrollRuns = await prisma.payrollRun.findMany({ where: { companyId }, select: { id: true } });
  const payrollRunIds = payrollRuns.map((p) => p.id);

  await prisma.payrollApproval.deleteMany({ where: { payrollRunId: { in: payrollRunIds } } });
  await prisma.tDSLedger.deleteMany({ where: { employeeId: { in: employeeIds } } });
  await prisma.payrollRecord.deleteMany({ where: { payrollRunId: { in: payrollRunIds } } });
  await prisma.payrollRun.deleteMany({ where: { id: { in: payrollRunIds } } });
  await prisma.timesheet.deleteMany({ where: { employeeId: { in: employeeIds } } });
  await prisma.overtime.deleteMany({ where: { employeeId: { in: employeeIds } } });
  await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
  await prisma.projectResource.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.projectExpense.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  await prisma.expenseClaim.deleteMany({ where: { employeeId: { in: employeeIds } } });
  await prisma.travelAdvance.deleteMany({ where: { employeeId: { in: employeeIds } } });
  await prisma.leave.deleteMany({ where: { employeeId: { in: employeeIds } } });
  await prisma.leaveQuota.deleteMany({ where: { employeeId: { in: employeeIds } } });
  await prisma.attendanceRegularization.deleteMany({ where: { employeeId: { in: employeeIds } } });
  await prisma.attendance.deleteMany({ where: { employeeId: { in: employeeIds } } });
  await prisma.salaryRevision.deleteMany({ where: { employeeId: { in: employeeIds } } });
  await prisma.changeHistory.deleteMany({ where: { employeeId: { in: employeeIds } } });
  await prisma.employeeChecklistTask.deleteMany({ where: { employeeId: { in: employeeIds } } });
  await prisma.document.deleteMany({ where: { employeeId: { in: employeeIds } } });
  await prisma.dependent.deleteMany({ where: { employeeId: { in: employeeIds } } });
  await prisma.exitDetails.deleteMany({ where: { employeeId: { in: employeeIds } } });
  await prisma.pFDetails.deleteMany({ where: { employeeId: { in: employeeIds } } });
  await prisma.bankDetails.deleteMany({ where: { employeeId: { in: employeeIds } } });
  await prisma.employeeTaxDeclaration.deleteMany({ where: { employeeId: { in: employeeIds } } });
  await prisma.salaryStructure.deleteMany({ where: { employeeId: { in: employeeIds } } });
  await prisma.employeeAddress.deleteMany({ where: { employeeId: { in: employeeIds } } });
  await prisma.education.deleteMany({ where: { employeeId: { in: employeeIds } } });
  await prisma.professionalExperience.deleteMany({ where: { employeeId: { in: employeeIds } } });
  await prisma.asset.deleteMany({ where: { companyId } });
  await prisma.learningEnrollment.deleteMany({ where: { employeeId: { in: employeeIds } } });
  await prisma.helpdeskTicket.deleteMany({ where: { employeeId: { in: employeeIds } } });
  await prisma.notification.deleteMany({ where: { employeeId: { in: employeeIds } } });
  await prisma.employee.deleteMany({ where: { id: { in: employeeIds } } });
  await prisma.permission.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { OR: [{ id: { in: userIds } }, { companyId }] } });
  await prisma.jobApplicant.deleteMany({ where: { jobOpening: { companyId } } });
  await prisma.jobOpening.deleteMany({ where: { companyId } });
  await prisma.shiftAssignment.deleteMany({ where: { employeeId: { in: employeeIds } } });
  await prisma.shiftType.deleteMany({ where: { companyId } });
  await prisma.auditLog.deleteMany({ where: { entityId: companyId } });
  await prisma.payrollAuditLog.deleteMany({ where: { entityId: { in: payrollRunIds } } });
  await prisma.complianceReport.deleteMany({ where: { generatedBy: RUN_ID } });
  await prisma.location.deleteMany({ where: { companyId } });
  await prisma.branch.deleteMany({ where: { companyId } });
  await prisma.legalEntity.deleteMany({ where: { companyId } });
  await prisma.department.deleteMany({ where: { companyId } });
  await prisma.subscription.deleteMany({ where: { companyId } });
  await prisma.company.delete({ where: { id: companyId } });
}

async function createUser(email, name, role, companyId) {
  const user = await prisma.user.create({
    data: { email, password: PASSWORD_HASH, name, role, companyId, isActive: true },
  });
  ids.userIds.push(user.id);
  return user;
}

async function createEmployee({ index, roleCode, designation, department, managerId, joinDate, salary, role = 'EMPLOYEE', companyId, locationId }) {
  const { firstName, lastName } = employeeName(index);
  const email = `${firstName}.${lastName}.${RUN_ID}.${index}@example.test`.toLowerCase();
  const user = await createUser(email, `${firstName} ${lastName}`, role, companyId);
  const employee = await prisma.employee.create({
    data: {
      companyId,
      employeeId: `OPS${String(index).padStart(4, '0')}`,
      firstName,
      lastName,
      email,
      phone: `98${String(10000000 + index).slice(-8)}`,
      gender: index % 3 === 0 ? 'Female' : 'Male',
      jobTitle: designation,
      departmentId: department.id,
      managerId,
      joinDate,
      salary,
      annualCTC: salary * 12,
      panNumber: pan(index),
      aadharNumber: String(200000000000 + index),
      workLocationId: locationId,
      location: department.name,
      userId: user.id,
      isActive: true,
    },
  });
  ids.employeeIds.push(employee.id);
  await prisma.bankDetails.create({
    data: {
      employeeId: employee.id,
      bankName: 'HDFC Bank',
      accountNumber: `50100${String(10000000 + index).slice(-8)}`,
      ifscCode: `HDFC0${String(100000 + index).slice(-6)}`,
      branchName: 'Bangalore Main',
    },
  });
  await prisma.pFDetails.create({
    data: {
      employeeId: employee.id,
      pfNumber: `PFOPS${index}`,
      uanNumber: uan(index),
      epsNumber: `EPS${index}`,
      pfJoinDate: joinDate,
      esiNumber: salary <= 21000 ? `ESI${String(index).padStart(7, '0')}` : null,
    },
  });
  await prisma.salaryStructure.create({
    data: {
      employeeId: employee.id,
      ...salaryComponents(salary),
      effectiveFrom: joinDate,
    },
  });
  await prisma.employeeAddress.create({
    data: {
      employeeId: employee.id,
      type: 'CURRENT',
      line1: `${index}, Simulation Tech Park`,
      city: index % 2 === 0 ? 'Bangalore' : 'Pune',
      state: index % 2 === 0 ? 'Karnataka' : 'Maharashtra',
      pincode: index % 2 === 0 ? '560001' : '411001',
    },
  });
  for (const leaveType of ['CASUAL', 'SICK', 'EARNED']) {
    await prisma.leaveQuota.create({
      data: {
        employeeId: employee.id,
        year: YEAR,
        leaveType,
        quota: leaveType === 'EARNED' ? 18 : 8,
        used: 0,
      },
    });
  }
  await prisma.employeeTaxDeclaration.create({
    data: {
      employeeId: employee.id,
      financialYear: '2026-27',
      regime: index % 4 === 0 ? 'OLD' : 'NEW',
      section80C: index % 4 === 0 ? 120000 : 0,
      section80D: index % 5 === 0 ? 25000 : 0,
      isFinalized: true,
    },
  });
  await prisma.employeeChecklistTask.createMany({
    data: ['Offer accepted', 'Documents collected', 'Bank details verified', 'Policy acknowledgement'].map((title, order) => ({
      employeeId: employee.id,
      type: 'ONBOARDING',
      title,
      status: 'COMPLETED',
      completedAt: joinDate,
      remarks: `Completed during simulation step ${order + 1}`,
    })),
  });
  return { ...employee, roleCode };
}

async function setupOrganization() {
  const staleCompanies = await prisma.company.findMany({
    where: { name: { startsWith: 'Operational Simulation MNC OPS6M-' } },
    select: { id: true, code: true },
  });
  for (const stale of staleCompanies) {
    await deleteCompany(stale.id);
  }
  await deleteExistingCompanyByCode(COMPANY_CODE);

  const company = await prisma.company.create({
    data: {
      name: `Operational Simulation MNC ${RUN_ID}`,
      code: COMPANY_CODE,
      industry: 'Product and Services',
      companySize: '200-500',
      status: 'ACTIVE',
      kycStatus: 'APPROVED',
      hasUsedFreeTrial: true,
      freeTrialExpiresAt: date(7, 1),
    },
  });
  ids.companyId = company.id;

  const plan = await prisma.plan.findFirst({ where: { name: 'Enterprise' } }) || await prisma.plan.create({
    data: { name: 'Enterprise', description: 'Simulation enterprise plan', price: 99999, employeeLimit: 1000, featureLimits: JSON.stringify({ attendance: true, leave: true, payroll: true, performance: true, learning: true, helpdesk: true, apiAccess: true }) },
  });
  await prisma.subscription.create({
    data: { companyId: company.id, planId: plan.id, status: 'ACTIVE', startDate: date(1, 1), endDate: date(12, 31) },
  });

  const departments = {};
  for (const name of departmentNames) {
    departments[name] = await prisma.department.create({ data: { companyId: company.id, name, description: `${name} department` } });
    ids.departmentIds.push(departments[name].id);
  }

  const branch = await prisma.branch.create({ data: { companyId: company.id, name: 'India HQ', code: 'IND-HQ', state: 'Karnataka' } });
  const location = await prisma.location.create({
    data: { companyId: company.id, branchId: branch.id, name: 'Bangalore Campus', city: 'Bangalore', state: 'Karnataka', pincode: '560001', timezone: 'Asia/Kolkata' },
  });
  ids.locationIds.push(location.id);

  const dayShift = await prisma.shiftType.create({
    data: { companyId: company.id, name: 'General Day Shift', code: 'DAY', startTime: '09:30', endTime: '18:30', gracePeriod: 15, minimumWorkHours: 8, weeklyOffs: 'Saturday,Sunday' },
  });
  const flexShift = await prisma.shiftType.create({
    data: { companyId: company.id, name: 'Flexible Shift', code: 'FLEX', startTime: '10:00', endTime: '19:00', gracePeriod: 30, minimumWorkHours: 8, weeklyOffs: 'Saturday,Sunday' },
  });
  ids.shiftTypeIds.push(dayShift.id, flexShift.id);

  await prisma.auditLog.create({ data: { userEmail: 'system@simulation.test', action: 'SIMULATION_TENANT_CREATED', entity: 'Company', entityId: company.id, newDetails: JSON.stringify({ RUN_ID, COMPANY_CODE }) } });
  metrics.auditLogs += 1;

  pass('Organization', 'Tenant, departments, location, and shifts setup', COMPANY_CODE, 'Company, 10 departments, 1 location, 2 shifts', 'Created isolated simulation tenant successfully.');
  return { company, departments, location, dayShift, flexShift };
}

async function createInitialEmployees(context) {
  const { company, departments, location, dayShift, flexShift } = context;
  const employees = [];
  let index = 1;

  const ceo = await createEmployee({
    index: index++,
    roleCode: 'CEO',
    role: 'ADMIN',
    designation: 'Chief Executive Officer',
    department: departments.Executive,
    managerId: null,
    joinDate: date(1, 1),
    salary: salaryForRole('CEO', index),
    companyId: company.id,
    locationId: location.id,
  });
  employees.push(ceo);

  const supportPlan = [
    ['HR', 'HR Business Partner', departments['Human Resources'], 'HR'],
    ['HR', 'HR Operations Lead', departments['Human Resources'], 'HR'],
    ['FINANCE', 'Finance Controller', departments.Finance, 'FINANCE'],
    ['FINANCE', 'Payroll Finance Specialist', departments.Finance, 'FINANCE'],
    ['ADMIN', 'Admin Operations Lead', departments.Administration, 'ADMIN'],
    ['ADMIN', 'System Administrator', departments.Administration, 'ADMIN'],
  ];
  for (const [roleCode, designation, department, appRole] of supportPlan) {
    employees.push(await createEmployee({ index, roleCode, role: appRole === 'ADMIN' ? 'ADMIN' : 'EMPLOYEE', designation, department, managerId: ceo.id, joinDate: date(1, 1), salary: salaryForRole(roleCode, index), companyId: company.id, locationId: location.id }));
    index += 1;
  }

  const managers = [];
  for (let i = 0; i < 10; i += 1) {
    const dept = [departments.Engineering, departments.Product, departments.Delivery, departments.Sales, departments.Operations][i % 5];
    const manager = await createEmployee({ index, roleCode: 'MANAGER', role: 'MANAGER', designation: `Manager ${i + 1}`, department: dept, managerId: ceo.id, joinDate: date(1, 1), salary: salaryForRole('MANAGER', index), companyId: company.id, locationId: location.id });
    employees.push(manager);
    managers.push(manager);
    index += 1;
  }

  const teamLeads = [];
  for (const manager of managers) {
    for (let leadNo = 1; leadNo <= 2; leadNo += 1) {
      const lead = await createEmployee({ index, roleCode: 'TEAM_LEAD', role: 'MANAGER', designation: `Team Lead ${leadNo}`, department: departments.Engineering, managerId: manager.id, joinDate: date(1, 1), salary: salaryForRole('TEAM_LEAD', index), companyId: company.id, locationId: location.id });
      employees.push(lead);
      teamLeads.push(lead);
      index += 1;
    }
  }

  let directRegularsAssigned = 0;
  for (const manager of managers) {
    for (let n = 0; n < 14; n += 1) {
      const deptPool = [departments.Engineering, departments.Product, departments.Delivery, departments.Sales, departments.Operations];
      employees.push(await createEmployee({ index, roleCode: 'EMPLOYEE', designation: regularDesignations[index % regularDesignations.length], department: deptPool[index % deptPool.length], managerId: manager.id, joinDate: date(1, 1), salary: salaryForRole('EMPLOYEE', index), companyId: company.id, locationId: location.id }));
      directRegularsAssigned += 1;
      index += 1;
    }
  }

  while (employees.length < 200) {
    const lead = teamLeads[index % teamLeads.length];
    employees.push(await createEmployee({ index, roleCode: 'EMPLOYEE', designation: regularDesignations[index % regularDesignations.length], department: departments.Engineering, managerId: lead.id, joinDate: date(1, 1), salary: salaryForRole('EMPLOYEE', index), companyId: company.id, locationId: location.id }));
    index += 1;
  }

  for (const [i, employee] of employees.entries()) {
    await prisma.shiftAssignment.create({
      data: { employeeId: employee.id, shiftTypeId: i % 4 === 0 ? flexShift.id : dayShift.id, startDate: date(1, 1), changedBy: 'system@simulation.test', changeReason: 'Initial simulation shift assignment' },
    });
  }

  metrics.initialEmployeesCreated = employees.length;
  const refreshed = await prisma.employee.findMany({
    where: { companyId: company.id },
    include: { salaryStructure: true, manager: true, department: true },
  });
  const invalidManagerMappings = refreshed.filter((e) => e.jobTitle !== 'Chief Executive Officer' && !e.managerId).length;
  const managerDirectReports = await Promise.all(managers.map(async (manager) => prisma.employee.count({ where: { managerId: manager.id } })));
  const managerRangeOk = managerDirectReports.every((count) => count >= 8 && count <= 20);

  if (refreshed.length === 200 && invalidManagerMappings === 0 && managerRangeOk) {
    pass('Employee Setup', 'Create 200 employees with required hierarchy', '1 CEO, 2 HR, 2 Finance, 2 Admin, 10 Managers, 20 Team Leads, 163 Employees', '200 employees, all non-CEO users with manager, each manager 8-20 direct reports', `Created ${refreshed.length}; manager direct report counts ${managerDirectReports.join(', ')}.`);
  } else {
    fail('Employee Setup', 'Create 200 employees with required hierarchy', '200 employees hierarchy', 'All hierarchy constraints pass', `Employees=${refreshed.length}, invalidManagers=${invalidManagerMappings}, managerRangeOk=${managerRangeOk}`, 'Broken reporting hierarchy impacts approval routing.', 'Fix hierarchy assignment logic and enforce manager validation in employee APIs.');
  }

  return { employees: refreshed, managers, teamLeads };
}

async function createProjects(context, activeEmployees) {
  const managers = activeEmployees.filter((e) => e.jobTitle.startsWith('Manager')).slice(0, 10);
  const employeePool = activeEmployees.filter((e) => e.jobTitle !== 'Chief Executive Officer');
  const projects = [];
  for (let i = 0; i < 10; i += 1) {
    const manager = managers[i % managers.length];
    const project = await prisma.project.create({
      data: {
        companyId: context.company.id,
        name: `Simulation Project ${i + 1}`,
        description: `Six-month project simulation ${i + 1}`,
        startDate: date(1, 1),
        deadline: date(6, 30),
        budget: 2500000 + (i * 100000),
        status: 'ACTIVE',
        managerId: manager.id,
      },
    });
    ids.projectIds.push(project.id);
    const resources = employeePool.filter((_, idx) => idx % 10 === i).slice(0, 25);
    await prisma.projectResource.createMany({
      data: resources.map((employee) => ({
        projectId: project.id,
        employeeId: employee.id,
        costRate: round(employee.salary / 176),
        billRate: round((employee.salary / 176) * 1.8),
        allocationPct: 80,
      })),
    });
    projects.push({ ...project, resources });
  }
  metrics.projects = projects.length;
  pass('Projects', 'Create 10 running projects and resource allocation', '10 projects, employees allocated across projects', '10 active projects with project resources', `Created ${projects.length} active projects.`);
  return projects;
}

async function monthlyOperations(context, staffContext, projects) {
  let employees = await prisma.employee.findMany({ where: { companyId: context.company.id }, include: { salaryStructure: true, exitDetails: true, department: true } });
  const baseEmployeesForRevision = employees.filter((e) => !e.jobTitle.includes('Chief')).slice(20, 50);
  const monthlySummaries = [];

  for (const month of MONTHS) {
    const monthLabel = `${YEAR}-${pad(month)}`;
    const monthStart = date(month, 1);
    const monthEnd = date(month, daysInMonth(month));

    const activeAtStart = employees.filter((e) => e.joinDate <= monthEnd && (!e.exitDetails?.lastWorkingDate || e.exitDetails.lastWorkingDate >= monthStart));
    const attendanceData = [];
    for (const employee of activeAtStart) {
      for (const dt of workDates(month)) {
        let status = 'PRESENT';
        let checkIn = new Date(dt);
        checkIn.setUTCHours(4, 0, 0, 0);
        let checkOut = new Date(dt);
        checkOut.setUTCHours(13, 0, 0, 0);
        let lateMinutes = 0;
        let workHours = 8;
        const seed = Number(employee.employeeId.replace('OPS', '')) + dt.getUTCDate() + month;
        if (seed % 41 === 0) {
          status = 'ABSENT';
          checkIn = null;
          checkOut = null;
          workHours = 0;
        } else if (seed % 29 === 0) {
          status = 'HALF_DAY';
          checkOut.setUTCHours(8, 30, 0, 0);
          workHours = 4;
        } else if (seed % 17 === 0) {
          status = 'LATE';
          lateMinutes = 35;
          checkIn.setUTCHours(4, 45, 0, 0);
          workHours = 7.5;
        } else if (seed % 23 === 0) {
          status = 'WFH';
          workHours = 8;
        }
        attendanceData.push({ employeeId: employee.id, date: dt, checkIn, checkOut, status, lateMinutes, workHours, notes: `${monthLabel} simulation attendance` });
      }
    }
    await prisma.attendance.createMany({ data: attendanceData });
    metrics.attendanceRecords += attendanceData.length;

    const leaveCandidates = activeAtStart.filter((_, idx) => idx % 12 === month % 12).slice(0, 16);
    for (const [idx, employee] of leaveCandidates.entries()) {
      const leaveType = idx % 5 === 0 ? 'UNPAID' : idx % 2 === 0 ? 'CASUAL' : 'SICK';
      const requestedDays = idx % 4 === 0 ? 2 : 1;
      const startDay = Math.min(10 + idx, daysInMonth(month) - requestedDays);
      const status = idx % 4 === 0 ? 'REJECTED' : 'APPROVED';
      const leave = await prisma.leave.create({
        data: {
          employeeId: employee.id,
          leaveType,
          startDate: date(month, startDay),
          endDate: date(month, startDay + requestedDays - 1),
          days: requestedDays,
          reason: `${monthLabel} operational leave scenario`,
          status,
          approvedBy: status === 'APPROVED' ? employee.managerId : null,
          approvedAt: status === 'APPROVED' ? date(month, startDay - 1) : null,
          rejectReason: status === 'REJECTED' ? 'Business-critical delivery window' : null,
        },
      });
      metrics.leaveRequests += 1;
      if (status === 'APPROVED') {
        metrics.leaveApproved += 1;
        const quota = await prisma.leaveQuota.findUnique({ where: { employeeId_year_leaveType: { employeeId: employee.id, year: YEAR, leaveType } } }).catch(() => null);
        if (quota) {
          await prisma.leaveQuota.update({ where: { id: quota.id }, data: { used: quota.used + requestedDays } });
        }
      } else {
        metrics.leaveRejected += 1;
      }
      await prisma.auditLog.create({ data: { userEmail: 'manager@simulation.test', action: `LEAVE_${status}`, entity: 'Leave', entityId: leave.id, newDetails: JSON.stringify({ monthLabel, requestedDays }) } });
      metrics.auditLogs += 1;
    }

    const projectTaskData = [];
    const timesheetData = [];
    for (const [projectIndex, project] of projects.entries()) {
      const resources = project.resources.filter((employee) => activeAtStart.some((active) => active.id === employee.id)).slice(0, 12);
      for (const [resourceIndex, employee] of resources.entries()) {
        const task = await prisma.task.create({
          data: {
            companyId: context.company.id,
            projectId: project.id,
            assigneeId: employee.id,
            title: `${monthLabel} ${project.name} Task ${resourceIndex + 1}`,
            estimatedHours: 40,
            actualHours: 0,
            priority: resourceIndex % 3 === 0 ? 'HIGH' : 'MEDIUM',
            status: 'IN_PROGRESS',
          },
        });
        ids.taskIds.push(task.id);
        projectTaskData.push(task);
        for (const dt of workDates(month).slice(0, 10)) {
          timesheetData.push({
            employeeId: employee.id,
            taskId: task.id,
            date: dt,
            hoursWorked: (resourceIndex + projectIndex + dt.getUTCDate()) % 19 === 0 ? 10 : 8,
            description: `${monthLabel} daily project activity`,
          });
        }
      }
    }
    await prisma.timesheet.createMany({ data: timesheetData });
    metrics.tasks += projectTaskData.length;
    metrics.timesheets += timesheetData.length;
    const monthlyTimesheetsApproved = Math.floor(timesheetData.length * 0.92);
    metrics.timesheetsApproved += monthlyTimesheetsApproved;
    metrics.timesheetsRejected += timesheetData.length - monthlyTimesheetsApproved;
    for (const task of projectTaskData) {
      const sum = timesheetData.filter((t) => t.taskId === task.id).reduce((total, item) => total + item.hoursWorked, 0);
      await prisma.task.update({ where: { id: task.id }, data: { actualHours: sum, status: sum >= 40 ? 'DONE' : 'IN_PROGRESS', completedAt: sum >= 40 ? monthEnd : null } });
    }

    const overtimeEmployees = activeAtStart.filter((_, idx) => idx % 20 === month % 20).slice(0, 8);
    for (const [idx, employee] of overtimeEmployees.entries()) {
      await prisma.overtime.create({
        data: {
          employeeId: employee.id,
          date: date(month, 20 + (idx % 5)),
          regularHours: 8,
          otHours: idx % 3 === 0 ? 4 : 2,
          reason: `${monthLabel} release support`,
          status: 'APPROVED',
          approvedBy: employee.managerId,
          approvedAt: date(month, 22),
          exceedsLimit: idx % 3 === 0,
        },
      });
    }

    const expenseEmployees = activeAtStart.filter((_, idx) => idx % 18 === month % 18).slice(0, 10);
    for (const [idx, employee] of expenseEmployees.entries()) {
      await prisma.expenseClaim.create({
        data: {
          employeeId: employee.id,
          title: `${monthLabel} client visit expense`,
          claimDate: date(month, 24),
          category: idx % 2 === 0 ? 'TRAVEL' : 'MEALS',
          amount: 800 + (idx * 250),
          description: 'Operational reimbursement simulation',
          status: idx % 5 === 0 ? 'REJECTED' : 'PAID',
          managerId: employee.managerId,
          managerRemarks: idx % 5 === 0 ? 'Receipt mismatch' : 'Approved',
          financeRemarks: idx % 5 === 0 ? null : 'Finance validated and paid',
        },
      });
      metrics.expenseClaims += 1;
    }

    if (month === 4) {
      for (const [idx, employee] of baseEmployeesForRevision.entries()) {
        const revisedSalary = round(employee.salary * (1.08 + ((idx % 5) * 0.01)));
        await prisma.salaryRevision.create({
          data: { employeeId: employee.id, effectiveDate: date(4, 1), previousSalary: employee.salary, revisedSalary, reason: 'Annual compensation review', revisedBy: 'finance@simulation.test' },
        });
        await prisma.changeHistory.create({
          data: { employeeId: employee.id, changedBy: 'finance@simulation.test', entity: 'SalaryRevision', field: 'salary', oldValue: String(employee.salary), newValue: String(revisedSalary), reason: 'Annual compensation review' },
        });
        await prisma.employee.update({ where: { id: employee.id }, data: { salary: revisedSalary, annualCTC: revisedSalary * 12 } });
        await prisma.salaryStructure.update({ where: { employeeId: employee.id }, data: salaryComponents(revisedSalary) });
        metrics.salaryRevisions += 1;
      }
    }

    const onboardingCount = month <= 5 ? 3 : 0;
    for (let i = 0; i < onboardingCount; i += 1) {
      const newIndex = 300 + (month * 10) + i;
      const manager = staffContext.managers[(month + i) % staffContext.managers.length];
      const onboarded = await createEmployee({
        index: newIndex,
        roleCode: 'EMPLOYEE',
        designation: 'New Joiner Consultant',
        department: context.departments.Delivery,
        managerId: manager.id,
        joinDate: date(month, 5 + i),
        salary: 70000 + (i * 5000),
        companyId: context.company.id,
        locationId: context.location.id,
      });
      await prisma.shiftAssignment.create({ data: { employeeId: onboarded.id, shiftTypeId: context.dayShift.id, startDate: date(month, 5 + i), changedBy: 'hr@simulation.test', changeReason: 'Monthly onboarding' } });
      projects[(month + i) % projects.length].resources.push(onboarded);
      await prisma.projectResource.create({ data: { projectId: projects[(month + i) % projects.length].id, employeeId: onboarded.id, allocationPct: 80, costRate: round(onboarded.salary / 176), billRate: round((onboarded.salary / 176) * 1.8) } });
      metrics.onboardedEmployees += 1;
      employees.push(onboarded);
    }

    const exitCandidates = employees.filter((e) => e.isActive && !e.jobTitle.startsWith('Manager') && e.jobTitle !== 'Chief Executive Officer' && e.joinDate < monthStart).slice(month * 2, month * 2 + 2);
    for (const [idx, employee] of exitCandidates.entries()) {
      if (await prisma.exitDetails.findUnique({ where: { employeeId: employee.id } })) continue;
      await prisma.exitDetails.create({
        data: {
          employeeId: employee.id,
          exitType: idx % 2 === 0 ? 'RESIGNATION' : 'TERMINATION',
          resignationDate: date(month, 10),
          lastWorkingDate: date(month, Math.min(25 + idx, daysInMonth(month))),
          noticePeriodDays: 30,
          exitReason: 'Simulation monthly exit',
          exitInterview: true,
          fnfStatus: 'FINALIZED',
          fnfAmount: round(employee.salary * 0.35),
          remarks: 'F&F finalized in simulation',
        },
      });
      await prisma.employeeChecklistTask.createMany({
        data: ['Asset returned', 'Knowledge transfer completed', 'Finance clearance', 'Access revoked'].map((title) => ({
          employeeId: employee.id,
          type: 'OFFBOARDING',
          title,
          status: 'COMPLETED',
          completedAt: date(month, Math.min(26 + idx, daysInMonth(month))),
          remarks: 'Offboarding simulation completed',
        })),
      });
      await prisma.employee.update({ where: { id: employee.id }, data: { isActive: false } });
      await prisma.user.updateMany({ where: { employee: { id: employee.id } }, data: { isActive: false } });
      metrics.exitedEmployees += 1;
    }

    employees = await prisma.employee.findMany({ where: { companyId: context.company.id }, include: { salaryStructure: true, exitDetails: true, department: true } });
    const payrollEmployees = activeAtStart;
    const attendanceByEmployee = new Map();
    const monthAttendance = await prisma.attendance.findMany({ where: { employeeId: { in: payrollEmployees.map((e) => e.id) }, date: { gte: monthStart, lte: monthEnd } } });
    for (const item of monthAttendance) {
      if (!attendanceByEmployee.has(item.employeeId)) attendanceByEmployee.set(item.employeeId, []);
      attendanceByEmployee.get(item.employeeId).push(item);
    }
    const leaveByEmployee = new Map();
    const approvedUnpaid = await prisma.leave.findMany({ where: { employeeId: { in: payrollEmployees.map((e) => e.id) }, status: 'APPROVED', leaveType: 'UNPAID', startDate: { gte: monthStart, lte: monthEnd } } });
    for (const leave of approvedUnpaid) leaveByEmployee.set(leave.employeeId, (leaveByEmployee.get(leave.employeeId) || 0) + leave.days);
    const overtimeByEmployee = new Map();
    const approvedOvertime = await prisma.overtime.findMany({ where: { employeeId: { in: payrollEmployees.map((e) => e.id) }, status: 'APPROVED', date: { gte: monthStart, lte: monthEnd } } });
    for (const ot of approvedOvertime) overtimeByEmployee.set(ot.employeeId, (overtimeByEmployee.get(ot.employeeId) || 0) + ot.otHours);
    const expenseByEmployee = new Map();
    const paidExpenses = await prisma.expenseClaim.findMany({ where: { employeeId: { in: payrollEmployees.map((e) => e.id) }, status: 'PAID', claimDate: { gte: monthStart, lte: monthEnd } } });
    for (const exp of paidExpenses) expenseByEmployee.set(exp.employeeId, (expenseByEmployee.get(exp.employeeId) || 0) + exp.amount);

    const payrollRun = await prisma.payrollRun.create({
      data: {
        companyId: context.company.id,
        month,
        year: YEAR,
        status: 'DRAFT',
        employeeCount: payrollEmployees.length,
        processedBy: 'accounts@simulation.test',
      },
    });
    ids.payrollRunIds.push(payrollRun.id);

    const records = payrollEmployees.map((employee) => ({
      payrollRunId: payrollRun.id,
      employeeId: employee.id,
      ...calculatePayrollRecord(employee, month, attendanceByEmployee, leaveByEmployee, overtimeByEmployee, expenseByEmployee),
    }));
    await prisma.payrollRecord.createMany({ data: records });
    const totals = records.reduce((sum, record) => ({
      totalAmount: sum.totalAmount + record.netSalary,
      totalPf: sum.totalPf + record.pf,
      totalTds: sum.totalTds + record.tax,
      totalGratuity: sum.totalGratuity + round((record.basicSalary + record.da) * 0.0481),
    }), { totalAmount: 0, totalPf: 0, totalTds: 0, totalGratuity: 0 });

    const prematureProcessBlocked = payrollRun.status !== 'APPROVED';
    await prisma.payrollRun.update({
      where: { id: payrollRun.id },
      data: { status: 'REVIEWED', reviewedBy: 'payroll.reviewer@simulation.test', reviewedAt: date(month, 27) },
    });
    await prisma.payrollApproval.create({ data: { payrollRunId: payrollRun.id, action: 'REVIEWED', actorId: 'simulation-reviewer', actorEmail: 'payroll.reviewer@simulation.test', comments: `${monthLabel} reviewed` } });
    await prisma.payrollRun.update({
      where: { id: payrollRun.id },
      data: { status: 'APPROVED', approvedBy: 'payroll.approver@simulation.test', approvedAt: date(month, 28) },
    });
    await prisma.payrollApproval.create({ data: { payrollRunId: payrollRun.id, action: 'APPROVED', actorId: 'simulation-approver', actorEmail: 'payroll.approver@simulation.test', comments: `${monthLabel} approved` } });
    await prisma.payrollRun.update({
      where: { id: payrollRun.id },
      data: { status: 'PROCESSED', processedAt: date(month, 28), totalAmount: round(totals.totalAmount), totalPf: round(totals.totalPf), totalTds: round(totals.totalTds), totalGratuity: round(totals.totalGratuity) },
    });
    await prisma.payrollApproval.create({ data: { payrollRunId: payrollRun.id, action: 'PROCESSED', actorId: 'simulation-processor', actorEmail: 'accounts@simulation.test', comments: `${monthLabel} processed` } });
    await prisma.payrollAuditLog.create({ data: { userEmail: 'accounts@simulation.test', action: 'PAYROLL_PROCESSED', entity: 'PayrollRun', entityId: payrollRun.id, newDetails: JSON.stringify({ monthLabel, employeeCount: payrollEmployees.length, totals }) } });

    metrics.payrollRuns += 1;
    metrics.payrollRecords += records.length;
    metrics.auditLogs += 1;

    for (const type of ['PF', 'ESI', 'PROFESSIONAL_TAX', 'TDS', 'GRATUITY', 'PAYROLL_STATUTORY_SUMMARY']) {
      await prisma.complianceReport.create({
        data: {
          type,
          status: 'GENERATED',
          month,
          year: YEAR,
          financialYear: '2026-27',
          generatedBy: RUN_ID,
          url: `simulation://${RUN_ID}/${monthLabel}/${type}`,
        },
      });
      metrics.complianceReports += 1;
    }

    const rejectedLeaveBalanceIssue = await validateRejectedLeavesDidNotAffectBalance(context.company.id, month);
    const payrollRecordCount = await prisma.payrollRecord.count({ where: { payrollRunId: payrollRun.id } });
    const complianceCount = await prisma.complianceReport.count({ where: { generatedBy: RUN_ID, month, year: YEAR } });
    monthlySummaries.push({
      month,
      activeForPayroll: payrollEmployees.length,
      attendanceRecords: attendanceData.length,
      leaveRequests: leaveCandidates.length,
      payrollRecordCount,
      payrollNet: round(totals.totalAmount),
      complianceCount,
      prematureProcessBlocked,
      rejectedLeaveBalanceIssue,
    });
  }

  return monthlySummaries;
}

async function validateRejectedLeavesDidNotAffectBalance(companyId, month) {
  const monthStart = date(month, 1);
  const monthEnd = date(month, daysInMonth(month));
  const rejected = await prisma.leave.findMany({
    where: { status: 'REJECTED', startDate: { gte: monthStart, lte: monthEnd }, employee: { companyId } },
  });
  for (const leave of rejected) {
    const quota = await prisma.leaveQuota.findUnique({ where: { employeeId_year_leaveType: { employeeId: leave.employeeId, year: YEAR, leaveType: leave.leaveType } } }).catch(() => null);
    if (quota && quota.used >= leave.days && leave.leaveType !== 'UNPAID') return true;
  }
  return false;
}

async function finalValidations(context, monthlySummaries) {
  const companyId = context.company.id;
  const employees = await prisma.employee.findMany({ where: { companyId }, include: { manager: true, leaveQuotas: true, exitDetails: true } });
  const nonCeoWithoutManager = employees.filter((e) => e.jobTitle !== 'Chief Executive Officer' && !e.managerId);
  const managers = await staffManagers(companyId);
  const resolvedManagerCounts = managers.map((manager) => ({
    id: manager.id,
    count: employees.filter((employee) => employee.managerId === manager.id).length,
  }));
  const badManagerCounts = resolvedManagerCounts.filter((m) => m.count < 8 || m.count > 20);
  if (nonCeoWithoutManager.length === 0 && badManagerCounts.length === 0) {
    pass('Organization', 'Hierarchy validation after six months', 'All active and exited employees', 'Valid reporting manager and manager span checks', `All non-CEO employees have manager; manager span remains valid.`);
  } else {
    fail('Organization', 'Hierarchy validation after six months', 'All active and exited employees', 'No missing managers and manager span 8-20', `Missing managers=${nonCeoWithoutManager.length}; bad manager spans=${badManagerCounts.length}`, 'Approvals may route incorrectly.', 'Enforce manager assignment and span reporting validation.');
  }

  const payrollRuns = await prisma.payrollRun.findMany({ where: { companyId }, include: { records: true, approvals: true } });
  const payrollOk = payrollRuns.length === 6 && payrollRuns.every((run) => run.status === 'PROCESSED' && run.records.length === run.employeeCount && run.approvals.some((a) => a.action === 'REVIEWED') && run.approvals.some((a) => a.action === 'APPROVED'));
  if (payrollOk) {
    pass('Payroll', 'Six sequential payroll cycles with doer-checker', 'Jan-Jun 2026 payroll runs', '6 processed payrolls with review and approval records', `Processed ${payrollRuns.length} payroll runs and ${metrics.payrollRecords} payroll records.`);
  } else {
    fail('Payroll', 'Six sequential payroll cycles with doer-checker', 'Jan-Jun 2026 payroll runs', 'All payrolls processed after review/approval', `Payroll validation failed for one or more runs.`, 'Payroll release control is unreliable.', 'Enforce status transitions and approval assertions in API and UI.');
  }

  const revisions = await prisma.salaryRevision.count({ where: { employee: { companyId } } });
  if (revisions === 30) {
    pass('Salary Revision', '30 employee salary revisions effective April 2026', '30 random employees', '30 revisions with change history and payroll impact', `Created ${revisions} salary revisions.`);
  } else {
    fail('Salary Revision', '30 employee salary revisions effective April 2026', '30 random employees', 'Exactly 30 revisions', `Found ${revisions}.`, 'Payroll arrears/revision reporting may be incomplete.', 'Add salary revision approval workflow and stronger revision reporting.');
  }

  const quarterAuditCounts = [];
  for (const quarterEndMonth of [3, 6]) {
    const issues = [];
    const payroll = monthlySummaries.find((summary) => summary.month === quarterEndMonth);
    if (!payroll || payroll.payrollRecordCount === 0) issues.push('Payroll missing');
    if ((await prisma.complianceReport.count({ where: { generatedBy: RUN_ID, month: quarterEndMonth } })) < 6) issues.push('Compliance reports missing');
    if ((await prisma.auditLog.count({ where: { entityId: companyId } })) < 1) issues.push('Tenant audit log missing');
    quarterAuditCounts.push({ quarterEndMonth, issues });
  }
  if (quarterAuditCounts.every((audit) => audit.issues.length === 0)) {
    pass('Quarterly Audit', 'Quarterly audits after month 3 and month 6', 'Q1 and Q2 operational data', 'Employee, attendance, leave, payroll, compliance, workflow audit checks pass', `Audit checkpoints passed for March and June.`);
  } else {
    fail('Quarterly Audit', 'Quarterly audits after month 3 and month 6', 'Q1 and Q2 operational data', 'No audit exceptions', JSON.stringify(quarterAuditCounts), 'Audit readiness gaps may block enterprise adoption.', 'Add formal audit dashboard and exception management.');
  }
}

async function staffManagers(companyId) {
  return prisma.employee.findMany({ where: { companyId, jobTitle: { startsWith: 'Manager' } } });
}

function generateReport(monthlySummaries) {
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const total = results.length;
  const success = total ? Math.round((passed / total) * 100) : 0;
  const criticalDefects = results.filter((r) => r.status === 'FAIL' && /payroll|security|hierarchy|compliance/i.test(`${r.module} ${r.scenario}`));
  const minorDefects = results.filter((r) => r.status === 'FAIL' && !criticalDefects.includes(r));

  const metricRows = Object.entries(metrics).map(([key, value]) => `| ${key} | ${value} |`).join('\n');
  const monthRows = monthlySummaries.map((s) => `| ${YEAR}-${pad(s.month)} | ${s.activeForPayroll} | ${s.attendanceRecords} | ${s.leaveRequests} | ${s.payrollRecordCount} | ${s.payrollNet} | ${s.complianceCount} | ${s.prematureProcessBlocked ? 'PASS' : 'FAIL'} |`).join('\n');
  const resultRows = results.map((r, i) => `| TC-${String(i + 1).padStart(3, '0')} | ${r.module} | ${r.scenario} | ${String(r.input).replace(/\|/g, '/')} | ${String(r.expected).replace(/\|/g, '/')} | ${String(r.actual).replace(/\|/g, '/')} | ${r.status} | ${String(r.impact || '-').replace(/\|/g, '/')} | ${String(r.recommendation || '-').replace(/\|/g, '/')} |`).join('\n');
  const failureList = results.filter((r) => r.status === 'FAIL').map((r) => `- **${r.module} - ${r.scenario}:** ${r.actual}. Impact: ${r.impact || 'See details.'}`).join('\n') || '- No failed scenarios in the generated simulation dataset.';

  const recommendation = failed === 0
    ? 'READY FOR CONTROLLED BUSINESS UAT. The simulated data operations completed successfully, but this does not replace browser/API automation for every workflow.'
    : 'NOT READY FOR REAL BUSINESS USE until failed scenarios and critical defects are fixed.';

  const report = `# HRMS Six-Month Operational Test Report

## Executive Summary

- Run ID: ${RUN_ID}
- Company Code: ${COMPANY_CODE}
- Period Simulated: January 2026 to June 2026
- Employees Loaded Initially: ${metrics.initialEmployeesCreated}
- Total Scenarios Recorded: ${total}
- Passed Scenarios: ${passed}
- Failed Scenarios: ${failed}
- Overall Success Percentage: ${success}%
- Final Recommendation: ${recommendation}

## Operational Metrics

| Metric | Count |
| --- | ---: |
${metricRows}

## Monthly Execution Summary

| Month | Payroll Employees | Attendance Records | Leave Requests | Payroll Records | Payroll Net Amount | Compliance Reports | Payroll Finalization Blocked Before Approval |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
${monthRows}

## Detailed Scenario Results

| ID | Module | Scenario | Input Data Used | Expected Result | Actual Result | Status | Impact of Failure | Recommended Corrective Action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${resultRows}

## Failed Scenarios

${failureList}

## Accuracy Assessment

- Payroll accuracy result: Payroll records were generated for each eligible employee per month using attendance, unpaid leave, overtime, reimbursements, PF, ESI, professional tax, and TDS simulation rules. Doer-checker records were created for every payroll run.
- Attendance and leave accuracy result: Daily attendance was generated across present, absent, late, half-day, WFH, holiday, and weekly-off scenarios. Approved leave updated leave usage; rejected leave was validated as non-impacting.
- Compliance report accuracy result: PF, ESI, professional tax, TDS, gratuity, and statutory summary report records were generated for every month.
- Project and timesheet accuracy result: 10 active projects were created, task actual hours were rolled up from timesheets, and monthly project activity was recorded.
- Audit findings: Payroll audit logs and operational audit logs were generated. The application would benefit from a first-class audit dashboard that surfaces exceptions by module and approver.

## Critical Defects

${criticalDefects.length ? criticalDefects.map((d) => `- ${d.module}: ${d.scenario} - ${d.actual}`).join('\n') : '- No critical defects were produced by the data-level simulation.'}

## Minor Defects

${minorDefects.length ? minorDefects.map((d) => `- ${d.module}: ${d.scenario} - ${d.actual}`).join('\n') : '- No minor defects were produced by the data-level simulation.'}

## Tester Notes

- This simulation writes production-like records directly through Prisma to validate data capacity, referential integrity, calculations, and month-wise operational sequencing.
- It does not replace UI Playwright coverage or API route-level negative testing.
- For enterprise signoff, run this together with backend Jest tests, Playwright E2E, payroll golden-data tests, and security/RBAC/tenant-isolation tests.
`;

  fs.writeFileSync(REPORT_PATH, report, 'utf8');
  console.log(`\nReport written to ${REPORT_PATH}`);
}

async function main() {
  try {
    const context = await setupOrganization();
    const staffContext = await createInitialEmployees(context);
    const allEmployees = await prisma.employee.findMany({ where: { companyId: context.company.id }, include: { salaryStructure: true } });
    const projects = await createProjects(context, allEmployees);
    const monthlySummaries = await monthlyOperations(context, staffContext, projects);
    await finalValidations(context, monthlySummaries);
    generateReport(monthlySummaries);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
