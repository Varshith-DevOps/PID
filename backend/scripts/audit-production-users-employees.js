const prisma = require('../src/config/database');

async function auditDatabase() {
  console.log('=== SUMMARY AUDIT ===\n');

  const allUsers = await prisma.user.findMany({
    include: { employee: true }
  });

  const allEmployees = await prisma.employee.findMany({
    include: { user: true, department: true, company: true }
  });

  const employeeUsers = allUsers.filter(u => u.role === 'EMPLOYEE' || u.role === 'MANAGER' || u.role === 'HR');

  const usersWithoutEmployee = [];
  const wrongCompanyLinks = [];

  for (const u of employeeUsers) {
    const emp = allEmployees.find(e => e.userId === u.id);
    if (!emp) {
      usersWithoutEmployee.push(u);
    } else if (u.companyId && emp.companyId && u.companyId !== emp.companyId) {
      wrongCompanyLinks.push({ user: u, employee: emp });
    }
  }

  const employeesWithoutUser = allEmployees.filter(e => !e.userId);
  const wrongDeptLinks = allEmployees.filter(e => !e.departmentId || !e.department);

  console.log(`TOTAL USERS: ${allUsers.length}`);
  console.log(`TOTAL EMPLOYEE USERS: ${employeeUsers.length}`);
  console.log(`TOTAL EMPLOYEE PROFILES: ${allEmployees.length}`);
  console.log(`USERS WITHOUT EMPLOYEE: ${usersWithoutEmployee.length}`);
  console.log(`EMPLOYEES WITHOUT USER: ${employeesWithoutUser.length}`);
  console.log(`WRONG COMPANY LINKS: ${wrongCompanyLinks.length}`);
  console.log(`WRONG DEPARTMENT LINKS: ${wrongDeptLinks.length}`);

  console.log('\n--- USERS WITHOUT EMPLOYEE RECORD ---');
  console.log(JSON.stringify(usersWithoutEmployee, null, 2));

  console.log('\n--- EMPLOYEES WITHOUT USER RECORD ---');
  console.log(JSON.stringify(employeesWithoutUser, null, 2));
}

auditDatabase()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
