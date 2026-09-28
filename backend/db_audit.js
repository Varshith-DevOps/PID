require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: { employee: true }
  });
  console.log('=== TOTAL USERS:', users.length, '===');
  for (const u of users) {
    console.log(JSON.stringify({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      isActive: u.isActive,
      hasEmployee: Boolean(u.employee),
      employeeId: u.employee?.id || null,
      employeeCode: u.employee?.employeeId || null,
      employeeUserIdLink: u.employee?.userId === u.id
    }, null, 2));
  }

  const unlinkedEmployees = await prisma.employee.findMany({
    where: { userId: null }
  });
  console.log('=== UNLINKED EMPLOYEES (no userId):', unlinkedEmployees.length, '===');
  for (const e of unlinkedEmployees) {
    console.log(e.email, e.firstName, e.lastName);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
