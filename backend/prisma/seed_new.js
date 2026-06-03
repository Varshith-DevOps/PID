const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Attendance seed extensions...');

  // Create Branches
  const b1 = await prisma.branch.upsert({
    where: { name: 'Head Office' },
    update: {},
    create: { name: 'Head Office', timezone: 'Asia/Kolkata' }
  });
  const b2 = await prisma.branch.upsert({
    where: { name: 'US Branch' },
    update: {},
    create: { name: 'US Branch', timezone: 'America/New_York' }
  });
  console.log('✅ Branches seeded.');

  // Create Locations
  const l1 = await prisma.location.upsert({
    where: { name: 'Hyderabad Office' },
    update: {},
    create: { name: 'Hyderabad Office', timezone: 'Asia/Kolkata' }
  });
  const l2 = await prisma.location.upsert({
    where: { name: 'Bangalore Office' },
    update: {},
    create: { name: 'Bangalore Office', timezone: 'Asia/Kolkata' }
  });
  const l3 = await prisma.location.upsert({
    where: { name: 'New York Office' },
    update: {},
    create: { name: 'New York Office', timezone: 'America/New_York' }
  });
  console.log('✅ Locations seeded.');

  // Create Holidays
  const holidays = [
    { name: 'Republic Day', date: new Date('2026-01-26'), type: 'NATIONAL' },
    { name: 'Independence Day', date: new Date('2026-08-15'), type: 'NATIONAL' },
    { name: 'Gandhi Jayanti', date: new Date('2026-10-02'), type: 'NATIONAL' },
    { name: 'Christmas Day', date: new Date('2026-12-25'), type: 'NATIONAL' },
  ];
  for (const h of holidays) {
    await prisma.holiday.create({
      data: h
    });
  }
  console.log('✅ Holidays seeded.');

  // Create Biometric Devices
  await prisma.biometricDevice.upsert({
    where: { id: 'dev-001' },
    update: {},
    create: {
      id: 'dev-001',
      name: 'Main Gate Biometric',
      deviceIp: '192.168.1.100',
      lastClockDrift: 0,
      ntpValidated: true
    }
  });
  await prisma.biometricDevice.upsert({
    where: { id: 'dev-002' },
    update: {},
    create: {
      id: 'dev-002',
      name: 'Back Gate Biometric',
      deviceIp: '192.168.1.101',
      lastClockDrift: 0,
      ntpValidated: true
    }
  });
  console.log('✅ Biometric Devices seeded.');

  console.log('🎉 Attendance seed extensions completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
