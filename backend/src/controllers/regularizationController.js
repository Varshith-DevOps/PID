const prisma = require('../config/database');

const submitRegularization = async (req, res) => {
  try {
    const {
      date,
      requestType,
      checkInCorrection,
      checkOutCorrection,
      statusCorrection,
      reason,
    } = req.body;

    if (!date || !requestType || !reason) {
      return res.status(400).json({ error: 'Missing required parameters (date, requestType, reason)' });
    }

    const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });
    if (!employee) {
      return res.status(404).json({ error: 'Employee profile not found' });
    }

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

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
    const { status, managerRemarks } = req.body; // 'APPROVED' or 'REJECTED'

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

    // If APPROVED, update/recalculate Attendance record
    if (status === 'APPROVED') {
      const targetDate = new Date(request.date);
      targetDate.setHours(0, 0, 0, 0);

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
      // Get the shift for that date
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
        const [hour, minute] = shift.startTime.split(':').map(Number);
        const scheduledTime = new Date(checkIn);
        scheduledTime.setHours(hour, minute, 0, 0);
        lateMinutes = Math.max(0, Math.round((new Date(checkIn) - scheduledTime) / 60000));
        const grace = shift.gracePeriod !== undefined ? shift.gracePeriod : 15;
        if (lateMinutes > grace && attStatus === 'PRESENT') {
          attStatus = 'LATE';
        }
      }

      if (attendance) {
        await prisma.attendance.update({
          where: { id: attendance.id },
          data: {
            checkIn: checkIn ? new Date(checkIn) : undefined,
            checkOut: checkOut ? new Date(checkOut) : undefined,
            workHours: workHours || undefined,
            status: attStatus,
            lateMinutes,
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
