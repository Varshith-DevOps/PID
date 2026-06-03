const prisma = require('../config/database');
const crypto = require('crypto');
const { toZonedTime, fromZonedTime, format } = require('date-fns-tz');
const { detectAndCreateOvertime } = require('./overtimeController');

/**
 * Validates mobile punch signature if clientType is mobile
 */
const verifyMobilePunchSignature = (punch) => {
  const secret = process.env.MOBILE_APP_SECRET || 'supersecret';
  const { employeeId, timestamp, deviceId, signature } = punch;
  
  if (!signature) return false;
  
  const payload = `${employeeId}:${timestamp}:${deviceId}`;
  const computed = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return computed === signature;
};

/**
 * Processes a single punch inside a transaction context
 */
const processSinglePunch = async (tx, punch, defaultSettings) => {
  const {
    employeeId,
    timestamp,
    type,
    deviceId,
    latitude,
    longitude,
    ipAddress,
    clientType
  } = punch;

  const punchTime = new Date(timestamp);

  // 1. Fetch active Employee
  const employee = await tx.employee.findUnique({
    where: { id: employeeId },
  });
  if (!employee || !employee.isActive) {
    throw new Error(`Employee ${employeeId} not found or inactive`);
  }

  // 2. Device Auth Check
  if (deviceId) {
    const device = await tx.biometricDevice.findUnique({ where: { id: deviceId } });
    if (!device) {
      throw new Error(`Biometric device ${deviceId} is unauthorized`);
    }
  }

  // 3. Resolve timezone & local date boundaries
  const timezone = employee.timezone || 'Asia/Kolkata';
  const zonedNow = toZonedTime(punchTime, timezone);
  const localDayString = format(zonedNow, 'yyyy-MM-dd', { timeZone: timezone });
  const todayLocal = fromZonedTime(`${localDayString}T00:00:00`, timezone);

  const yesterdayLocal = new Date(todayLocal);
  yesterdayLocal.setUTCDate(yesterdayLocal.getUTCDate() - 1);

  // 4. Resolve shift
  const activeAssignment = await tx.shiftAssignment.findFirst({
    where: {
      employeeId,
      startDate: { lte: todayLocal },
      OR: [{ endDate: null }, { endDate: { gte: todayLocal } }],
    },
    include: { shiftType: true },
  });
  const shift = activeAssignment?.shiftType || {
    startTime: '09:00',
    endTime: '18:00',
    gracePeriod: 15,
    minimumWorkHours: 8.0,
    weeklyOffs: 'Sunday',
    unpaidBreakMinutes: 60,
  };

  if (type === 'CHECK_IN') {
    // Check for existing incomplete check-in from today/yesterday
    const existing = await tx.attendance.findFirst({
      where: { employeeId, date: { gte: yesterdayLocal }, checkOut: null },
    });

    if (existing) {
      if (new Date(existing.date).getTime() < todayLocal.getTime()) {
        // Auto-checkout prior day's forgotten punch
        const checkInTime = new Date(existing.checkIn);
        const autoCheckOutTime = new Date(checkInTime.getTime() + 8 * 60 * 60 * 1000);
        await tx.attendance.update({
          where: { id: existing.id },
          data: {
            checkOut: autoCheckOutTime,
            workHours: 8.0,
            notes: (existing.notes ? existing.notes + ' ' : '') + '[Auto-checkout: missing checkout punch during sync]',
          },
        });
      } else {
        throw new Error(`Already checked in (active incomplete session exists for employee ${employeeId})`);
      }
    }

    // Calculate late minutes
    const scheduledLocalStr = `${localDayString}T${shift.startTime.padStart(5, '0')}:00`;
    const scheduledUtc = fromZonedTime(scheduledLocalStr, timezone);
    const lateMinutes = Math.max(0, Math.round((punchTime - scheduledUtc) / 60000));
    const grace = shift.gracePeriod !== undefined ? shift.gracePeriod : (defaultSettings.lateThreshold || 15);

    let status = 'PRESENT';
    if (lateMinutes > grace) status = 'LATE';

    return await tx.attendance.create({
      data: {
        employeeId,
        date: todayLocal,
        checkIn: punchTime,
        status,
        lateMinutes: lateMinutes > 0 ? lateMinutes : 0,
        notes: `[Biometric Sync from Device: ${deviceId || 'N/A'}]`,
      },
    });
  } else if (type === 'CHECK_OUT') {
    // Look for matching check-in
    const attendance = await tx.attendance.findFirst({
      where: { employeeId, date: { gte: yesterdayLocal }, checkOut: null },
      orderBy: { date: 'desc' },
    });

    if (!attendance || !attendance.checkIn) {
      throw new Error(`No matching check-in found for employee ${employeeId}`);
    }

    const checkInTime = new Date(attendance.checkIn);
    const grossHours = (punchTime - checkInTime) / 3600000;

    // Deduct unpaid breaks if qualified
    const unpaidBreakMinutes = shift.unpaidBreakMinutes || 0;
    let workHours = grossHours;
    if (grossHours > 5.0 && unpaidBreakMinutes > 0) {
      workHours = Math.max(0, grossHours - (unpaidBreakMinutes / 60));
    }

    let status = attendance.status;
    const halfDayHours = defaultSettings.halfDayThreshold || 4.0;
    if (workHours < halfDayHours) status = 'HALF_DAY';

    const updated = await tx.attendance.update({
      where: { id: attendance.id },
      data: {
        checkOut: punchTime,
        workHours: Math.round(workHours * 100) / 100,
        status,
        notes: (attendance.notes ? attendance.notes + ' ' : '') + `[Biometric Sync checkout: ${deviceId || 'N/A'}]`,
      },
    });

    // Auto overtime
    await detectAndCreateOvertime(employeeId, attendance.date, workHours);
    return updated;
  } else {
    throw new Error(`Unknown punch type: ${type}`);
  }
};

/**
 * Sync batch of punches from biometric logs
 */
const syncBiometricPunches = async (req, res) => {
  try {
    const { punches } = req.body;
    if (!Array.isArray(punches) || punches.length === 0) {
      return res.status(400).json({ error: 'No punches provided' });
    }

    // 1. Sort chronologically to process check-ins before check-outs!
    const sortedPunches = [...punches].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Get attendance settings
    let defaultSettings = await prisma.attendanceSettings.findFirst();
    if (!defaultSettings) {
      defaultSettings = await prisma.attendanceSettings.create({ data: {} });
    }

    const results = [];
    let processedCount = 0;
    let failedCount = 0;

    // Process in batches of 50 using transactions
    const batchSize = 50;
    for (let i = 0; i < sortedPunches.length; i += batchSize) {
      const batch = sortedPunches.slice(i, i + batchSize);

      await prisma.$transaction(async (tx) => {
        for (const punch of batch) {
          try {
            // Verify mobile signature if applicable
            if (punch.clientType === 'mobile') {
              const signatureValid = verifyMobilePunchSignature(punch);
              if (!signatureValid) {
                throw new Error('Invalid mobile request signature');
              }
            }

            await processSinglePunch(tx, punch, defaultSettings);
            results.push({
              employeeId: punch.employeeId,
              timestamp: punch.timestamp,
              type: punch.type,
              status: 'SUCCESS',
            });
            processedCount++;
          } catch (punchErr) {
            results.push({
              employeeId: punch.employeeId,
              timestamp: punch.timestamp,
              type: punch.type,
              status: 'FAILED',
              error: punchErr.message,
            });
            failedCount++;
          }
        }
      });
    }

    // Audit Log for Sync run
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        userEmail: req.user?.email || req.user?.role || 'SYSTEM',
        action: 'BIOMETRIC_SYNC',
        entity: 'BiometricDevice',
        entityId: 'BATCH_SYNC',
        newDetails: JSON.stringify({ processedCount, failedCount }),
        ipAddress: req.ip || req.headers?.['x-forwarded-for'] || '127.0.0.1',
      }
    });

    res.json({
      message: 'Biometric sync processed.',
      processedCount,
      failedCount,
      results,
    });
  } catch (error) {
    console.error('[BIOMETRIC SYNC ERROR]:', error.message);
    res.status(500).json({ error: 'Server error during sync operation' });
  }
};

module.exports = {
  syncBiometricPunches,
};
