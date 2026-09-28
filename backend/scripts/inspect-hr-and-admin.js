const prisma = require('../src/config/database');

async function inspectHrAndAdmin() {
  console.log('=== HR AND ADMIN ACCOUNTS DETAILED INSPECTION ===\n');

  const hrAndAdmins = await prisma.user.findMany({
    where: {
      OR: [
        { role: { in: ['HR', 'ADMIN', 'SUPER_ADMIN'] } },
        { email: { contains: 'ananya' } },
        { email: { contains: 'hr' } },
      ]
    },
    include: { employee: { include: { department: true, company: true } } }
  });

  for (const u of hrAndAdmins) {
    console.log(`Email: ${u.email} | Role: ${u.role} | Active: ${u.isActive} | CompanyId: ${u.companyId}`);
    if (u.employee) {
      console.log(`  -> Employee: ${u.employee.firstName} ${u.employee.lastName} | ID: ${u.employee.id} | JobTitle: ${u.employee.jobTitle} | Dept: ${u.employee.department?.name}`);
    } else {
      console.log(`  -> NO LINKED EMPLOYEE PROFILE`);
    }
  }
}

inspectHrAndAdmin()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
