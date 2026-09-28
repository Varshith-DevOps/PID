const prisma = require('../src/config/database');
const bcrypt = require('bcryptjs');

async function provisionProfiles() {
  console.log('=== PROVISIONING & REPAIRING ALL ROLE PROFILES ===\n');

  const defaultCompany = await prisma.company.findFirst({
    where: { name: { contains: 'PID' } }
  }) || await prisma.company.findFirst();

  if (!defaultCompany) {
    throw new Error('No company found in database to link profiles.');
  }

  console.log(`Using Default Company: ${defaultCompany.name} (ID: ${defaultCompany.id})`);

  // Ensure Departments exist
  const engDept = await prisma.department.findFirst({
    where: { companyId: defaultCompany.id, name: { equals: 'Engineering', mode: 'insensitive' } }
  }) || await prisma.department.create({
    data: { companyId: defaultCompany.id, name: 'Engineering', description: 'Engineering & Software Development' }
  });

  const hrDept = await prisma.department.findFirst({
    where: { companyId: defaultCompany.id, name: { equals: 'Human Resources', mode: 'insensitive' } }
  }) || await prisma.department.create({
    data: { companyId: defaultCompany.id, name: 'Human Resources', description: 'People & HR Management' }
  });

  const adminDept = await prisma.department.findFirst({
    where: { companyId: defaultCompany.id, name: { equals: 'Executive', mode: 'insensitive' } }
  }) || await prisma.department.create({
    data: { companyId: defaultCompany.id, name: 'Executive', description: 'Executive & Administration' }
  });

  const defaultPasswordHash = await bcrypt.hash('employee123', 10);

  // 1. Aarav Sharma Profile Verification & Fix
  console.log('\n1. Verifying/Fixing Aarav Sharma...');
  let aaravUser = await prisma.user.findUnique({
    where: { email: 'aarav.sharma@hrms.com' }
  });

  if (!aaravUser) {
    aaravUser = await prisma.user.create({
      data: {
        email: 'aarav.sharma@hrms.com',
        password: defaultPasswordHash,
        name: 'Aarav Sharma',
        role: 'EMPLOYEE',
        companyId: defaultCompany.id,
        isActive: true,
      }
    });
  } else {
    aaravUser = await prisma.user.update({
      where: { id: aaravUser.id },
      data: {
        role: 'EMPLOYEE',
        companyId: defaultCompany.id,
        isActive: true,
      }
    });
  }

  let aaravEmployee = await prisma.employee.findFirst({
    where: { userId: aaravUser.id }
  });

  if (!aaravEmployee) {
    aaravEmployee = await prisma.employee.create({
      data: {
        employeeId: 'EMP-3129',
        firstName: 'Aarav',
        lastName: 'Sharma',
        email: 'aarav.sharma@hrms.com',
        jobTitle: 'Senior Software Engineer',
        departmentId: engDept.id,
        companyId: defaultCompany.id,
        userId: aaravUser.id,
        salary: 120000,
        isActive: true,
      }
    });
  } else {
    aaravEmployee = await prisma.employee.update({
      where: { id: aaravEmployee.id },
      data: {
        firstName: 'Aarav',
        lastName: 'Sharma',
        jobTitle: 'Senior Software Engineer',
        departmentId: engDept.id,
        companyId: defaultCompany.id,
        isActive: true,
      }
    });
  }
  console.log('✅ Aarav Sharma verified: Senior Software Engineer, Engineering, Role: EMPLOYEE.');

  // 2. HR Account Setup / Fix (hr@hrms.com)
  console.log('\n2. Verifying/Fixing HR Account (hr@hrms.com)...');
  let hrUser = await prisma.user.findUnique({
    where: { email: 'hr@hrms.com' }
  });

  if (!hrUser) {
    hrUser = await prisma.user.create({
      data: {
        email: 'hr@hrms.com',
        password: defaultPasswordHash,
        name: 'HR Manager',
        role: 'HR',
        companyId: defaultCompany.id,
        isActive: true,
      }
    });
  } else {
    hrUser = await prisma.user.update({
      where: { id: hrUser.id },
      data: {
        role: 'HR',
        companyId: defaultCompany.id,
        isActive: true,
      }
    });
  }

  let hrEmployee = await prisma.employee.findFirst({
    where: { userId: hrUser.id }
  });

  if (!hrEmployee) {
    hrEmployee = await prisma.employee.create({
      data: {
        employeeId: 'EMP-HR01',
        firstName: 'HR',
        lastName: 'Manager',
        email: 'hr@hrms.com',
        jobTitle: 'HR Manager',
        departmentId: hrDept.id,
        companyId: defaultCompany.id,
        userId: hrUser.id,
        salary: 110000,
        isActive: true,
      }
    });
  } else {
    hrEmployee = await prisma.employee.update({
      where: { id: hrEmployee.id },
      data: {
        firstName: 'HR',
        lastName: 'Manager',
        jobTitle: 'HR Manager',
        departmentId: hrDept.id,
        companyId: defaultCompany.id,
        isActive: true,
      }
    });
  }
  console.log('✅ HR Account verified: hr@hrms.com, Role: HR, Linked Employee Profile: YES.');

  // 3. Admin Account Setup / Fix (admin@hrms.com)
  console.log('\n3. Verifying/Fixing Admin Account (admin@hrms.com)...');
  let adminUser = await prisma.user.findUnique({
    where: { email: 'admin@hrms.com' }
  });

  if (adminUser) {
    let adminEmployee = await prisma.employee.findFirst({
      where: { userId: adminUser.id }
    });

    if (!adminEmployee) {
      adminEmployee = await prisma.employee.create({
        data: {
          employeeId: 'EMP-ADM01',
          firstName: 'System',
          lastName: 'Admin',
          email: 'admin@hrms.com',
          jobTitle: 'Administrator',
          departmentId: adminDept.id,
          companyId: defaultCompany.id,
          userId: adminUser.id,
          salary: 150000,
          isActive: true,
        }
      });
    }
    console.log('✅ Admin Account verified: admin@hrms.com, Role: ADMIN, Linked Employee Profile: YES.');
  }

  // 4. Super Admin Account Setup / Fix (PIDsuperadmin@hcms.pid)
  console.log('\n4. Verifying/Fixing Super Admin Account (PIDsuperadmin@hcms.pid)...');
  let superAdminUser = await prisma.user.findUnique({
    where: { email: 'PIDsuperadmin@hcms.pid' }
  });

  if (!superAdminUser) {
    const superPassHash = await bcrypt.hash('Noallow#835', 10);
    superAdminUser = await prisma.user.create({
      data: {
        email: 'PIDsuperadmin@hcms.pid',
        password: superPassHash,
        name: 'Super Admin',
        role: 'SUPER_ADMIN',
        companyId: defaultCompany.id,
        isActive: true,
      }
    });
  } else {
    superAdminUser = await prisma.user.update({
      where: { id: superAdminUser.id },
      data: { companyId: defaultCompany.id }
    });
  }

  let superAdminEmployee = await prisma.employee.findFirst({
    where: { userId: superAdminUser.id }
  });

  if (!superAdminEmployee) {
    superAdminEmployee = await prisma.employee.create({
      data: {
        employeeId: 'EMP-SA01',
        firstName: 'Super',
        lastName: 'Admin',
        email: 'PIDsuperadmin@hcms.pid',
        jobTitle: 'Chief Executive Administrator',
        departmentId: adminDept.id,
        companyId: defaultCompany.id,
        userId: superAdminUser.id,
        salary: 200000,
        isActive: true,
      }
    });
  }
  console.log('✅ Super Admin Account verified: PIDsuperadmin@hcms.pid, Role: SUPER_ADMIN, Linked Employee Profile: YES.');

  // 5. Ensure all other tenant users have linked Employee profiles if missing
  console.log('\n5. Auditing remaining users for missing employee links...');
  const allUsers = await prisma.user.findMany({
    where: { companyId: { not: null } },
    include: { employee: true }
  });

  for (const u of allUsers) {
    if (!u.employee) {
      const nameParts = (u.name || 'User Name').split(' ');
      const firstName = nameParts[0] || 'Employee';
      const lastName = nameParts.slice(1).join(' ') || 'User';
      const empId = `EMP-${u.id.substring(0, 6).toUpperCase()}`;

      await prisma.employee.create({
        data: {
          employeeId: empId,
          firstName,
          lastName,
          email: u.email,
          jobTitle: `${u.role.replace(/_/g, ' ')} Specialist`,
          departmentId: engDept.id,
          companyId: u.companyId,
          userId: u.id,
          salary: 75000,
          isActive: true,
        }
      });
      console.log(`  -> Auto-provisioned missing Employee profile for ${u.email} (${u.role})`);
    }
  }

  console.log('\n=== PROVISIONING & REPAIR SUITE COMPLETE ===');
}

provisionProfiles()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
