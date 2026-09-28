const prisma = require('../src/config/database');

async function inspectData() {
  console.log('=== INSPECTING PRODUCTION DATABASE RECORDS & LINKAGES ===\n');

  // 1. Inspect Users
  const targetEmails = [
    'aarav.sharma@hrms.com',
    'diya.patel@hrms.com',
    'ananya.reddy@hrms.com',
    'admin@hrms.com',
    'PIDsuperadmin@hcms.pid'
  ];

  console.log('--- USER ACCOUNTS ---');
  const users = await prisma.user.findMany({
    where: { email: { in: targetEmails } }
  });
  console.log(JSON.stringify(users.map(u => ({
    id: u.id,
    email: u.email,
    role: u.role,
    companyId: u.companyId,
    isActive: u.isActive
  })), null, 2));

  console.log('\n--- EMPLOYEE PROFILES ---');
  const employees = await prisma.employee.findMany({
    where: { email: { in: targetEmails } },
    include: { department: true, company: true, user: true }
  });
  console.log(JSON.stringify(employees.map(e => ({
    id: e.id,
    employeeId: e.employeeId,
    firstName: e.firstName,
    lastName: e.lastName,
    email: e.email,
    jobTitle: e.jobTitle,
    departmentName: e.department?.name,
    departmentId: e.departmentId,
    companyId: e.companyId,
    companyName: e.company?.name,
    userId: e.userId,
    linkedUserEmail: e.user?.email,
    isActive: e.isActive
  })), null, 2));

  console.log('\n--- DEPARTMENTS ---');
  const departments = await prisma.department.findMany();
  console.log(JSON.stringify(departments.map(d => ({
    id: d.id,
    name: d.name,
    companyId: d.companyId
  })), null, 2));

  console.log('\n--- ATTENDANCE RECORDS TODAY ---');
  const today = new Date();
  today.setHours(0,0,0,0);
  const attendances = await prisma.attendance.findMany({
    where: { date: { gte: today } },
    include: { employee: true }
  });
  console.log(JSON.stringify(attendances, null, 2));
}

inspectData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
