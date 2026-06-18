const prisma = require('../config/database');
const crypto = require('crypto');
const { toZonedTime, fromZonedTime, format } = require('date-fns-tz');
const { detectAndCreateOvertime } = require('./overtimeController');

/**
 * Validates mobile punch signature if clientType is mobile
 */
const verifyMobilePunchSignature = (punch) => {
  const secret = process.env.MOBILE_APP_SECRET || 'pid-hcms-secret-key-123';
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

    // Process each punch in its own transaction (Bug 22)
    for (const punch of sortedPunches) {
      try {
        await prisma.$transaction(async (tx) => {
          // Verify mobile signature if applicable
          if (punch.clientType === 'mobile') {
            const signatureValid = verifyMobilePunchSignature(punch);
            if (!signatureValid) {
              throw new Error('Invalid mobile request signature');
            }
          }

          await processSinglePunch(tx, punch, defaultSettings);
        });

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

/**
 * Universal adapter webhook to ingest and sync punches from any external biometric device.
 * Supports authentication via X-API-Key and maps custom payload keys dynamically.
 */
const syncUniversalDevicePunch = async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    let companyId = req.user?.companyId;

    // 1. Machine-to-Machine API Key authentication
    if (!companyId && apiKey) {
      const connection = await prisma.integrationConnection.findFirst({
        where: { secretsRef: apiKey, status: 'ACTIVE' }
      });
      if (!connection) {
        return res.status(401).json({ error: 'Invalid or unauthorized X-API-Key reference.' });
      }
      companyId = connection.companyId;
    }

    if (!companyId) {
      return res.status(401).json({ error: 'Authentication required. Provide user credentials or X-API-Key.' });
    }

    const { deviceSerial, punches, customMapping } = req.body;
    if (!Array.isArray(punches)) {
      return res.status(400).json({ error: 'Punches array required.' });
    }

    // Default mapping fields
    const keyEmployee = customMapping?.employeeCodeField || 'employeeCode';
    const keyTimestamp = customMapping?.timestampField || 'timestamp';
    const keyType = customMapping?.actionTypeField || 'actionType';

    let defaultSettings = await prisma.attendanceSettings.findFirst();
    if (!defaultSettings) {
      defaultSettings = await prisma.attendanceSettings.create({ data: {} });
    }

    // Resolve or register physical biometric device record
    let deviceRecord = null;
    if (deviceSerial) {
      deviceRecord = await prisma.biometricDevice.findFirst({
        where: { name: deviceSerial }
      });
      if (!deviceRecord) {
        deviceRecord = await prisma.biometricDevice.create({
          data: { name: deviceSerial, lastSyncTime: new Date() }
        });
      } else {
        await prisma.biometricDevice.update({
          where: { id: deviceRecord.id },
          data: { lastSyncTime: new Date() }
        });
      }
    }

    const processed = [];
    const failed = [];

    // Map and process punches sequentially
    for (const rawPunch of punches) {
      try {
        const empCode = rawPunch[keyEmployee];
        const rawTime = rawPunch[keyTimestamp];
        const rawAct = rawPunch[keyType]; // expected: IN / OUT / CHECK_IN / CHECK_OUT

        if (!empCode || !rawTime) {
          throw new Error('Missing employee identifier or timestamp value in record.');
        }

        // Find employee database UUID from code
        const employee = await prisma.employee.findFirst({
          where: { employeeId: String(empCode), companyId }
        });

        if (!employee) {
          throw new Error(`Employee code ${empCode} not registered in company database.`);
        }

        const standardPunch = {
          employeeId: employee.id,
          timestamp: new Date(rawTime).toISOString(),
          type: (rawAct === 'IN' || rawAct === 'CHECK_IN') ? 'CHECK_IN' : 'CHECK_OUT',
          deviceId: deviceRecord?.id || null,
          clientType: 'biometric_device'
        };

        await prisma.$transaction(async (tx) => {
          await processSinglePunch(tx, standardPunch, defaultSettings);
        });

        processed.push({ empCode, status: 'SUCCESS' });
      } catch (err) {
        failed.push({ rawPunch, error: err.message });
      }
    }

    return res.status(200).json({
      message: 'Universal biometric sync complete.',
      deviceSerial: deviceSerial || 'UNKNOWN',
      totalReceived: punches.length,
      processedCount: processed.length,
      failedCount: failed.length,
      processed,
      failed
    });

  } catch (error) {
    console.error('[UNIVERSAL PUNCH SYNC ERROR]:', error.message);
    return res.status(500).json({ error: 'Failed to process universal punch sync.' });
  }
};

module.exports = {
  syncBiometricPunches,
  syncUniversalDevicePunch,
};
