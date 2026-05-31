const prisma = require('../config/database');
const { detectAndCreateOvertime } = require('./overtimeController');

/** Resolve shift assignment for a specific employee on a target date */
const resolveShiftForDate = async (employeeId, date) => {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    // Look for active incomplete check-in from today or yesterday to support overnight shifts
    const existing = await prisma.attendance.findFirst({
      where: { employeeId, date: { gte: yesterday }, checkOut: null },
    });
    if (existing) {
      if (new Date(existing.date) < today) {
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
    const shift = await resolveShiftForDate(employeeId, today);
    const settings = await getSettings();

    const currentTime = new Date();
    const [hour, minute] = shift.startTime.split(':').map(Number);
    const scheduledTime = new Date();
    scheduledTime.setHours(hour, minute, 0, 0);

    const lateMinutes = Math.max(0, Math.round((currentTime - scheduledTime) / 60000));
    const grace = shift.gracePeriod !== undefined ? shift.gracePeriod : (settings.lateThreshold || 15);
    
    let status = 'PRESENT';
    if (lateMinutes > grace) status = 'LATE';

    const attendance = await prisma.attendance.create({
      data: {
        employeeId,
        date: today,
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Look for active incomplete check-in (supports overnight checkout matching yesterday's check-in)
    const attendance = await prisma.attendance.findFirst({
      where: { employeeId, date: { gte: yesterday }, checkOut: null },
      orderBy: { date: 'desc' },
    });

    if (!attendance || !attendance.checkIn) return res.status(404).json({ error: 'No check-in found' });

    const currentTime = new Date();
    const checkInTime = new Date(attendance.checkIn);
    const workHours = (currentTime - checkInTime) / 3600000;

    const settings = await getSettings();
    const shift = await resolveShiftForDate(employeeId, attendance.date);

    let status = attendance.status;
    const halfDayHours = settings.halfDayThreshold || 4.0;
    if (workHours < halfDayHours) status = 'HALF_DAY';

    const updated = await prisma.attendance.update({
      where: { id: attendance.id },
      data: { checkOut: currentTime, workHours: Math.round(workHours * 100) / 100, status },
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

    const attendances = await prisma.attendance.findMany({
      where: { date: { gte: today } },
      include: { employee: { select: { id: true, firstName: true, lastName: true, jobTitle: true, department: true } } },
    });

    const employees = await prisma.employee.findMany({ where: { isActive: true } });
    const presentIds = attendances.map((a) => a.employeeId);

    const missing = [];
    for (const e of employees) {
      if (!presentIds.includes(e.id)) {
        const shift = await resolveShiftForDate(e.id, today);
        const dayOfWeekName = today.toLocaleDateString('en-US', { weekday: 'long' });
        const isWO = shift.weeklyOffs && shift.weeklyOffs.split(',').map(s => s.trim().toLowerCase()).includes(dayOfWeekName.toLowerCase());

        missing.push({
          employee: e,
          status: isWO ? 'WEEKLY_OFF' : 'ABSENT',
        });
      }
    }

    res.json([...attendances, ...missing]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const getEmployeeAttendance = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { startDate, endDate, page = 1, limit = 31 } = req.query;

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
    res.status(500).json({ error: 'Server error' });
  }
};

const getMonthlyReport = async (req, res) => {
  try {
    const { month, year, departmentId } = req.query;
    const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1;
    const targetYear = year ? parseInt(year) : new Date().getFullYear();

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

    const where = { date: { gte: startDate, lte: endDate } };
    if (departmentId) where.employee = { departmentId };

    const attendances = await prisma.attendance.findMany({
      where,
      include: { employee: { include: { department: true } } },
    });

    const summary = {};
    for (const att of attendances) {
      const eId = att.employeeId;
      if (!summary[eId]) {
        summary[eId] = {
          employee: att.employee,
          present: 0,
          absent: 0,
          late: 0,
          halfDay: 0,
          weeklyOff: 0,
          workHours: 0,
        };
      }
      const st = att.status.toLowerCase();
      if (st === 'present') summary[eId].present++;
      else if (st === 'late') summary[eId].late++;
      else if (st === 'half_day') summary[eId].halfDay++;
      else if (st === 'weekly_off') summary[eId].weeklyOff++;
      else if (st === 'absent') summary[eId].absent++;

      if (att.workHours) summary[eId].workHours += att.workHours;
    }

    const totalDays = endDate.getDate();
    for (const eId in summary) {
      let absentCount = 0;
      let weeklyOffCount = 0;

      for (let dNum = 1; dNum <= totalDays; dNum++) {
        const curDate = new Date(targetYear, targetMonth - 1, dNum);
        const hasRecord = attendances.some(att => att.employeeId === eId && new Date(att.date).getDate() === dNum);
        
        if (!hasRecord) {
          const shift = await resolveShiftForDate(eId, curDate);
          const dayOfWeekName = curDate.toLocaleDateString('en-US', { weekday: 'long' });
          const isWO = shift.weeklyOffs && shift.weeklyOffs.split(',').map(s => s.trim().toLowerCase()).includes(dayOfWeekName.toLowerCase());

          if (isWO) {
            weeklyOffCount++;
          } else {
            absentCount++;
          }
        }
      }
      summary[eId].absent = absentCount;
      summary[eId].weeklyOff = weeklyOffCount;
    }

    res.json({ month: targetMonth, year: targetYear, summary: Object.values(summary) });
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

    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

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
    res.status(500).json({ error: 'Server error' });
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

module.exports = {
  checkIn,
  checkOut,
  getTodayAttendance,
  getEmployeeAttendance,
  getMonthlyReport,
  markAttendance,
  getSettingsHandler,
  updateSettings,
};