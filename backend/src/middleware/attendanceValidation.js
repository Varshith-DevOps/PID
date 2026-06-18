const prisma = require('../config/database');
const crypto = require('crypto');

/**
 * Calculates the distance in meters between two geolocated coordinates using the Haversine formula.
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

/**
 * Centrally validates check-in, check-out, and sync request payloads.
 */
const validateAttendancePunch = async (req, res, next) => {
  try {
    const {
      employeeId,
      latitude,
      longitude,
      clientIp,
      isMockedLocation,
      vpnActive,
      rootedDevice,
      developerModeEnabled,
      timestamp,
      signature,
      deviceId
    } = req.body;

    // 1. Employee ID validation
    if (!employeeId) {
      return res.status(400).json({ error: 'Missing employeeId in request body.' });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { department: true }
    });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    if (!employee.isActive) {
      return res.status(403).json({ error: 'Forbidden: Employee profile is inactive.' });
    }

    // Verify ownership: Non-admin/non-manager roles can only punch for themselves
    if (req.user?.role !== 'SUPER_ADMIN' && req.user?.role !== 'ADMIN' && req.user?.role !== 'MANAGER') {
      if (employee.userId !== req.user.id) {
        return res.status(403).json({ error: 'Forbidden: You cannot punch attendance for another employee.' });
      }
    }

    // 2. Replay attack prevention: Timestamp nonce validation (within 2 minutes)
    if (!timestamp) {
      return res.status(400).json({ error: 'Security: Missing request timestamp.' });
    }
    const requestTime = new Date(timestamp).getTime();
    const serverTime = Date.now();
    if (isNaN(requestTime) || Math.abs(serverTime - requestTime) > 2 * 60 * 1000) {
      return res.status(400).json({ error: 'Security: Request timestamp has expired or is invalid (stale request).' });
    }

    // 3. Signed mobile request validation (HMAC SHA-256)
    if (req.headers['x-client-type'] === 'mobile') {
      if (!signature || !deviceId) {
        return res.status(400).json({ error: 'Security: Signed mobile requests require device ID and signature.' });
      }
      const secret = process.env.MOBILE_APP_SECRET || 'pid-hcms-secret-key-123';
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${employeeId}:${timestamp}:${deviceId}`)
        .digest('hex');

      if (signature !== expectedSignature) {
        return res.status(403).json({ error: 'Security: Request signature mismatch (possible tampering).' });
      }
    }

    // 4. Device Integrity and Geo-spoof check
    if (isMockedLocation === true || isMockedLocation === 'true') {
      return res.status(403).json({ error: 'Fraud Alert: Mock location coordinates detected and rejected.' });
    }
    if (vpnActive === true || vpnActive === 'true') {
      return res.status(403).json({ error: 'Fraud Alert: Active VPN connection detected and rejected.' });
    }
    if (rootedDevice === true || rootedDevice === 'true') {
      return res.status(403).json({ error: 'Security: Operations blocked on rooted/jailbroken devices.' });
    }

    // 5. Fetch shift assignments for today
    const now = new Date(requestTime);
    now.setHours(0, 0, 0, 0);

    const activeAssignment = await prisma.shiftAssignment.findFirst({
      where: {
        employeeId,
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      include: { shiftType: true },
    });

    // Default to Standard General Shift if no assignment is resolved
    const shift = activeAssignment ? activeAssignment.shiftType : {
      name: 'General Shift',
      startTime: '09:00',
      endTime: '18:00',
      gracePeriod: 15,
      ipRestricted: false,
      geoRestricted: false
    };

    // 6. IP Restriction Validation
    if (shift.ipRestricted && shift.allowedIpRange) {
      const ip = clientIp || req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
      if (!ip.includes(shift.allowedIpRange)) {
        return res.status(403).json({
          error: `IP Restriction: Check-in IP ${ip} falls outside permitted range (${shift.allowedIpRange}).`
        });
      }
    }

    // 7. Geofencing Coordinates Validation
    if (shift.geoRestricted) {
      if (latitude === undefined || longitude === undefined) {
        return res.status(400).json({ error: 'Geofence Restriction: Coordinates required for geo-restricted shift.' });
      }
      const distance = getHaversineDistance(
        parseFloat(latitude),
        parseFloat(longitude),
        shift.allowedLatitude || 0.0,
        shift.allowedLongitude || 0.0
      );
      const radiusLimit = shift.allowedRadiusMeters || 150;
      if (distance > radiusLimit) {
        return res.status(403).json({
          error: `Geofence Restriction: You are ${Math.round(distance)}m away from site. Allowable radius: ${radiusLimit}m.`
        });
      }
    }

    // Attach validated details to request context for downstream controllers
    req.attendanceContext = { employee, shift, requestTime };
    next();
  } catch (error) {
    console.error('[ATTENDANCE VALIDATION ERROR]:', error.message);
    res.status(500).json({ error: 'Server error during attendance punch validation.' });
  }
};

module.exports = {
  validateAttendancePunch
};
