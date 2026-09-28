const prisma = require('../src/config/database');
const bcrypt = require('bcryptjs');

async function diagnoseAndFixLogin() {
  console.log('=== AUTHENTICATION DIAGNOSTIC & SAFE REPAIR SUITE ===\n');

  const accountsToTest = [
    { email: 'aarav.sharma@hrms.com', expectedRole: 'EMPLOYEE', password: 'employee123' },
    { email: 'diya.patel@hrms.com', expectedRole: 'EMPLOYEE', password: 'employee123' },
    { email: 'ananya.reddy@hrms.com', expectedRole: 'EMPLOYEE', password: 'employee123' },
    { email: 'manager@hrms.com', expectedRole: 'MANAGER', password: 'employee123' },
    { email: 'admin@hrms.com', expectedRole: 'ADMIN', password: 'admin123' },
  ];

  for (const acc of accountsToTest) {
    const cleanEmail = acc.email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      include: { employee: true }
    });

    if (!user) {
      console.log(`ACCOUNT: ${cleanEmail}`);
      console.log(`  USER FOUND: NO`);
      console.log(`  ACTIVE: NO`);
      console.log(`  ROLE: N/A`);
      console.log(`  PASSWORD HASH VALID: NO`);
      console.log(`  PASSWORD MATCH: NO`);
      console.log('');
      continue;
    }

    const hashFormatValid = typeof user.password === 'string' && user.password.startsWith('$2');
    let isMatch = false;

    if (hashFormatValid) {
      try {
        isMatch = await bcrypt.compare(acc.password, user.password);
      } catch (err) {
        isMatch = false;
      }
    }

    console.log(`ACCOUNT: ${cleanEmail}`);
    console.log(`  USER FOUND: YES`);
    console.log(`  ACTIVE: ${user.isActive ? 'YES' : 'NO'}`);
    console.log(`  ROLE: ${user.role}`);
    console.log(`  LINKED EMPLOYEE PROFILE: ${user.employee ? 'YES (' + user.employee.jobTitle + ', ' + user.employee.departmentId + ')' : 'NO'}`);
    console.log(`  PASSWORD HASH VALID: ${hashFormatValid ? 'YES' : 'NO'}`);
    console.log(`  PASSWORD MATCH: ${isMatch ? 'YES' : 'NO'}`);

    if (!isMatch) {
      console.log(`  ⚠️ Password match failed! Updating hash safely using bcryptjs.hash...`);
      const newHash = await bcrypt.hash(acc.password, 10);
      await prisma.user.update({
        where: { id: user.id },
        data: { password: newHash }
      });
      const reCheck = await bcrypt.compare(acc.password, newHash);
      console.log(`  ✅ Password re-check after update: ${reCheck ? 'PASSED' : 'FAILED'}`);
    }
    console.log('');
  }

  console.log('=== DIAGNOSTIC SUITE COMPLETE ===');
}

diagnoseAndFixLogin()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
