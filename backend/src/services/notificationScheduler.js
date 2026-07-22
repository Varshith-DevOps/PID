const prisma = require('../config/database');
const logger = require('../utils/logger');
const { createNotificationRecord, enqueueDueNotifications } = require('./notificationService');

let schedulerStarted = false;
let sweepRunning = false;

const startOfDay = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const endOfDay = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

const createOnce = async (payload) => {
  const existing = await prisma.notification.findFirst({
    where: {
      employeeId: payload.employeeId || null,
      type: payload.type,
      channel: payload.channel || 'IN_APP',
      createdAt: { gte: startOfDay(), lte: endOfDay() },
      metadata: { contains: payload.uniqueKey },
    },
  });
  if (existing) return null;
  return createNotificationRecord({
    ...payload,
    metadata: { ...(payload.metadata || {}), uniqueKey: payload.uniqueKey },
  }, { actor: { id: null, email: 'system', role: 'SYSTEM', companyId: payload.companyId || null } });
};

const runDailyEmployeeMilestones = async () => {
  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    select: { id: true, companyId: true, firstName: true, lastName: true, dateOfBirth: true, joinDate: true },
  });

  let created = 0;
  for (const employee of employees) {
    const employeeName = `${employee.firstName} ${employee.lastName}`.trim();
    if (employee.dateOfBirth && employee.dateOfBirth.getMonth() + 1 === month && employee.dateOfBirth.getDate() === day) {
      const row = await createOnce({
        companyId: employee.companyId,
        employeeId: employee.id,
        title: 'Happy Birthday',
        message: `Happy birthday, ${employeeName}. Wishing you a wonderful year ahead.`,
        type: 'BIRTHDAY_WISHES',
        channel: 'IN_APP',
        module: 'EMPLOYEES',
        uniqueKey: `birthday:${employee.id}:${today.getFullYear()}`,
      });
      if (row) created++;
    }
    if (employee.joinDate && employee.joinDate.getMonth() + 1 === month && employee.joinDate.getDate() === day) {
      const row = await createOnce({
        companyId: employee.companyId,
        employeeId: employee.id,
        title: 'Work Anniversary',
        message: `Happy work anniversary, ${employeeName}. Thank you for being part of the journey.`,
        type: 'WORK_ANNIVERSARY',
        channel: 'IN_APP',
        module: 'EMPLOYEES',
        uniqueKey: `anniversary:${employee.id}:${today.getFullYear()}`,
      });
      if (row) created++;
    }
  }
  return created;
};

const runNotificationScheduler = async () => {
  if (sweepRunning) return { skipped: true };
  sweepRunning = true;
  try {
    const dueQueued = await enqueueDueNotifications();
    const milestones = await runDailyEmployeeMilestones();
    return { dueQueued, milestones };
  } finally {
    sweepRunning = false;
  }
};

const startNotificationScheduler = () => {
  if (schedulerStarted) return;
  schedulerStarted = true;
  const runSafely = () => {
    runNotificationScheduler()
      .then((summary) => logger.info('Notification scheduler sweep', summary))
      .catch((error) => logger.error('Notification scheduler failed', { error: error.message }));
  };
  setTimeout(runSafely, 15_000).unref?.();
  setInterval(runSafely, Number(process.env.NOTIFICATION_SCHEDULER_INTERVAL_MS || 15 * 60 * 1000)).unref?.();
};

module.exports = {
  runNotificationScheduler,
  startNotificationScheduler,
};
