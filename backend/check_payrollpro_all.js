process.env.DATABASE_URL = 'postgresql://payrollpro:payrollpro@localhost:5433/payrollpro?schema=public';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('=== RAW POSTGRESQL (payrollpro-postgres) ROW COUNTS ===');
  
  const users = await prisma.$queryRaw`SELECT COUNT(*) FROM "users"`;
  console.log('users count       :', users[0].count.toString());

  const employees = await prisma.$queryRaw`SELECT COUNT(*) FROM "employees"`;
  console.log('employees count   :', employees[0].count.toString());

  const companies = await prisma.$queryRaw`SELECT COUNT(*) FROM "companies"`;
  console.log('companies count   :', companies[0].count.toString());

  const auditLogs = await prisma.$queryRaw`SELECT COUNT(*) FROM "audit_logs"`;
  console.log('audit_logs count  :', auditLogs[0].count.toString());
}

run().catch(console.error).finally(() => prisma.$disconnect());
