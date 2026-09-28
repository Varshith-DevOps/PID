process.env.DATABASE_URL = 'postgresql://payrollpro:payrollpro@localhost:5433/payrollpro?schema=public';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  console.log('=== REAL PRODUCTION DATABASE (payrollpro-postgres) ROW COUNTS ===');
  console.log('User Table Count       :', await prisma.user.count());
  console.log('Employee Table Count   :', await prisma.employee.count());
  console.log('Attendance Table Count :', await prisma.attendance.count());
}

check()
  .catch(err => console.error('DB Check Error:', err))
  .finally(() => prisma.$disconnect());
