const prisma = require('../src/config/database');

async function auditAllRolesLinkage() {
  console.log('=== AUDITING USERS & EMPLOYEE LINKAGE ACROSS ALL ROLES ===\n');

  const users = await prisma.user.findMany({
    include: { employee: { include: { department: true, company: true } } }
  });

  const roleSummary = {};

  for (const u of users) {
    if (!roleSummary[u.role]) {
      roleSummary[u.role] = { total: 0, withEmployee: 0, withoutEmployee: [] };
    }
    roleSummary[u.role].total++;
    if (u.employee) {
      roleSummary[u.role].withEmployee++;
    } else {
      roleSummary[u.role].withoutEmployee.push(u.email);
    }
  }

  console.log('ROLE LINKAGE SUMMARY:');
  console.table(
    Object.keys(roleSummary).map((role) => ({
      Role: role,
      TotalUsers: roleSummary[role].total,
      LinkedToEmployee: roleSummary[role].withEmployee,
      UnlinkedCount: roleSummary[role].withoutEmployee.length,
      UnlinkedEmails: roleSummary[role].withoutEmployee.join(', ') || 'None',
    }))
  );

  console.log('\n=== CHECKING AARAV SHARMA PROFILE ===');
  const aarav = await prisma.user.findUnique({
    where: { email: 'aarav.sharma@hrms.com' },
    include: { employee: { include: { department: true, company: true } } }
  });

  if (aarav) {
    console.log('User ID:', aarav.id);
    console.log('User Email:', aarav.email);
    console.log('User Role:', aarav.role);
    console.log('Employee Record Exists:', Boolean(aarav.employee));
    if (aarav.employee) {
      console.log('Employee ID:', aarav.employee.id);
      console.log('Employee Name:', aarav.employee.firstName, aarav.employee.lastName);
      console.log('Job Title:', aarav.employee.jobTitle);
      console.log('Department:', aarav.employee.department?.name);
      console.log('Company:', aarav.employee.company?.name);
      console.log('Link matches (Employee.userId === User.id):', aarav.employee.userId === aarav.id);
    }
  } else {
    console.log('Aarav Sharma user NOT FOUND!');
  }
}

auditAllRolesLinkage()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
