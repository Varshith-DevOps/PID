const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS, 10) || 12;

const hashPassword = (plain) => bcrypt.hash(plain, BCRYPT_ROUNDS);
const { getDefaultPermissions } = require('../src/controllers/permissionController');

async function repairEmployeeLinks() {
  console.log('Starting Employee-User linkage repair...');

  try {
    const unlinkedEmployees = await prisma.employee.findMany({
      where: { userId: null },
    });

    console.log(`Found ${unlinkedEmployees.length} employees with no linked User account.`);

    if (unlinkedEmployees.length === 0) {
      console.log('Nothing to repair.');
      return;
    }

    const defaultPassword = 'employee123';
    const hashedPassword = await hashPassword(defaultPassword);

    let linkedCount = 0;
    let createdCount = 0;

    for (const employee of unlinkedEmployees) {
      let user = await prisma.user.findUnique({
        where: { email: employee.email },
      });

      if (user) {
        // Link existing user
        await prisma.employee.update({
          where: { id: employee.id },
          data: { userId: user.id },
        });

        // Ensure user has companyId matching employee
        if (!user.companyId && employee.companyId) {
          await prisma.user.update({
            where: { id: user.id },
            data: { companyId: employee.companyId },
          });
        }
        
        linkedCount++;
        console.log(`[LINKED] Employee ${employee.email} to existing User.`);
      } else {
        // Create new user
        const permissions = {
          create: getDefaultPermissions('EMPLOYEE'),
        };

        user = await prisma.user.create({
          data: {
            email: employee.email,
            password: hashedPassword,
            name: `${employee.firstName} ${employee.lastName}`,
            role: 'EMPLOYEE',
            mustChangePassword: true,
            companyId: employee.companyId || null,
            permissions,
          },
        });

        await prisma.employee.update({
          where: { id: employee.id },
          data: { userId: user.id },
        });

        createdCount++;
        console.log(`[CREATED] New User account for Employee ${employee.email}.`);
      }
    }

    console.log('\nRepair Summary:');
    console.log(`- Total processed: ${unlinkedEmployees.length}`);
    console.log(`- Linked to existing Users: ${linkedCount}`);
    console.log(`- Created new Users: ${createdCount}`);
    console.log('\nRepair completed successfully.');
  } catch (error) {
    console.error('Error during repair:', error);
  } finally {
    await prisma.$disconnect();
  }
}

repairEmployeeLinks();
