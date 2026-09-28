// temp_check.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const email = 'aarav.sharma@hrms.com';
  const user = await prisma.user.findUnique({ where: { email } });
  console.log('User record:', user);
  if (user) {
    const empByUser = await prisma.employee.findUnique({ where: { userId: user.id } });
    console.log('Employee via userId:', empByUser);
    const empByEmail = await prisma.employee.findUnique({ where: { email } });
    console.log('Employee via email:', empByEmail);
  }
  await prisma.$disconnect();
})();
