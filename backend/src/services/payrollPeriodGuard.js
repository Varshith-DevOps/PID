const prisma = require('../config/database');

const MUTATION_BLOCKING_STATUSES = new Set(['DRAFT', 'REVIEWED', 'APPROVED', 'PROCESSED', 'LOCKED']);

const toMonthYear = (dateLike) => {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return null;
  return { month: date.getMonth() + 1, year: date.getFullYear() };
};

const findBlockingPayrollRun = async (dateLike) => {
  const period = toMonthYear(dateLike);
  if (!period) return null;

  const run = await prisma.payrollRun.findUnique({
    where: { month_year: period },
    select: { id: true, month: true, year: true, status: true },
  });

  return run && MUTATION_BLOCKING_STATUSES.has(run.status) ? run : null;
};

const assertPayrollPeriodOpen = async (dateLike, action = 'This change') => {
  const run = await findBlockingPayrollRun(dateLike);
  if (!run) return;

  const month = String(run.month).padStart(2, '0');
  const error = new Error(`${action} is blocked because payroll ${month}/${run.year} is already ${run.status}. Reverse the payroll run before changing payroll-impacting data.`);
  error.status = 423;
  error.payrollRun = run;
  throw error;
};

const assertPayrollRangeOpen = async (startDate, endDate, action = 'This change') => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;

  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cursor <= last) {
    await assertPayrollPeriodOpen(cursor, action);
    cursor.setMonth(cursor.getMonth() + 1);
  }
};

module.exports = {
  assertPayrollPeriodOpen,
  assertPayrollRangeOpen,
  findBlockingPayrollRun,
};
