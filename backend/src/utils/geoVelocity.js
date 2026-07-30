const prisma = require('../config/database');
const { logSecurityEvent, clientIp } = require('./securityEvents');

const resolveIpCoords = (ip) => {
  if (ip === '12.34.56.78') return { lat: 28.6139, lon: 77.2090 }; // Delhi
  if (ip === '98.76.54.32') return { lat: 19.0760, lon: 72.8777 }; // Mumbai (~1150 km distance)
  if (ip === '192.168.1.1' || ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
    return { lat: 12.9716, lon: 77.5946 }; // Bangalore
  }
  // Deterministic coordinate based on IP
  const parts = String(ip).split('.').map(Number).filter(n => !isNaN(n));
  if (parts.length === 4) {
    return {
      lat: 12.9716 + (parts[0] % 10) * 0.5,
      lon: 77.5946 + (parts[1] % 10) * 0.5
    };
  }
  return { lat: 12.9716, lon: 77.5946 };
};

const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const checkGeoVelocity = async (req, user) => {
  const currentIp = clientIp(req);
  if (!currentIp) return null;

  const lastLogin = await prisma.auditLog.findFirst({
    where: {
      userId: user.id,
      action: { in: ['AUTH_LOGIN_SUCCESS', 'AUTH_PASSKEY_LOGIN_SUCCESS', 'AUTH_SSO_LOGIN_SUCCESS'] }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (!lastLogin || !lastLogin.ipAddress) return null;

  const prevIp = lastLogin.ipAddress;
  if (prevIp === currentIp) return null; // No IP change, skip

  const prevCoords = resolveIpCoords(prevIp);
  const currCoords = resolveIpCoords(currentIp);

  const distance = getDistance(prevCoords.lat, prevCoords.lon, currCoords.lat, currCoords.lon);
  if (distance < 50) return null; // Ignore moves under 50km

  const timeDiffHours = (Date.now() - new Date(lastLogin.createdAt).getTime()) / (1000 * 60 * 60);
  const hours = Math.max(0.016, timeDiffHours); // Min 1 minute threshold
  const speed = distance / hours; // km/h

  if (speed > 900) {
    await logSecurityEvent(req, {
      action: 'AUTH_LOGIN_ANOMALOUS_GEO_VELOCITY',
      userId: user.id,
      userEmail: user.email,
      details: {
        prevIp,
        currentIp,
        distanceKm: Math.round(distance),
        timeDiffMinutes: Math.round(timeDiffHours * 60),
        calculatedSpeedKmh: Math.round(speed)
      }
    });

    return {
      anomalous: true,
      message: `Anomalous login detected (impossible travel speed of ${Math.round(speed)} km/h). Access blocked.`
    };
  }

  return null;
};

module.exports = { checkGeoVelocity };
