const prisma = require('../config/database');
const crypto = require('crypto');
const { detectAndCreateOvertime } = require('./overtimeController');
const { toZonedTime, fromZonedTime, format } = require('date-fns-tz');
const { canAccessEmployee, getEmployeeScopeIds, canApproveEmployeeWorkflow, isHr, isPayroll } = require('../services/accessControl');
const { assertPayrollPeriodOpen } = require('../services/payrollPeriodGuard');

/** Resolves shift assignment for a specific employee on a target date with timezone support */
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

  // Standard general shift fallback
  return {
    name: 'General Shift',
    startTime: '09:00',
    endTime: '18:00',
    startDay: 'Monday',
    endDay: 'Monday',
    gracePeriod: 15,
    minimumWorkHours: 8.0,
    weeklyOffs: 'Sunday',
    shiftAllowance: 0,
    ipRestricted: false,
    geoRestricted: false,
    unpaidBreakMinutes: 60,
    paidBreakMinutes: 0
  };
};

/** Retrieve or create default attendance settings */
const getSettings = async () => {
  let settings = await prisma.attendanceSettings.findFirst();
  if (!settings) {
    settings = await prisma.attendanceSettings.create({ data: {} });
  }
  return settings;
};

const checkIn = async (req, res) => {
  try {
    const { employeeId } = req.body;
    const currentTime = new Date();

    const employee = req.attendanceContext?.employee || await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    // Whitelisted Wi-Fi verification
    if (employee.companyId) {
      const whitelisted = await prisma.whiteListedWiFi.findMany({
        where: { companyId: employee.companyId }
      });
      if (whitelisted.length > 0) {
        const { ssid, bssid } = req.body;
        if (!ssid || !bssid) {
          return res.status(403).json({ error: 'Access denied. You must be connected to a corporate Wi-Fi network to check in.' });
        }
        const match = whitelisted.find(
          wifi => wifi.ssid.toLowerCase() === ssid.toLowerCase() && wifi.bssid.toLowerCase() === bssid.toLowerCase()
        );
        if (!match) {
          return res.status(403).json({ error: 'Access denied. You are not connected to a whitelisted corporate Wi-Fi network.' });
        }
      }
    }

    const timezone = employee.timezone || 'Asia/Kolkata';
    const zonedNow = toZonedTime(currentTime, timezone);
    const localDayString = format(zonedNow, 'yyyy-MM-dd', { timeZone: timezone });
    const todayLocal = fromZonedTime(`${localDayString}T00:00:00`, timezone);

    const yesterdayLocal = new Date(todayLocal);
    yesterdayLocal.setUTCDate(yesterdayLocal.getUTCDate() - 1);

    // Look for active incomplete check-in from today or yesterday to support overnight shifts
    const existing = await prisma.attendance.findFirst({
      where: { employeeId, date: { gte: yesterdayLocal }, checkOut: null },
    });
    if (existing) {
      if (new Date(existing.date).getTime() < todayLocal.getTime()) {
        // Forgotten checkout from a prior calendar day: Auto-checkout it gracefully
        const checkInTime = new Date(existing.checkIn);
        const autoCheckOutTime = new Date(checkInTime.getTime() + 8 * 60 * 60 * 1000); // 8 hours fallback
        await prisma.attendance.update({
          where: { id: existing.id },
          data: {
            checkOut: autoCheckOutTime,
            workHours: 8.0,
            notes: (existing.notes ? existing.notes + ' ' : '') + '[Auto-checkout: missing checkout punch]',
          },
        });
      } else {
        return res.status(400).json({ error: 'Already checked in (active incomplete session exists)' });
      }
    }

    // Resolve active shift for today
    const shift = req.attendanceContext?.shift || await resolveShiftForDate(employeeId, currentTime, timezone);
    const settings = await getSettings();

    const scheduledLocalStr = `${localDayString}T${shift.startTime.padStart(5, '0')}:00`;
    const scheduledUtc = fromZonedTime(scheduledLocalStr, timezone);

    const lateMinutes = Math.max(0, Math.round((currentTime - scheduledUtc) / 60000));
    const grace = shift.gracePeriod !== undefined ? shift.gracePeriod : (settings.lateThreshold || 15);
    
    let status = 'PRESENT';
    if (lateMinutes > grace) status = 'LATE';

    const attendance = await prisma.attendance.create({
      data: {
        employeeId,
        date: todayLocal,
        checkIn: currentTime,
        status,
        lateMinutes: lateMinutes > 0 ? lateMinutes : 0,
        markedBy: req.user?.id,
      },
    });

    res.json(attendance);
  } catch (error) {
    console.error('[CHECK IN ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const checkOut = async (req, res) => {
  try {
    const { employeeId } = req.body;
    const currentTime = new Date();

    const employee = req.attendanceContext?.employee || await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const timezone = employee.timezone || 'Asia/Kolkata';
    const zonedNow = toZonedTime(currentTime, timezone);
    const localDayString = format(zonedNow, 'yyyy-MM-dd', { timeZone: timezone });
    const todayLocal = fromZonedTime(`${localDayString}T00:00:00`, timezone);

    const yesterdayLocal = new Date(todayLocal);
    yesterdayLocal.setUTCDate(yesterdayLocal.getUTCDate() - 1);

    // Look for active incomplete check-in (supports overnight checkout matching yesterday's check-in)
    const attendance = await prisma.attendance.findFirst({
      where: { employeeId, date: { gte: yesterdayLocal }, checkOut: null },
      orderBy: { date: 'desc' },
    });

    if (!attendance || !attendance.checkIn) return res.status(404).json({ error: 'No check-in found' });

    const checkInTime = new Date(attendance.checkIn);
    const grossHours = (currentTime - checkInTime) / 3600000;

    const shift = req.attendanceContext?.shift || await resolveShiftForDate(employeeId, attendance.date, timezone);
    const settings = await getSettings();

    // Subtract unpaid breaks if total work duration qualifies
    const unpaidBreakMinutes = shift.unpaidBreakMinutes || 0;
    let workHours = grossHours;
    if (grossHours > 5.0 && unpaidBreakMinutes > 0) {
      workHours = Math.max(0, grossHours - (unpaidBreakMinutes / 60));
    }

    let status = attendance.status;
    const halfDayHours = settings.halfDayThreshold || 4.0;
    if (workHours < halfDayHours) status = 'HALF_DAY';

    const updated = await prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        checkOut: currentTime,
        workHours: Math.round(workHours * 100) / 100,
        status
      },
    });

    // Auto-detect and record Overtime requests
    await detectAndCreateOvertime(employeeId, attendance.date, workHours);

    res.json(updated);
  } catch (error) {
    console.error('[CHECK OUT ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const getTodayAttendance = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const employeeScopeIds = (isHr(req.user) || isPayroll(req.user))
      ? null
      : await getEmployeeScopeIds(req.user);
    const scopeWhere = employeeScopeIds ? { employeeId: { in: employeeScopeIds.length ? employeeScopeIds : ['__no_employee_scope__'] } } : {};

    const attendances = await prisma.attendance.findMany({
      where: { date: { gte: today }, ...scopeWhere },
      include: { employee: { select: { id: true, firstName: true, lastName: true, jobTitle: true, department: true } } },
    });

    const employees = await prisma.employee.findMany({
      where: { isActive: true, ...(employeeScopeIds ? { id: { in: employeeScopeIds.length ? employeeScopeIds : ['__no_employee_scope__'] } } : {}) },
    });
    const presentIds = attendances.map((a) => a.employeeId);

    // Fetch shift assignments in bulk to remove N+1 queries
    const shiftAssignments = await prisma.shiftAssignment.findMany({
      where: {
        startDate: { lte: today },
        OR: [{ endDate: null }, { endDate: { gte: today } }]
      },
      include: { shiftType: true }
    });

    const assignmentsMap = {};
    for (const sa of shiftAssignments) {
      assignmentsMap[sa.employeeId] = sa.shiftType;
    }

    // Fetch approved leaves overlapping with today
    const leaves = await prisma.leave.findMany({
      where: {
        status: 'APPROVED',
        startDate: { lte: today },
        endDate: { gte: today }
      }
    });
    const onLeaveEmployeeIds = new Set(leaves.map(l => l.employeeId));

    const defaultShift = {
      weeklyOffs: 'Sunday',
      startTime: '09:00',
      endTime: '18:00',
      gracePeriod: 15,
      unpaidBreakMinutes: 60
    };

    const missing = [];
    const dayOfWeekName = today.toLocaleDateString('en-US', { weekday: 'long' });

    for (const e of employees) {
      if (!presentIds.includes(e.id)) {
        const shift = assignmentsMap[e.id] || defaultShift;
        const isWO = shift.weeklyOffs && shift.weeklyOffs.split(',').map(s => s.trim().toLowerCase()).includes(dayOfWeekName.toLowerCase());

        let status = 'ABSENT';
        if (isWO) {
          status = 'WEEKLY_OFF';
        } else if (onLeaveEmployeeIds.has(e.id)) {
          status = 'LEAVE';
        }

        missing.push({
          employee: e,
          status,
        });
      }
    }

    res.json([...attendances, ...missing]);
  } catch (error) {
    console.error('[TODAY ATTENDANCE ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const getEmployeeAttendance = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { startDate, endDate, page = 1, limit = 31 } = req.query;
    if (!(await canAccessEmployee(req.user, employeeId))) {
      return res.status(403).json({ error: 'Access denied for requested employee attendance' });
    }

    const where = { employeeId };
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const attendances = await prisma.attendance.findMany({
      where,
      orderBy: { date: 'desc' },
      skip: (page - 1) * limit,
      take: parseInt(limit),
    });

    const total = await prisma.attendance.count({ where });
    res.json({ attendances, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Server error' });
  }
};

const getMonthlyReport = async (req, res) => {
  try {
    const { month, year, departmentId, page = 1, limit = 50 } = req.query;
    const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1;
    const targetYear = year ? parseInt(year) : new Date().getFullYear();

    const p = parseInt(page);
    const lim = parseInt(limit);

    // Get date range boundaries
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);
    const totalDays = endDate.getDate();

    // 1. Fetch employees in scope
    const employeeScopeIds = (isHr(req.user) || isPayroll(req.user))
      ? null
      : await getEmployeeScopeIds(req.user);
    const empWhere = {
      ...(departmentId ? { departmentId } : {}),
      ...(employeeScopeIds ? { id: { in: employeeScopeIds.length ? employeeScopeIds : ['__no_employee_scope__'] } } : {}),
    };
    const totalEmployees = await prisma.employee.count({ where: empWhere });
    const employees = await prisma.employee.findMany({
      where: empWhere,
      include: { department: true },
      skip: (p - 1) * lim,
      take: lim,
    });

    const employeeIds = employees.map(e => e.id);

    // 2. Bulk load dependencies in parallel
    const [attendances, shiftAssignments, leaves, holidays] = await Promise.all([
      prisma.attendance.findMany({
        where: {
          employeeId: { in: employeeIds },
          date: { gte: startDate, lte: endDate }
        }
      }),
      prisma.shiftAssignment.findMany({
        where: {
          employeeId: { in: employeeIds },
          startDate: { lte: endDate },
          OR: [{ endDate: null }, { endDate: { gte: startDate } }]
        },
        include: { shiftType: true }
      }),
      prisma.leave.findMany({
        where: {
          employeeId: { in: employeeIds },
          status: 'APPROVED',
          startDate: { lte: endDate },
          endDate: { gte: startDate }
        }
      }),
      prisma.holiday.findMany({
        where: {
          date: { gte: startDate, lte: endDate }
        }
      })
    ]);

    // 3. Build fast in-memory indexes
    const attendanceMap = {};
    for (const att of attendances) {
      const dateStr = att.date.toISOString().split('T')[0];
      attendanceMap[`${att.employeeId}_${dateStr}`] = att;
    }

    const assignmentsMap = {};
    for (const sa of shiftAssignments) {
      if (!assignmentsMap[sa.employeeId]) assignmentsMap[sa.employeeId] = [];
      assignmentsMap[sa.employeeId].push(sa);
    }

    const leavesMap = {};
    for (const lv of leaves) {
      if (!leavesMap[lv.employeeId]) leavesMap[lv.employeeId] = [];
      leavesMap[lv.employeeId].push(lv);
    }

    const holidayDates = new Set(holidays.map(h => h.date.toISOString().split('T')[0]));

    const defaultShift = {
      weeklyOffs: 'Sunday',
      startTime: '09:00',
      endTime: '18:00',
      gracePeriod: 15,
      unpaidBreakMinutes: 60
    };

    // 4. Resolve daily statuses in-memory
    const summaryList = [];

    for (const emp of employees) {
      const eId = emp.id;
      const empAssignments = assignmentsMap[eId] || [];
      const empLeaves = leavesMap[eId] || [];

      const empSummary = {
        employee: emp,
        present: 0,
        absent: 0,
        late: 0,
        halfDay: 0,
        weeklyOff: 0,
        leave: 0,
        holiday: 0,
        workHours: 0,
      };

      for (let dNum = 1; dNum <= totalDays; dNum++) {
        const curDate = new Date(targetYear, targetMonth - 1, dNum);
        const curDateStr = curDate.toISOString().split('T')[0];

        // Match Holiday
        const isHoliday = holidayDates.has(curDateStr);

        // Match Shift Assignment
        const activeAssignment = empAssignments.find(sa => {
          const start = new Date(sa.startDate);
          const end = sa.endDate ? new Date(sa.endDate) : null;
          return start <= curDate && (!end || end >= curDate);
        });
        const shift = activeAssignment ? activeAssignment.shiftType : defaultShift;

        // Match Weekly Off
        const dayOfWeekName = curDate.toLocaleDateString('en-US', { weekday: 'long' });
        const isWO = shift.weeklyOffs && shift.weeklyOffs.split(',').map(s => s.trim().toLowerCase()).includes(dayOfWeekName.toLowerCase());

        // Match Leave
        const onLeave = empLeaves.some(lv => {
          const start = new Date(lv.startDate);
          const end = new Date(lv.endDate);
          start.setHours(0,0,0,0);
          end.setHours(23,59,59,999);
          return start <= curDate && end >= curDate;
        });

        // Match Attendance
        const att = attendanceMap[`${eId}_${curDateStr}`];

        // Apply Priority Logic
        if (isHoliday) {
          empSummary.holiday++;
        } else if (isWO) {
          empSummary.weeklyOff++;
        } else if (onLeave) {
          empSummary.leave++;
        } else if (att) {
          const status = att.status.toLowerCase();
          if (status === 'present') empSummary.present++;
          else if (status === 'late') empSummary.late++;
          else if (status === 'half_day') empSummary.halfDay++;
          else if (status === 'weekly_off') empSummary.weeklyOff++;
          else if (status === 'absent') empSummary.absent++;
          
          if (att.workHours) empSummary.workHours += att.workHours;
        } else {
          empSummary.absent++;
        }
      }

      empSummary.workHours = Math.round(empSummary.workHours * 100) / 100;
      summaryList.push(empSummary);
    }

    res.json({
      month: targetMonth,
      year: targetYear,
      total: totalEmployees,
      page: p,
      limit: lim,
      summary: summaryList
    });
  } catch (error) {
    console.error('[MONTHLY REPORT ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const markAttendance = async (req, res) => {
  try {
    const { employeeId, date, status, notes } = req.body;

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    if (!(await canApproveEmployeeWorkflow(req.user, employeeId))) {
      return res.status(403).json({ error: 'Access denied. You can only mark attendance for your own authorized team.' });
    }

    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    await assertPayrollPeriodOpen(targetDate, 'Manual attendance update');

    const attendance = await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId, date: targetDate } },
      create: {
        employeeId,
        date: targetDate,
        status,
        notes,
        markedBy: req.user?.id,
      },
      update: { status, notes, markedBy: req.user?.id },
    });

    res.json(attendance);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Server error' });
  }
};

const getSettingsHandler = async (req, res) => {
  try {
    const settings = await getSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const updateSettings = async (req, res) => {
  try {
    const { checkInStartTime, checkInEndTime, checkOutTime, lateThreshold, halfDayThreshold } = req.body;
    const settings = await prisma.attendanceSettings.updateMany({
      data: {
        ...(checkInStartTime && { checkInStartTime }),
        ...(checkInEndTime && { checkInEndTime }),
        ...(checkOutTime && { checkOutTime }),
        ...(lateThreshold && { lateThreshold }),
        ...(halfDayThreshold && { halfDayThreshold }),
      },
    });
    res.json(await getSettings());
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const syncBiometricLogs = async (req, res) => {
  try {
    const apiKey = req.query.apiKey || req.headers['x-api-key'];
    // Fail closed: the webhook is only enabled when BIOMETRIC_API_KEY is explicitly
    // configured. No hardcoded/fallback secrets are accepted.
    const expectedKey = process.env.BIOMETRIC_API_KEY;
    if (!expectedKey) {
      return res.status(503).json({ error: 'Biometric webhook is not configured. Set BIOMETRIC_API_KEY to enable it.' });
    }
    const provided = Buffer.from(String(apiKey || ''));
    const expected = Buffer.from(String(expectedKey));
    const keyValid = provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
    if (!keyValid) {
      return res.status(401).json({ error: 'Unauthorized biometric webhook access' });
    }

    const { companyId, logs } = req.body;
    if (!companyId || !Array.isArray(logs)) {
      return res.status(400).json({ error: 'Missing companyId or logs array' });
    }

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const { processBiometricLog } = require('../utils/attendanceSync');
    const createdLogs = [];
    for (const item of logs) {
      const { deviceSerial, biometricId, timestamp, direction } = item;
      if (!deviceSerial || !biometricId || !timestamp || !direction) {
        continue;
      }

      const log = await prisma.biometricRawLog.create({
        data: {
          companyId,
          deviceSerial,
          biometricId: String(biometricId),
          timestamp: new Date(timestamp),
          direction,
          processed: false
        }
      });

      createdLogs.push(log);
      
      processBiometricLog(log.id).catch(err => {
        console.error(`Error processing biometric log ${log.id}:`, err.message);
      });
    }

    res.status(201).json({
      success: true,
      message: `Received ${createdLogs.length} biometric logs successfully.`,
      logsReceived: createdLogs.length
    });
  } catch (error) {
    console.error('[SYNC BIOMETRIC LOGS ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  checkIn,
  checkOut,
  getTodayAttendance,
  getEmployeeAttendance,
  getMonthlyReport,
  markAttendance,
  getSettingsHandler,
  updateSettings,
  syncBiometricLogs,
};
