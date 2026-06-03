/**
 * @fileoverview Shift Types & Rostering scheduler controller.
 * Manages morning/night shifts, shift assignments, and geofencing/IP restricted check-ins.
 * @module controllers/shiftController
 */

const prisma = require('../config/database');

// ==========================================
// 1. Helper: Haversine distance calculator
// ==========================================

/**
 * Calculates the distance in meters between two geolocated coordinates.
 *
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} Distance in meters
 */
const getHaversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
};

// ==========================================
// 2. Shift Types Controller
// ==========================================

const getShiftTypes = async (req, res) => {
  try {
    const types = await prisma.shiftType.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(types);
  } catch (error) {
    console.error('[GET SHIFTS TYPES ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const createShiftType = async (req, res) => {
  try {
    const {
      name,
      code,
      startTime,
      endTime,
      startDay,
      endDay,
      gracePeriod,
      minimumWorkHours,
      isActive,
      weeklyOffs,
      shiftAllowance,
      ipRestricted,
      allowedIpRange,
      geoRestricted,
      allowedLatitude,
      allowedLongitude,
      allowedRadiusMeters,
    } = req.body;

    if (!name || !startTime || !endTime) {
      return res.status(400).json({ error: 'Required parameters missing (name, startTime, endTime)' });
    }

    const type = await prisma.shiftType.create({
      data: {
        name,
        code: code || null,
        startTime,
        endTime,
        startDay: startDay || "Monday",
        endDay: endDay || "Monday",
        gracePeriod: gracePeriod !== undefined ? parseInt(gracePeriod) : 15,
        minimumWorkHours: minimumWorkHours !== undefined ? parseFloat(minimumWorkHours) : 8.0,
        isActive: isActive !== undefined ? !!isActive : true,
        weeklyOffs: weeklyOffs || "Sunday",
        shiftAllowance: shiftAllowance ? parseFloat(shiftAllowance) : 0,
        ipRestricted: !!ipRestricted,
        allowedIpRange: allowedIpRange || null,
        geoRestricted: !!geoRestricted,
        allowedLatitude: allowedLatitude ? parseFloat(allowedLatitude) : null,
        allowedLongitude: allowedLongitude ? parseFloat(allowedLongitude) : null,
        allowedRadiusMeters: allowedRadiusMeters ? parseFloat(allowedRadiusMeters) : 150,
      },
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        userEmail: req.user?.email || req.user?.role || 'SYSTEM',
        action: 'SHIFT_CREATE',
        entity: 'ShiftType',
        entityId: type.id,
        newDetails: JSON.stringify(type),
      }
    });

    res.status(201).json(type);
  } catch (error) {
    console.error('[CREATE SHIFT TYPE ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const updateShiftType = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      code,
      startTime,
      endTime,
      startDay,
      endDay,
      gracePeriod,
      minimumWorkHours,
      isActive,
      weeklyOffs,
      shiftAllowance,
      ipRestricted,
      allowedIpRange,
      geoRestricted,
      allowedLatitude,
      allowedLongitude,
      allowedRadiusMeters,
    } = req.body;

    const existing = await prisma.shiftType.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Shift type not found' });

    const updated = await prisma.shiftType.update({
      where: { id },
      data: {
        name: name || undefined,
        code: code !== undefined ? code : undefined,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        startDay: startDay || undefined,
        endDay: endDay || undefined,
        gracePeriod: gracePeriod !== undefined ? parseInt(gracePeriod) : undefined,
        minimumWorkHours: minimumWorkHours !== undefined ? parseFloat(minimumWorkHours) : undefined,
        isActive: isActive !== undefined ? !!isActive : undefined,
        weeklyOffs: weeklyOffs !== undefined ? weeklyOffs : undefined,
        shiftAllowance: shiftAllowance !== undefined ? parseFloat(shiftAllowance) : undefined,
        ipRestricted: ipRestricted !== undefined ? !!ipRestricted : undefined,
        allowedIpRange: allowedIpRange !== undefined ? allowedIpRange : undefined,
        geoRestricted: geoRestricted !== undefined ? !!geoRestricted : undefined,
        allowedLatitude: allowedLatitude !== undefined ? parseFloat(allowedLatitude) : undefined,
        allowedLongitude: allowedLongitude !== undefined ? parseFloat(allowedLongitude) : undefined,
        allowedRadiusMeters: allowedRadiusMeters !== undefined ? parseFloat(allowedRadiusMeters) : undefined,
      },
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        userEmail: req.user?.email || req.user?.role || 'SYSTEM',
        action: 'SHIFT_UPDATE',
        entity: 'ShiftType',
        entityId: id,
        oldDetails: JSON.stringify(existing),
        newDetails: JSON.stringify(updated),
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('[UPDATE SHIFT TYPE ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const deleteShiftType = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.shiftType.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Shift type not found' });

    await prisma.shiftType.delete({ where: { id } });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        userEmail: req.user?.email || req.user?.role || 'SYSTEM',
        action: 'SHIFT_DELETE',
        entity: 'ShiftType',
        entityId: id,
        oldDetails: JSON.stringify(existing),
      }
    });

    res.json({ message: 'Shift type deleted successfully' });
  } catch (error) {
    console.error('[DELETE SHIFT TYPE ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// ==========================================
// 3. Shift Assignments / Rostering
// ==========================================

const getShiftAssignments = async (req, res) => {
  try {
    const { employeeId } = req.query;
    const filter = {};

    // Manager role-based filter setup
    const loggedInEmp = await prisma.employee.findUnique({ where: { userId: req.user.id } });

    if (employeeId) {
      filter.employeeId = employeeId;
      
      // If MANAGER, make sure the target employee is a direct subordinate
      if (req.user.role === 'MANAGER' && loggedInEmp) {
        const targetEmp = await prisma.employee.findUnique({ where: { id: employeeId } });
        if (targetEmp && targetEmp.managerId !== loggedInEmp.id && targetEmp.id !== loggedInEmp.id) {
          return res.status(403).json({ error: 'Access Denied: Managers can only view assignments of direct subordinates.' });
        }
      }
    } else if (req.user.role === 'MANAGER' && loggedInEmp) {
      // Fetch direct subordinates assignments + manager's own assignments
      const subordinates = await prisma.employee.findMany({
        where: { managerId: loggedInEmp.id },
        select: { id: true },
      });
      const ids = [...subordinates.map(s => s.id), loggedInEmp.id];
      filter.employeeId = { in: ids };
    } else if (req.user.role !== 'ADMIN' && req.user.role !== 'HR' && req.user.role !== 'SUPER_ADMIN') {
      filter.employeeId = loggedInEmp ? loggedInEmp.id : 'none';
    }

    const assignments = await prisma.shiftAssignment.findMany({
      where: filter,
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            jobTitle: true,
            gender: true,
            location: true,
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        shiftType: true,
        previousShiftType: true,
      },
      orderBy: { startDate: 'desc' },
    });

    res.json(assignments);
  } catch (error) {
    console.error('[GET ASSIGNMENTS ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const createShiftAssignment = async (req, res) => {
  try {
    const {
      employeeId,
      shiftTypeId,
      startDate,
      endDate,
      changeReason,
      womenSafetyConfirmed,
      transportAssigned,
      escortVendor,
      approvalReference
    } = req.body;

    if (!employeeId || !startDate) {
      return res.status(400).json({ error: 'Required fields missing (employeeId, startDate)' });
    }

    // 1. Authorization: Manager can only change shifts of direct subordinates
    if (req.user.role !== 'ADMIN' && req.user.role !== 'HR' && req.user.role !== 'SUPER_ADMIN') {
      const loggedInEmp = await prisma.employee.findUnique({ where: { userId: req.user.id } });
      if (!loggedInEmp) {
        return res.status(403).json({ error: 'Forbidden: Logged-in user has no associated Employee profile.' });
      }

      const targetEmp = await prisma.employee.findUnique({ where: { id: employeeId } });
      if (!targetEmp || targetEmp.managerId !== loggedInEmp.id) {
        return res.status(403).json({ error: 'Forbidden: Managers can only assign shifts to direct subordinates.' });
      }
    }

    const startDateTime = new Date(startDate);
    startDateTime.setHours(0, 0, 0, 0);

    const endDateTime = endDate ? new Date(endDate) : null;
    if (endDateTime) {
      endDateTime.setHours(23, 59, 59, 999);
    }

    const existing = await prisma.shiftAssignment.findFirst({
      where: {
        employeeId,
        startDate: startDateTime,
      },
    });

    // Get previous shift type id
    const activeAssignment = await prisma.shiftAssignment.findFirst({
      where: {
        employeeId,
        startDate: { lte: startDateTime },
      },
      orderBy: { startDate: 'desc' },
    });
    const previousShiftTypeId = activeAssignment ? activeAssignment.shiftTypeId : null;

    // 2. 1-Click Toggle: If shiftTypeId is empty, null, or 'GENERAL', delete any custom assignment for that date to revert to General
    if (shiftTypeId === '' || shiftTypeId === null || shiftTypeId === 'GENERAL') {
      await prisma.shiftAssignment.deleteMany({
        where: {
          employeeId,
          startDate: startDateTime,
        },
      });

      // Audit Log
      await prisma.auditLog.create({
        data: {
          userId: req.user?.id,
          userEmail: req.user?.email || req.user?.role || 'SYSTEM',
          action: 'SHIFT_ASSIGN',
          entity: 'ShiftAssignment',
          entityId: employeeId,
          oldDetails: previousShiftTypeId,
          newDetails: 'GENERAL',
          ipAddress: req.ip || req.headers?.['x-forwarded-for'] || '127.0.0.1',
        }
      });

      return res.json({ message: 'Shift successfully reset to standard General Shift.' });
    }

    const targetShift = await prisma.shiftType.findUnique({ where: { id: shiftTypeId } });
    if (!targetShift) return res.status(404).json({ error: 'Shift type not found' });

    const targetEmp = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!targetEmp) return res.status(404).json({ error: 'Employee not found' });

    // 3. Women Night Shift Safety Compliance (7 PM to 6 AM)
    const isNightHour = (timeStr) => {
      const [h] = timeStr.split(':').map(Number);
      return h >= 19 || h < 6;
    };
    const isNightShift = isNightHour(targetShift.startTime) || isNightHour(targetShift.endTime);

    if (targetEmp.gender?.toUpperCase() === 'FEMALE' && isNightShift) {
      if (!womenSafetyConfirmed || !transportAssigned || !escortVendor) {
        return res.status(400).json({
          error: 'Women Night Shift Safety Violation: Night shifts for women require safety confirmation, transport assigned, and escort details.'
        });
      }
      if (!targetEmp.emergencyContactPhone || !targetEmp.emergencyContactName) {
        return res.status(400).json({
          error: 'Women Night Shift Safety Violation: Emergency contact info missing on employee profile.'
        });
      }
    }

    // 4. Overlap Check
    const overlapping = await prisma.shiftAssignment.findMany({
      where: {
        employeeId,
        id: existing ? { not: existing.id } : undefined,
        OR: [
          {
            startDate: { lte: endDateTime || new Date('9999-12-31T23:59:59') },
            endDate: { gte: startDateTime }
          },
          {
            startDate: { lte: endDateTime || new Date('9999-12-31T23:59:59') },
            endDate: null
          }
        ]
      }
    });

    if (overlapping.length > 0) {
      return res.status(400).json({ error: 'Roster Overlap: Employee already has an active shift assignment during this period.' });
    }

    // 5. 11-Hour Minimum Rest Period Check between consecutive days
    const prevDay = new Date(startDateTime);
    prevDay.setDate(prevDay.getDate() - 1);
    const nextDay = new Date(startDateTime);
    nextDay.setDate(nextDay.getDate() + 1);

    const adjacentAssignments = await prisma.shiftAssignment.findMany({
      where: {
        employeeId,
        startDate: { in: [prevDay, nextDay] }
      },
      include: { shiftType: true }
    });

    for (const adj of adjacentAssignments) {
      const isPrev = adj.startDate.getTime() === prevDay.getTime();
      const shift1 = isPrev ? adj.shiftType : targetShift;
      const shift2 = isPrev ? targetShift : adj.shiftType;

      const [h1, m1] = shift1.endTime.split(':').map(Number);
      const [h2, m2] = shift2.startTime.split(':').map(Number);

      const s1EndMin = h1 * 60 + m1 + (h1 < 12 ? 24 * 60 : 0);
      const s2StartMin = 24 * 60 + h2 * 60 + m2;
      const restMinutes = s2StartMin - s1EndMin;

      if (restMinutes < 11 * 60) {
        return res.status(400).json({
          error: `Rest Period Violation: Minimum 11 hours of rest required between shifts. Currently: ${Math.round(restMinutes / 60)} hours.`
        });
      }
    }

    // 6. Upsert Assignment
    let assignment;
    if (existing) {
      assignment = await prisma.shiftAssignment.update({
        where: { id: existing.id },
        data: {
          shiftTypeId,
          previousShiftTypeId,
          changeReason: changeReason || null,
          changedBy: req.user?.email || req.user?.role || 'SYSTEM',
          endDate: endDateTime,
          womenSafetyConfirmed: womenSafetyConfirmed || false,
          transportAssigned: transportAssigned || false,
          escortVendor: escortVendor || null,
          approvalReference: approvalReference || null
        },
      });
    } else {
      assignment = await prisma.shiftAssignment.create({
        data: {
          employeeId,
          shiftTypeId,
          previousShiftTypeId,
          changeReason: changeReason || null,
          changedBy: req.user?.email || req.user?.role || 'SYSTEM',
          startDate: startDateTime,
          endDate: endDateTime,
          womenSafetyConfirmed: womenSafetyConfirmed || false,
          transportAssigned: transportAssigned || false,
          escortVendor: escortVendor || null,
          approvalReference: approvalReference || null
        },
      });
    }

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        userEmail: req.user?.email || req.user?.role || 'SYSTEM',
        action: 'SHIFT_ASSIGN',
        entity: 'ShiftAssignment',
        entityId: employeeId,
        oldDetails: previousShiftTypeId,
        newDetails: shiftTypeId,
        ipAddress: req.ip || req.headers?.['x-forwarded-for'] || '127.0.0.1',
      }
    });

    res.status(201).json(assignment);
  } catch (error) {
    console.error('[CREATE/UPSERT ASSIGNMENT ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const deleteShiftAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.shiftAssignment.delete({ where: { id } });
    res.json({ message: 'Roster assignment removed successfully' });
  } catch (error) {
    console.error('[DELETE ASSIGNMENT ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// ==========================================
// 4. Geofencing & IP Check-in Verification
// ==========================================

const verifyCheckin = async (req, res) => {
  try {
    const { latitude, longitude, clientIp } = req.body;
    const employeeId = req.user.employeeId;

    // 1. Fetch active shift assignment for today
    const now = new Date();
    const activeAssignment = await prisma.shiftAssignment.findFirst({
      where: {
        employeeId,
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      include: { shiftType: true },
    });

    if (!activeAssignment) {
      // If no custom shift assigned, default standard allowance without geofencing rules
      return res.json({ allowed: true, reason: 'Standard General Shift assigned. Check-in accepted.' });
    }

    const shift = activeAssignment.shiftType;

    // 2. IP Restriction Check
    if (shift.ipRestricted && shift.allowedIpRange) {
      const ip = clientIp || req.ip || req.headers['x-forwarded-for'];
      // Simple exact match or partial match check
      if (ip && !ip.includes(shift.allowedIpRange)) {
        return res.status(403).json({
          allowed: false,
          reason: `IP Restriction: Check-in failed. Connected IP: ${ip} is outside allowed range (${shift.allowedIpRange}).`,
        });
      }
    }

    // 3. Geofencing Coordinates Check (using Haversine)
    if (shift.geoRestricted && shift.allowedLatitude && shift.allowedLongitude) {
      if (latitude === undefined || longitude === undefined) {
        return res.status(400).json({
          allowed: false,
          reason: 'Geofence Restriction: Your device coordinates are required to verify location boundaries.',
        });
      }

      const distance = getHaversineDistance(
        parseFloat(latitude),
        parseFloat(longitude),
        shift.allowedLatitude,
        shift.allowedLongitude
      );

      const radiusLimit = shift.allowedRadiusMeters || 150;

      if (distance > radiusLimit) {
        return res.status(403).json({
          allowed: false,
          reason: `Geofence boundary mismatch: You are currently ${Math.round(distance)}m away from active site geofence. Allowable boundary: ${radiusLimit}m.`,
        });
      }
    }

    res.json({
      allowed: true,
      reason: `Verification passed! Roster: "${shift.name}" (${shift.startTime}-${shift.endTime}). Shift Allowance applied: INR ${shift.shiftAllowance}.`,
    });
  } catch (error) {
    console.error('[VERIFY CHECKIN ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getShiftTypes,
  createShiftType,
  updateShiftType,
  deleteShiftType,
  getShiftAssignments,
  createShiftAssignment,
  deleteShiftAssignment,
  verifyCheckin,
};
