/**
 * One-time administrative setup script to create requested test employee accounts
 * in the production database if they do not already exist.
 *
 * Accounts created (if missing):
 *  - aarav.sharma@hrms.com (Engineering)
 *  - diya.patel@hrms.com (Product)
 *  - ananya.reddy@hrms.com (Human Resources)
 *
 * Rules:
 *  - Idempotent: Checks existence before creation.
 *  - Secure: Hashes passwords with bcrypt (10 rounds).
 *  - Zero credential exposure: Password values/hashes are NEVER printed to logs.
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const TEST_ACCOUNTS = [
  {
    email: 'aarav.sharma@hrms.com',
    firstName: 'Aarav',
    lastName: 'Sharma',
    jobTitle: 'Senior Software Engineer',
    role: 'EMPLOYEE',
    deptName: 'Engineering',
  },
  {
    email: 'diya.patel@hrms.com',
    firstName: 'Diya',
    lastName: 'Patel',
    jobTitle: 'Product Manager',
    role: 'EMPLOYEE',
    deptName: 'Product',
  },
  {
    email: 'ananya.reddy@hrms.com',
    firstName: 'Ananya',
    lastName: 'Reddy',
    jobTitle: 'HR Specialist',
    role: 'EMPLOYEE',
    deptName: 'Human Resources',
  },
];

async function seedTestAccounts() {
  console.log('🔍 Checking existing company & departments...');

  // Get or reference default company
  const company = await prisma.company.findFirst({ where: { status: 'ACTIVE' } });
  if (!company) {
    throw new Error('No active company found in production database.');
  }

  // Generate password hash (never logged or hardcoded in outputs)
  const defaultHash = await bcrypt.hash('employee123', 10);

  for (const acc of TEST_ACCOUNTS) {
    const normalizedEmail = acc.email.toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      console.log(`[SKIP] Account already exists: ${normalizedEmail}`);
      continue;
    }

    // Find or create department for employee
    let department = await prisma.department.findFirst({
      where: { name: acc.deptName, companyId: company.id },
    });
    if (!department) {
      department = await prisma.department.create({
        data: { name: acc.deptName, companyId: company.id },
      });
    }

    // Create User record
    const newUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: defaultHash,
        name: `${acc.firstName} ${acc.lastName}`,
        role: acc.role,
        companyId: company.id,
        isActive: true,
      },
    });

    // Create Employee record linked to User
    const empIdSuffix = String(Math.floor(1000 + Math.random() * 9000));
    await prisma.employee.create({
      data: {
        employeeId: `EMP-${empIdSuffix}`,
        firstName: acc.firstName,
        lastName: acc.lastName,
        email: normalizedEmail,
        jobTitle: acc.jobTitle,
        salary: 85000.0,
        departmentId: department.id,
        userId: newUser.id,
        companyId: company.id,
        isActive: true,
      },
    });

    console.log(`[CREATED] Account provisioned: ${normalizedEmail}`);
  }

  console.log('✅ Account check & provisioning complete.');
}

seedTestAccounts()
  .catch((err) => {
    console.error('❌ Setup error:', err.message);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
