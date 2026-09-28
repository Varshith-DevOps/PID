const prisma = require('../src/config/database');

async function fixUnlinkedUsers() {
  console.log('=== PROVISIONING MISSING EMPLOYEE PROFILES FOR UNLINKED USERS ===\n');

  // 1. Aarav Sharma
  const aaravUser = await prisma.user.findUnique({ where: { email: 'aarav.sharma@hrms.com' } });
  if (aaravUser) {
    const existingAaravEmp = await prisma.employee.findFirst({
      where: { OR: [{ userId: aaravUser.id }, { email: aaravUser.email }] }
    });

    if (!existingAaravEmp) {
      const engDept = await prisma.department.findFirst({ where: { name: 'Engineering' } });
      const empIdSuffix = String(Math.floor(1000 + Math.random() * 9000));
      const newAarav = await prisma.employee.create({
        data: {
          employeeId: `EMP-${empIdSuffix}`,
          firstName: 'Aarav',
          lastName: 'Sharma',
          email: aaravUser.email,
          jobTitle: 'Senior Software Engineer',
          salary: 85000.0,
          departmentId: engDept.id,
          companyId: aaravUser.companyId,
          userId: aaravUser.id,
          isActive: true,
        }
      });
      console.log('✅ Created Employee Profile for Aarav Sharma:', newAarav.id);
    } else {
      // Ensure userId link, department, job title are 100% correct
      const engDept = await prisma.department.findFirst({ where: { name: 'Engineering' } });
      const updatedAarav = await prisma.employee.update({
        where: { id: existingAaravEmp.id },
        data: {
          userId: aaravUser.id,
          jobTitle: 'Senior Software Engineer',
          departmentId: engDept.id,
          companyId: aaravUser.companyId,
          isActive: true
        }
      });
      console.log('✅ Updated & Linked Employee Profile for Aarav Sharma:', updatedAarav.id);
    }
  } else {
    console.error('❌ User aarav.sharma@hrms.com not found!');
  }

  // 2. Manager User
  const managerUser = await prisma.user.findUnique({ where: { email: 'manager@hrms.com' } });
  if (managerUser) {
    const existingManagerEmp = await prisma.employee.findFirst({
      where: { OR: [{ userId: managerUser.id }, { email: managerUser.email }] }
    });

    if (!existingManagerEmp) {
      const engDept = await prisma.department.findFirst({ where: { name: 'Engineering' } });
      const empIdSuffix = String(Math.floor(1000 + Math.random() * 9000));
      const newManager = await prisma.employee.create({
        data: {
          employeeId: `EMP-${empIdSuffix}`,
          firstName: 'Manager',
          lastName: 'User',
          email: managerUser.email,
          jobTitle: 'Engineering Manager',
          salary: 120000.0,
          departmentId: engDept.id,
          companyId: managerUser.companyId,
          userId: managerUser.id,
          isActive: true,
        }
      });
      console.log('✅ Created Employee Profile for Manager User:', newManager.id);
    } else {
      const updatedManager = await prisma.employee.update({
        where: { id: existingManagerEmp.id },
        data: {
          userId: managerUser.id,
          companyId: managerUser.companyId,
          isActive: true
        }
      });
      console.log('✅ Updated & Linked Employee Profile for Manager User:', updatedManager.id);
    }
  }

  console.log('\n=== PROVISIONING COMPLETE ===');
}

fixUnlinkedUsers()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
