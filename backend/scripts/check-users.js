const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUsers() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, name: true }
  });
  console.log('TOTAL USERS IN DB:', users.length);
  console.log('USERS LIST:', JSON.stringify(users, null, 2));

  const employees = await prisma.employee.findMany({
    select: { id: true, email: true, firstName: true, lastName: true, userId: true }
  });
  console.log('TOTAL EMPLOYEES IN DB:', employees.length);
  console.log('EMPLOYEES LIST:', JSON.stringify(employees, null, 2));
}

checkUsers().catch(console.error).finally(() => prisma.$disconnect());
