const prisma = require('../config/database');
const { toZonedTime, fromZonedTime, format } = require('date-fns-tz');

const submitRegularization = async (req, res) => {
  try {
    const {
      date,
      requestType,
      checkInCorrection,
      checkOutCorrection,
      statusCorrection,
      reason,
      superAdminOverrideReason,
    } = req.body;

    if (!date || !requestType || !reason) {
      return res.status(400).json({ error: 'Missing required parameters (date, requestType, reason)' });
    }

    const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });
    if (!employee) {
      return res.status(404).json({ error: 'Employee profile not found' });
    }

    const timezone = employee.timezone || 'Asia/Kolkata';
    const dateOnly = String(date).substring(0, 10);
    const targetDate = fromZonedTime(`${dateOnly}T00:00:00`, timezone);

    // Safeguard: Check payroll period lock status
    const targetMonth = targetDate.getMonth() + 1;
    const targetYear = targetDate.getFullYear();
    const payrollRun = await prisma.payrollRun.findFirst({
      where: { month: targetMonth, year: targetYear }
    });

    if (payrollRun && ['PROCESSED', 'LOCKED', 'FINALIZED'].includes(payrollRun.status)) {
      if (req.user?.role === 'SUPER_ADMIN' && superAdminOverrideReason) {
        console.log(`[SUPER_ADMIN OVERRIDE]: Bypassed payroll lock for date ${date}. Reason: ${superAdminOverrideReason}`);
      } else {
        return res.status(400).json({ error: 'Payroll period locked. Regularization not permitted for this period.' });
      }
    }

    const regularization = await prisma.attendanceRegularization.create({
      data: {
        employeeId: employee.id,
        date: targetDate,
        requestType,
        checkInCorrection: checkInCorrection ? new Date(checkInCorrection) : null,
        checkOutCorrection: checkOutCorrection ? new Date(checkOutCorrection) : null,
        statusCorrection: statusCorrection || null,
        reason,
        status: 'PENDING',
      },
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        userEmail: req.user?.email || req.user?.role || 'SYSTEM',
        action: 'REGULARIZATION_SUBMIT',
        entity: 'AttendanceRegularization',
        entityId: regularization.id,
        newDetails: JSON.stringify(regularization),
      }
    });

    res.status(201).json(regularization);
  } catch (error) {
    console.error('[SUBMIT REGULARIZATION ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const getRegularizations = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const loggedInEmp = await prisma.employee.findUnique({ where: { userId: req.user.id } });

    if (req.user.role === 'MANAGER' && loggedInEmp) {
      // MANAGER: subordinates + own
      const subordinates = await prisma.employee.findMany({
        where: { managerId: loggedInEmp.id },
        select: { id: true },
      });
      const ids = [...subordinates.map(s => s.id), loggedInEmp.id];
      filter.employeeId = { in: ids };
    } else if (req.user.role !== 'ADMIN' && req.user.role !== 'HR' && req.user.role !== 'SUPER_ADMIN') {
      // EMPLOYEE: own only
      filter.employeeId = loggedInEmp ? loggedInEmp.id : 'none';
    }

    const requests = await prisma.attendanceRegularization.findMany({
      where: filter,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            jobTitle: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(requests);
  } catch (error) {
    console.error('[GET REGULARIZATIONS ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const actionRegularization = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, managerRemarks, superAdminOverrideReason } = req.body; // 'APPROVED' or 'REJECTED'

    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be APPROVED or REJECTED.' });
    }

    const request = await prisma.attendanceRegularization.findUnique({
      where: { id },
      include: { employee: true },
    });

    if (!request) {
      return res.status(404).json({ error: 'Regularization request not found' });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({ error: 'Request has already been processed' });
    }

    // Role validation: Manager can only action their direct subordinates
    if (req.user.role !== 'ADMIN' && req.user.role !== 'HR' && req.user.role !== 'SUPER_ADMIN') {
      const loggedInEmp = await prisma.employee.findUnique({ where: { userId: req.user.id } });
      if (!loggedInEmp || request.employee.managerId !== loggedInEmp.id) {
        return res.status(403).json({ error: 'Forbidden: You do not have permission to action this request.' });
      }
    }

    // Safeguard: Check payroll period lock status
    const timezone = request.employee.timezone || 'Asia/Kolkata';
    const zonedDate = toZonedTime(request.date, timezone);
    const targetMonth = zonedDate.getMonth() + 1;
    const targetYear = zonedDate.getFullYear();
    const payrollRun = await prisma.payrollRun.findFirst({
      where: { month: targetMonth, year: targetYear }
    });

    if (payrollRun && ['PROCESSED', 'LOCKED', 'FINALIZED'].includes(payrollRun.status)) {
      if (req.user?.role === 'SUPER_ADMIN' && superAdminOverrideReason) {
        console.log(`[SUPER_ADMIN OVERRIDE]: Bypassed payroll lock for actioning regularization. Reason: ${superAdminOverrideReason}`);
      } else {
        return res.status(400).json({ error: 'Payroll period locked. Regularization not permitted for this period.' });
      }
    }

    // If APPROVED, update/recalculate Attendance record and preserve original punches
    const localDayString = format(zonedDate, 'yyyy-MM-dd', { timeZone: timezone });
    const targetDate = fromZonedTime(`${localDayString}T00:00:00`, timezone);
    if (status === 'APPROVED') {

      // Find or create attendance record
      const attendance = await prisma.attendance.findFirst({
        where: {
          employeeId: request.employeeId,
          date: targetDate,
        },
      });

      let checkIn = request.checkInCorrection || (attendance ? attendance.checkIn : null);
      let checkOut = request.checkOutCorrection || (attendance ? attendance.checkOut : null);
      let attStatus = request.statusCorrection || (attendance ? attendance.status : 'PRESENT');
      
      let workHours = null;
      if (checkIn && checkOut) {
        workHours = Math.round(((new Date(checkOut) - new Date(checkIn)) / 3600000) * 100) / 100;
      }

      // Late minutes recalculation
      let lateMinutes = 0;
      const activeAssignment = await prisma.shiftAssignment.findFirst({
        where: {
          employeeId: request.employeeId,
          startDate: { lte: targetDate },
          OR: [{ endDate: null }, { endDate: { gte: targetDate } }],
        },
        include: { shiftType: true },
      });
      const shift = (activeAssignment && activeAssignment.shiftType) ? activeAssignment.shiftType : { startTime: '09:00', gracePeriod: 15 };

      if (checkIn) {
        const zonedCheckIn = toZonedTime(new Date(checkIn), timezone);
        const localCheckInDayStr = format(zonedCheckIn, 'yyyy-MM-dd', { timeZone: timezone });
        const scheduledLocalStr = `${localCheckInDayStr}T${shift.startTime.padStart(5, '0')}:00`;
        const scheduledUtc = fromZonedTime(scheduledLocalStr, timezone);
        lateMinutes = Math.max(0, Math.round((new Date(checkIn) - scheduledUtc) / 60000));
        const grace = shift.gracePeriod !== undefined ? shift.gracePeriod : 15;
        if (lateMinutes > grace && attStatus === 'PRESENT') {
          attStatus = 'LATE';
        }
      }

      if (attendance) {
        // Preserve original checkIn / checkOut if they have not been preserved already
        const origCheckIn = attendance.originalCheckIn ? attendance.originalCheckIn : attendance.checkIn;
        const origCheckOut = attendance.originalCheckOut ? attendance.originalCheckOut : attendance.checkOut;

        await prisma.attendance.update({
          where: { id: attendance.id },
          data: {
            checkIn: checkIn ? new Date(checkIn) : undefined,
            checkOut: checkOut ? new Date(checkOut) : undefined,
            workHours: workHours || undefined,
            status: attStatus,
            lateMinutes,
            originalCheckIn: origCheckIn,
            originalCheckOut: origCheckOut,
            regularizedBy: req.user?.email || req.user?.id || 'SYSTEM',
            regularizedAt: new Date(),
            regularizationReason: request.reason,
          },
        });
      } else {
        await prisma.attendance.create({
          data: {
            employeeId: request.employeeId,
            date: targetDate,
            checkIn: checkIn ? new Date(checkIn) : null,
            checkOut: checkOut ? new Date(checkOut) : null,
            workHours: workHours || 0,
            status: attStatus,
            lateMinutes,
            markedBy: req.user?.id,
            originalCheckIn: null, // No original punch was on file
            originalCheckOut: null,
            regularizedBy: req.user?.email || req.user?.id || 'SYSTEM',
            regularizedAt: new Date(),
            regularizationReason: request.reason,
          },
        });
      }
    }

    const updatedRequest = await prisma.attendanceRegularization.update({
      where: { id },
      data: {
        status,
        managerRemarks: managerRemarks || null,
        approvedBy: req.user?.email || req.user?.role || 'SYSTEM',
      },
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        userEmail: req.user?.email || req.user?.role || 'SYSTEM',
        action: 'REGULARIZATION_ACTION',
        entity: 'AttendanceRegularization',
        entityId: id,
        oldDetails: JSON.stringify(request),
        newDetails: JSON.stringify(updatedRequest),
      }
    });

    res.json(updatedRequest);
  } catch (error) {
    console.error('[ACTION REGULARIZATION ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  submitRegularization,
  getRegularizations,
  actionRegularization,
};
