const prisma = require('../src/config/database');

async function listUsers() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, companyId: true, isActive: true },
    orderBy: { role: 'asc' }
  });
  console.table(users);
}

listUsers()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
