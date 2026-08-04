const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();
const FLOOR = 12;
const parsed = parseInt(process.env.BCRYPT_ROUNDS, 10);
const BCRYPT_ROUNDS = Number.isFinite(parsed) ? Math.max(parsed, FLOOR) : FLOOR;

async function seed() {
  console.log('Seeding production database safely...');

  let defaultCompany = await prisma.company.findFirst();
  if (!defaultCompany) {
    defaultCompany = await prisma.company.create({
      data: {
        name: 'Default Organization',
        code: 'hq',
        subdomain: 'hq',
        email: 'superadmin@hrms.com',
        status: 'ACTIVE',
      },
    });
    console.log('? Created default company');
  }

  const adminEmail = 'superadmin@hrms.com';
  let admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    const hashedPassword = await bcrypt.hash('admin123', BCRYPT_ROUNDS);
    admin = await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        name: 'System Admin',
        role: 'SUPER_ADMIN',
        isActive: true,
        permissions: {
          create: [{ module: 'ALL', action: 'MANAGE', isGranted: true }]
        }
      }
    });
    console.log('✅ Created Super Admin (superadmin@hrms.com / admin123)');
  } else {
    console.log('? Super Admin already exists, skipping.');
  }

  // 3. Create a default Admin if none exists
  const companyAdminEmail = 'company_admin@hrms.com';
  let companyAdmin = await prisma.user.findUnique({ where: { email: companyAdminEmail } });
  if (!companyAdmin) {
    const hashedPassword = await bcrypt.hash('admin123', BCRYPT_ROUNDS);
    companyAdmin = await prisma.user.create({
      data: {
        email: companyAdminEmail,
        password: hashedPassword,
        name: 'Company Admin',
        role: 'ADMIN',
        companyId: defaultCompany.id,
        isActive: true,
        permissions: {
          create: [{ module: 'ALL', action: 'MANAGE', isGranted: true }]
        }
      }
    });
    console.log('✅ Created Company Admin (company_admin@hrms.com / admin123)');
  } else {
    console.log('⚡ Company Admin already exists, skipping.');
  }

  // 4. Create a default Manager if none exists
  const managerEmail = 'manager@hrms.com';
  let manager = await prisma.user.findUnique({ where: { email: managerEmail } });
  if (!manager) {
    const hashedPassword = await bcrypt.hash('manager123', BCRYPT_ROUNDS);
    manager = await prisma.user.create({
      data: {
        email: managerEmail,
        password: hashedPassword,
        name: 'Demo Manager',
        role: 'MANAGER',
        companyId: defaultCompany.id,
        isActive: true,
        permissions: {
          create: [
            { module: 'EMPLOYEES', action: 'VIEW', isGranted: true },
            { module: 'LEAVE', action: 'APPROVE', isGranted: true }
          ]
        }
      }
    });
    console.log('✅ Created Demo Manager (manager@hrms.com / manager123)');
  } else {
    console.log('⚡ Demo Manager already exists, skipping.');
  }

  // 5. Create a default Employee if none exists (optional but helpful for testing)
  const employeeEmail = 'employee@hrms.com';
  let employee = await prisma.user.findUnique({ where: { email: employeeEmail } });
  if (!employee) {
    const hashedPassword = await bcrypt.hash('employee123', BCRYPT_ROUNDS);
    employee = await prisma.user.create({
      data: {
        email: employeeEmail,
        password: hashedPassword,
        name: 'Demo Employee',
        role: 'EMPLOYEE',
        companyId: defaultCompany.id,
        isActive: true,
        permissions: {
          create: [
            { module: 'EMPLOYEES', action: 'VIEW', isGranted: true },
            { module: 'LEAVE', action: 'CREATE', isGranted: true }
          ]
        }
      }
    });
    console.log('✅ Created Demo Employee (employee@hrms.com / employee123)');
  } else {
    console.log('⚡ Demo Employee already exists, skipping.');
  }

  console.log('Production seeding completed successfully.');
}

seed()
  .catch((e) => {
    console.error('Failed to seed production database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
