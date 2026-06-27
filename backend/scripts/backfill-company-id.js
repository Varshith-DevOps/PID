/**
 * @fileoverview One-off backfill for the companyId columns added to company-level
 * operational models (Project, Task, Sprint, JobOpening, ShiftType, ChecklistTemplate,
 * Holiday, BiometricDevice, Asset, LearningCourse, PayrollRun, AttendanceSettings,
 * PayrollSettings). These tables previously had no tenant column and relied on
 * per-controller checks; the isolation extension now scopes them by companyId.
 *
 * Strategy:
 *   1. Derive companyId from a tenant-bound relation where one exists
 *      (e.g. Project.manager -> Employee.companyId).
 *   2. For relationless config/global tables (settings, shift types, holidays, etc.)
 *      assign the sole company when the deployment is single-tenant. If more than one
 *      company exists and a row cannot be derived, it is left null and reported so an
 *      operator can resolve it explicitly (a null companyId is treated as unscoped).
 *
 * Run AFTER `prisma db push`/`migrate deploy` against the target database:
 *   node scripts/backfill-company-id.js          # apply
 *   node scripts/backfill-company-id.js --dry-run # report only
 *
 * Uses the raw PrismaClient so it is not itself tenant-scoped.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');

async function getSoleCompanyId() {
  const companies = await prisma.company.findMany({ select: { id: true } });
  return companies.length === 1 ? companies[0].id : null;
}

async function setCompanyId(model, id, companyId) {
  if (DRY_RUN) return;
  await prisma[model].update({ where: { id }, data: { companyId } });
}

async function main() {
  const soleCompanyId = await getSoleCompanyId();
  const unresolved = [];

  // --- Models with a derivable tenant relation -------------------------------
  // Project.managerId -> Employee.companyId
  const projects = await prisma.project.findMany({
    where: { companyId: null },
    select: { id: true, manager: { select: { companyId: true } } },
  });
  for (const p of projects) {
    const cid = p.manager?.companyId || soleCompanyId;
    if (cid) await setCompanyId('project', p.id, cid);
    else unresolved.push(['project', p.id]);
  }

  // Sprint.projectId -> Project.companyId (run after projects backfilled)
  const sprints = await prisma.sprint.findMany({
    where: { companyId: null },
    select: { id: true, project: { select: { companyId: true, manager: { select: { companyId: true } } } } },
  });
  for (const s of sprints) {
    const cid = s.project?.companyId || s.project?.manager?.companyId || soleCompanyId;
    if (cid) await setCompanyId('sprint', s.id, cid);
    else unresolved.push(['sprint', s.id]);
  }

  // Task.assigneeId -> Employee.companyId (fallback to project)
  const tasks = await prisma.task.findMany({
    where: { companyId: null },
    select: {
      id: true,
      assignee: { select: { companyId: true } },
      project: { select: { companyId: true } },
    },
  });
  for (const t of tasks) {
    const cid = t.assignee?.companyId || t.project?.companyId || soleCompanyId;
    if (cid) await setCompanyId('task', t.id, cid);
    else unresolved.push(['task', t.id]);
  }

  // JobOpening.departmentId -> Department.companyId
  const jobs = await prisma.jobOpening.findMany({
    where: { companyId: null },
    select: { id: true, department: { select: { companyId: true } } },
  });
  for (const j of jobs) {
    const cid = j.department?.companyId || soleCompanyId;
    if (cid) await setCompanyId('jobOpening', j.id, cid);
    else unresolved.push(['jobOpening', j.id]);
  }

  // Asset.assignedToId -> Employee.companyId (optional; fall back to sole company)
  const assets = await prisma.asset.findMany({
    where: { companyId: null },
    select: { id: true, assignedTo: { select: { companyId: true } } },
  });
  for (const a of assets) {
    const cid = a.assignedTo?.companyId || soleCompanyId;
    if (cid) await setCompanyId('asset', a.id, cid);
    else unresolved.push(['asset', a.id]);
  }

  // PayrollRun.legalEntityId -> LegalEntity.companyId
  const runs = await prisma.payrollRun.findMany({
    where: { companyId: null },
    select: { id: true, legalEntity: { select: { companyId: true } } },
  });
  for (const r of runs) {
    const cid = r.legalEntity?.companyId || soleCompanyId;
    if (cid) await setCompanyId('payrollRun', r.id, cid);
    else unresolved.push(['payrollRun', r.id]);
  }

  // --- Relationless config/global tables: sole-company only ------------------
  const globalModels = [
    'attendanceSettings', 'payrollSettings', 'shiftType',
    'checklistTemplate', 'holiday', 'biometricDevice', 'learningCourse',
  ];
  for (const model of globalModels) {
    const rows = await prisma[model].findMany({ where: { companyId: null }, select: { id: true } });
    if (!rows.length) continue;
    if (soleCompanyId) {
      if (!DRY_RUN) {
        await prisma[model].updateMany({ where: { companyId: null }, data: { companyId: soleCompanyId } });
      }
      console.log(`  ${model}: ${rows.length} row(s) -> ${soleCompanyId}`);
    } else {
      rows.forEach((row) => unresolved.push([model, row.id]));
    }
  }

  console.log(DRY_RUN ? '\n[DRY RUN] No changes written.' : '\n✅ Backfill applied.');
  if (unresolved.length) {
    console.warn(`\n⚠ ${unresolved.length} row(s) could not be auto-resolved (multi-tenant DB, no relation). Resolve manually:`);
    unresolved.slice(0, 50).forEach(([m, id]) => console.warn(`   ${m}: ${id}`));
    if (unresolved.length > 50) console.warn(`   ...and ${unresolved.length - 50} more`);
    process.exitCode = 1;
  }
}

main()
  .catch((e) => { console.error('Backfill error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
