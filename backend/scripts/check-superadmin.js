const prisma = require('../src/config/database');
const bcrypt = require('bcryptjs');

async function fixSuperAdmin() {
  const hash = await bcrypt.hash('Noallow#835', 10);
  const user = await prisma.user.upsert({
    where: { email: 'pidsuperadmin@hcms.pid' },
    update: { password: hash, role: 'SUPER_ADMIN', isActive: true },
    create: {
      email: 'pidsuperadmin@hcms.pid',
      password: hash,
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
    }
  });
  console.log('✅ Super Admin email pidsuperadmin@hcms.pid verified with password Noallow#835.');

  let emp = await prisma.employee.findFirst({ where: { userId: user.id } });
  if (!emp) {
    const dept = await prisma.department.findFirst();
    const comp = await prisma.company.findFirst();
    emp = await prisma.employee.create({
      data: {
        employeeId: `EMP-SA-${Date.now().toString().slice(-6)}`,
        firstName: 'Super',
        lastName: 'Admin',
        email: 'pidsuperadmin@hcms.pid',
        jobTitle: 'Chief Executive Administrator',
        departmentId: dept.id,
        companyId: comp.id,
        userId: user.id,
        salary: 200000,
        isActive: true,
      }
    });
    console.log('✅ Created linked Employee profile for Super Admin.');
  }
}

fixSuperAdmin()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
