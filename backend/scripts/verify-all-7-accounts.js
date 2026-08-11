require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const ACCOUNTS = [
  { email: 'aarav.sharma@hrms.com', name: 'Aarav Sharma', role: 'EMPLOYEE', title: 'Senior Software Engineer', password: 'employee123' },
  { email: 'ananya.reddy@hrms.com', name: 'Ananya Reddy', role: 'EMPLOYEE', title: 'HR Specialist', password: 'employee123' },
  { email: 'diya.patel@hrms.com', name: 'Diya Patel', role: 'EMPLOYEE', title: 'Product Manager', password: 'employee123' },
  { email: 'hr@hrms.com', name: 'HR Manager', role: 'HR', title: 'HR Manager', password: 'employee123' },
  { email: 'admin@hrms.com', name: 'Admin User', role: 'ADMIN', title: 'System Administrator', password: 'admin123' },
  { email: 'manager@hrms.com', name: 'Manager User', role: 'MANAGER', title: 'Engineering Manager', password: 'employee123' },
  { email: 'pidsuperadmin@hcms.pid', name: 'Super Admin', role: 'SUPER_ADMIN', title: 'Chief Administrator', password: 'Noallow#835' },
];

async function main() {
  console.log('=== VERIFYING & PROVISIONING ALL 7 TEST ACCOUNTS ===\n');

  let company = await prisma.company.findFirst({
    where: { name: { contains: 'PID' } }
  }) || await prisma.company.findFirst();

  if (!company) {
    console.log('No company found, creating PID hcms Corp...');
    company = await prisma.company.create({
      data: { name: 'PID hcms Corp', code: 'PID', status: 'ACTIVE' }
    });
  }

  let dept = await prisma.department.findFirst({ where: { companyId: company.id } });
  if (!dept) {
    dept = await prisma.department.create({
      data: { name: 'Engineering', companyId: company.id }
    });
  }

  for (const acc of ACCOUNTS) {
    const passwordHash = await bcrypt.hash(acc.password, 10);

    let user = await prisma.user.findUnique({
      where: { email: acc.email }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: acc.email,
          password: passwordHash,
          name: acc.name,
          role: acc.role,
          companyId: company.id,
          isActive: true
        }
      });
      console.log(`[USER CREATED] ${acc.email} (${acc.role})`);
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          password: passwordHash,
          name: acc.name,
          role: acc.role,
          companyId: company.id,
          isActive: true
        }
      });
      console.log(`[USER UPDATED] ${acc.email} (${acc.role})`);
    }

    let employee = await prisma.employee.findFirst({
      where: { userId: user.id }
    });

    if (!employee) {
      const nameParts = acc.name.split(' ');
      employee = await prisma.employee.create({
        data: {
          employeeId: `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
          firstName: nameParts[0],
          lastName: nameParts.slice(1).join(' ') || 'User',
          email: acc.email,
          jobTitle: acc.title,
          departmentId: dept.id,
          companyId: company.id,
          userId: user.id,
          salary: 95000,
          isActive: true
        }
      });
      console.log(`  └─ [EMPLOYEE CREATED] ${employee.id} linked to User ${user.id}`);
    } else {
      employee = await prisma.employee.update({
        where: { id: employee.id },
        data: {
          email: acc.email,
          jobTitle: acc.title,
          companyId: company.id,
          isActive: true
        }
      });
      console.log(`  └─ [EMPLOYEE OK] ${employee.id} linked to User ${user.id}`);
    }
  }

  console.log('\n=== ALL 7 TEST ACCOUNTS VERIFIED AND LINKED ===');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
