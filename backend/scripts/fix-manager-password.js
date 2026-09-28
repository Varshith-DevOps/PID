const prisma = require('../src/config/database');
const bcrypt = require('bcryptjs');

async function fix() {
  const hash = await bcrypt.hash('employee123', 10);
  await prisma.user.update({
    where: { email: 'manager@hrms.com' },
    data: { password: hash }
  });
  console.log('✅ Updated manager@hrms.com password to employee123');
}

fix()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
