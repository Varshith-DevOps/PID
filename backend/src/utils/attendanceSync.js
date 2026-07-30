const prisma = require('../config/database');
const { toZonedTime, fromZonedTime, format } = require('date-fns-tz');
const { detectAndCreateOvertime } = require('../controllers/overtimeController');

const resolveShiftForDate = async (employeeId, date, timezone = 'Asia/Kolkata') => {
  try {
    const zonedDate = toZonedTime(date, timezone);
    const localDayString = format(zonedDate, 'yyyy-MM-dd', { timeZone: timezone });
    const startOfDay = fromZonedTime(`${localDayString}T00:00:00`, timezone);

    const activeAssignment = await prisma.shiftAssignment.findFirst({
      where: {
        employeeId,
        startDate: { lte: startOfDay },
        OR: [{ endDate: null }, { endDate: { gte: startOfDay } }],
      },
      include: { shiftType: true },
    });

    if (activeAssignment && activeAssignment.shiftType) {
      return activeAssignment.shiftType;
    }
  } catch (err) {
    console.error('[RESOLVE SHIFT ERROR]:', err.message);
  }

  return {
    startTime: '09:00',
    endTime: '18:00',
    gracePeriod: 15,
    unpaidBreakMinutes: 60,
  };
};

const getSettings = async () => {
  let settings = await prisma.attendanceSettings.findFirst();
  if (!settings) {
    settings = await prisma.attendanceSettings.create({ data: {} });
  }
  return settings;
};

const processBiometricLog = async (logId) => {
  const log = await prisma.biometricRawLog.findUnique({
    where: { id: logId }
  });
  if (!log || log.processed) return;

  try {
    // Find active employee matching biometricId in this company
    const employee = await prisma.employee.findFirst({
      where: { biometricId: log.biometricId, companyId: log.companyId, isActive: true }
    });

    if (!employee) {
      await prisma.biometricRawLog.update({
        where: { id: logId },
        data: { processed: false, failureReason: 'Employee with matching biometricId not found' }
      });
      return;
    }

    const timezone = employee.timezone || 'Asia/Kolkata';
    const punchTime = new Date(log.timestamp);
    const zonedNow = toZonedTime(punchTime, timezone);
    const localDayString = format(zonedNow, 'yyyy-MM-dd', { timeZone: timezone });
    const todayLocal = fromZonedTime(`${localDayString}T00:00:00`, timezone);

    if (log.direction === 'IN') {
      // Check if attendance already registered for today local
      const existing = await prisma.attendance.findFirst({
        where: { employeeId: employee.id, date: todayLocal }
      });

      if (!existing) {
        // Create new check-in record
        const shift = await resolveShiftForDate(employee.id, punchTime, timezone);
        const settings = await getSettings();

        const scheduledLocalStr = `${localDayString}T${shift.startTime.padStart(5, '0')}:00`;
        const scheduledUtc = fromZonedTime(scheduledLocalStr, timezone);
        const lateMinutes = Math.max(0, Math.round((punchTime - scheduledUtc) / 60000));
        const grace = shift.gracePeriod !== undefined ? shift.gracePeriod : (settings.lateThreshold || 15);

        let status = 'PRESENT';
        if (lateMinutes > grace) status = 'LATE';

        await prisma.attendance.create({
          data: {
            employeeId: employee.id,
            date: todayLocal,
            checkIn: punchTime,
            status,
            lateMinutes: lateMinutes > 0 ? lateMinutes : 0,
            markedBy: 'SYSTEM_BIOMETRIC'
          }
        });
      }
    } else if (log.direction === 'OUT') {
      // Find incomplete check-in session from today or yesterday
      const yesterdayLocal = new Date(todayLocal);
      yesterdayLocal.setUTCDate(yesterdayLocal.getUTCDate() - 1);

      const attendance = await prisma.attendance.findFirst({
        where: { employeeId: employee.id, date: { gte: yesterdayLocal }, checkOut: null },
        orderBy: { date: 'desc' }
      });

      if (attendance) {
        const checkInTime = new Date(attendance.checkIn);
        const grossHours = (punchTime - checkInTime) / 3600000;
        
        if (grossHours > 0) {
          const shift = await resolveShiftForDate(employee.id, attendance.date, timezone);
          const settings = await getSettings();

          const unpaidBreakMinutes = shift.unpaidBreakMinutes || 0;
          let workHours = grossHours;
          if (grossHours > 5.0 && unpaidBreakMinutes > 0) {
            workHours = Math.max(0, grossHours - (unpaidBreakMinutes / 60));
          }

          let status = attendance.status;
          const halfDayHours = settings.halfDayThreshold || 4.0;
          if (workHours < halfDayHours) status = 'HALF_DAY';

          await prisma.attendance.update({
            where: { id: attendance.id },
            data: {
              checkOut: punchTime,
              workHours: Math.round(workHours * 100) / 100,
              status
            }
          });

          // Auto-detect Overtime
          await detectAndCreateOvertime(employee.id, attendance.date, workHours).catch(() => {});
        }
      }
    }

    // Mark as processed
    await prisma.biometricRawLog.update({
      where: { id: logId },
      data: { processed: true, failureReason: null }
    });
  } catch (err) {
    console.error('[BIOMETRIC SYNC ERROR]:', err);
    await prisma.biometricRawLog.update({
      where: { id: logId },
      data: { processed: false, failureReason: err.message }
    });
  }
};

module.exports = { processBiometricLog };
