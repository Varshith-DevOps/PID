const prisma = require('../config/database');

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

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const existing = await prisma.attendance.findFirst({
      where: { employeeId, date: { gte: today } },
    });
    if (existing?.checkIn) return res.status(400).json({ error: 'Already checked in' });

    const settings = await getSettings();
    const currentTime = new Date();
    const [hour, minute] = settings.checkInStartTime.split(':').map(Number);
    const scheduledTime = new Date();
    scheduledTime.setHours(hour, minute, 0, 0);

    const lateMinutes = Math.max(0, Math.round((currentTime - scheduledTime) / 60000));
    let status = 'PRESENT';
    if (lateMinutes > 0) status = 'LATE';
    if (lateMinutes >= settings.lateThreshold) status = 'LATE';

    const attendance = await prisma.attendance.upsert({
      where: { id: existing?.id || '' },
      create: {
        employeeId,
        date: today,
        checkIn: currentTime,
        status,
        lateMinutes: lateMinutes > 0 ? lateMinutes : 0,
        markedBy: req.user?.id,
      },
      update: {
        checkIn: currentTime,
        status,
        lateMinutes: lateMinutes > 0 ? lateMinutes : 0,
        markedBy: req.user?.id,
      },
    });

    res.json(attendance);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const checkOut = async (req, res) => {
  try {
    const { employeeId } = req.body;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await prisma.attendance.findFirst({
      where: { employeeId, date: { gte: today } },
    });

    if (!attendance || !attendance.checkIn) return res.status(404).json({ error: 'No check-in found' });
    if (attendance.checkOut) return res.status(400).json({ error: 'Already checked out' });

    const currentTime = new Date();
    const checkInTime = new Date(attendance.checkIn);
    const workHours = (currentTime - checkInTime) / 3600000;

    const settings = await getSettings();
    let status = attendance.status;
    if (workHours < settings.halfDayThreshold) status = 'HALF_DAY';

    const updated = await prisma.attendance.update({
      where: { id: attendance.id },
      data: { checkOut: currentTime, workHours: Math.round(workHours * 100) / 100, status },
    });

    res.json(updated);
  } catch (error) {
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

    const missing = employees.filter((e) => !presentIds.includes(e.id)).map((e) => ({
      employee: e,
      status: 'ABSENT',
    }));

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
          workHours: 0,
        };
      }
      summary[eId][att.status.toLowerCase()]++;
      if (att.workHours) summary[eId].workHours += att.workHours;
    }

    const totalDays = endDate.getDate();
    for (const eId in summary) {
      summary[eId].absent = totalDays - summary[eId].present;
    }

    res.json({ month: targetMonth, year: targetYear, summary: Object.values(summary) });
  } catch (error) {
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