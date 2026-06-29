/**
 * Backfill Notification.companyId for existing rows from the linked employee.
 * Broadcasts (employeeId null) created before this column existed have no tenant
 * marker and are left null (treated as legacy); new broadcasts get companyId from
 * the creating tenant's context automatically.
 *
 * Run outside any tenant context so the scoping extension does not filter rows.
 */
const prisma = require('../src/config/database');

(async () => {
  const pending = await prisma.notification.findMany({
    where: { companyId: null, employeeId: { not: null } },
    select: { id: true, employeeId: true },
  });
  console.log(`Notifications needing companyId: ${pending.length}`);

  const empCompany = new Map();
  let updated = 0;
  for (const n of pending) {
    let companyId = empCompany.get(n.employeeId);
    if (companyId === undefined) {
      const emp = await prisma.employee.findUnique({ where: { id: n.employeeId }, select: { companyId: true } });
      companyId = emp?.companyId || null;
      empCompany.set(n.employeeId, companyId);
    }
    if (companyId) {
      await prisma.notification.update({ where: { id: n.id }, data: { companyId } });
      updated++;
    }
  }
  console.log(`Backfilled companyId on ${updated} notifications.`);

  const orphans = await prisma.notification.count({ where: { companyId: null } });
  console.log(`Remaining notifications without companyId (legacy broadcasts): ${orphans}`);

  await prisma.$disconnectBase();
})().catch((e) => { console.error(e); process.exit(1); });
