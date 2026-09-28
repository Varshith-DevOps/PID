const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function updateSuperAdmin() {
  const hash = await bcrypt.hash('Noallow#835', 10);
  const existing = await prisma.user.findFirst({
    where: { email: { in: ['superadmin@hrms.com', 'PIDsuperadmin@hcms.pid'] } }
  });
  if (existing) {
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: { email: 'PIDsuperadmin@hcms.pid', password: hash }
    });
    console.log('Successfully updated SuperAdmin:', updated.email);
  } else {
    const created = await prisma.user.create({
      data: {
        email: 'PIDsuperadmin@hcms.pid',
        password: hash,
        name: 'Super Admin',
        role: 'SUPER_ADMIN'
      }
    });
    console.log('Created SuperAdmin:', created.email);
  }
}

updateSuperAdmin()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
