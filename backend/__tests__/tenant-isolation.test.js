/**
 * Cross-tenant isolation regression tests for the company-level operational models
 * that previously had no companyId column (Project, Task, Sprint, JobOpening,
 * ShiftType, ChecklistTemplate, Holiday, BiometricDevice, Asset, LearningCourse,
 * PayrollRun, Attendance/Payroll settings).
 *
 * These exercise the Prisma client extension in config/database.js directly via the
 * tenant AsyncLocalStorage context, which is the data-layer guard every request runs
 * through. A regression here means one tenant can read/modify another tenant's data.
 */

const prisma = require('../src/config/database');
const { runWithCompanyId } = require('../src/utils/tenantContext');

// Run a Prisma operation inside a tenant context, awaiting it WITHIN the context.
// Prisma promises are lazy: the client extension's tenant hook runs when the query
// executes (at await), so the await must happen inside runWithCompanyId — exactly as
// real request handlers do (the tenant middleware wraps the whole async handler).
const asTenant = (companyId, fn) => runWithCompanyId(companyId, async () => { return await fn(); });

describe('Tenant isolation — company-level operational models', () => {
  let companyA;
  let companyB;
  const stamp = `${Date.now()}`.slice(-8);

  beforeAll(async () => {
    companyA = await prisma.company.create({
      data: { name: `Iso Co A ${stamp}`, code: `ISOA${stamp}` },
    });
    companyB = await prisma.company.create({
      data: { name: `Iso Co B ${stamp}`, code: `ISOB${stamp}` },
    });
  });

  afterAll(async () => {
    const ids = [companyA.id, companyB.id];
    // Raw (no ALS context) deletes, explicitly scoped, to clean up fixtures.
    for (const model of ['shiftType', 'holiday', 'learningCourse', 'payrollSettings', 'asset', 'payrollRun']) {
      await prisma[model].deleteMany({ where: { companyId: { in: ids } } });
    }
    await prisma.company.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  it('hides another tenant\'s records on findUnique-by-id', async () => {
    const holidayB = await asTenant(companyB.id, () =>
      prisma.holiday.create({ data: { name: 'B Republic Day', date: new Date('2026-01-26') } })
    );

    // Tenant A must not be able to read B's holiday by its id.
    const leaked = await asTenant(companyA.id, () =>
      prisma.holiday.findUnique({ where: { id: holidayB.id } })
    );
    expect(leaked).toBeNull();

    // Tenant B can read its own.
    const own = await asTenant(companyB.id, () =>
      prisma.holiday.findUnique({ where: { id: holidayB.id } })
    );
    expect(own?.id).toBe(holidayB.id);
  });

  it('excludes another tenant\'s records from findMany / list queries', async () => {
    await asTenant(companyA.id, () =>
      prisma.shiftType.create({ data: { name: 'A General', startTime: '09:00', endTime: '18:00' } })
    );
    await asTenant(companyB.id, () =>
      prisma.shiftType.create({ data: { name: 'B Night', startTime: '21:00', endTime: '06:00' } })
    );

    const listA = await asTenant(companyA.id, () => prisma.shiftType.findMany());
    expect(listA.every((s) => s.companyId === companyA.id)).toBe(true);
    expect(listA.some((s) => s.name === 'B Night')).toBe(false);
  });

  it('auto-populates companyId from context on create (write isolation)', async () => {
    const created = await asTenant(companyA.id, () =>
      prisma.learningCourse.create({ data: { title: `Course ${stamp}` } })
    );
    // companyId was never passed in data — the extension must stamp it.
    expect(created.companyId).toBe(companyA.id);
  });

  it('prevents cross-tenant updates via updateMany scoping', async () => {
    const settingsB = await asTenant(companyB.id, () =>
      prisma.payrollSettings.create({ data: {} })
    );

    // Tenant A tries to bump everyone's PF rate — must not touch B's row.
    await asTenant(companyA.id, () =>
      prisma.payrollSettings.updateMany({ data: { pfRate: 0.99 } })
    );

    const after = await asTenant(companyB.id, () =>
      prisma.payrollSettings.findUnique({ where: { id: settingsB.id } })
    );
    expect(after.pfRate).not.toBe(0.99);
  });

  it('allows two tenants to run payroll for the same month/year (per-tenant unique)', async () => {
    const runA = await asTenant(companyA.id, () =>
      prisma.payrollRun.create({ data: { month: 6, year: 2026 } })
    );
    // Previously @@unique([month, year]) made this collide across tenants.
    const runB = await asTenant(companyB.id, () =>
      prisma.payrollRun.create({ data: { month: 6, year: 2026 } })
    );
    expect(runA.companyId).toBe(companyA.id);
    expect(runB.companyId).toBe(companyB.id);
    expect(runA.id).not.toBe(runB.id);
  });

  it('scopes the same asset tag independently per tenant', async () => {
    const tag = `LAP-${stamp}`;
    const assetA = await asTenant(companyA.id, () =>
      prisma.asset.create({ data: { assetTag: tag, name: 'A Laptop', category: 'Laptop' } })
    );
    // Same tag in a different tenant must be allowed (composite unique).
    const assetB = await asTenant(companyB.id, () =>
      prisma.asset.create({ data: { assetTag: tag, name: 'B Laptop', category: 'Laptop' } })
    );
    expect(assetA.id).not.toBe(assetB.id);

    const leaked = await asTenant(companyA.id, () =>
      prisma.asset.findFirst({ where: { id: assetB.id } })
    );
    expect(leaked).toBeNull();
  });
});
