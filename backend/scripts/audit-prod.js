require('dotenv').config({ path: require('path').resolve(__dirname, '../../../../../../../PID_hcms/backend/.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function audit() {
  try {
    console.log('1. Checking Environment Variables...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Missing');
    console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'Missing');

    console.log('\\n2. Testing Database Connection...');
    await prisma.$connect();
    console.log('Connected successfully.');

    console.log('\\n3. Checking Users Table...');
    const usersCount = await prisma.user.count();
    console.log(`Total users in DB: ${usersCount}`);

    if (usersCount === 0) {
      console.log('\\n❌ ERROR: The production database is completely empty (0 users found).');
      console.log('This is the exact reason why login returns "No account found" (Invalid credentials).');
    } else {
      console.log('Users found. Checking for super admin...');
      const admin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
      if (admin) {
        console.log(`Found Super Admin: ${admin.email}`);
      } else {
        console.log('No Super Admin found.');
      }
    }
  } catch (err) {
    console.error('Audit error:', err);
  } finally {
    await prisma.$disconnect();
  }
}
audit();
