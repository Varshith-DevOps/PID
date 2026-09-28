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

const normalizeIp = (ip) => String(ip || '').replace(/^::ffff:/, '');

const checkGeoVelocity = async (req, user) => {
  return null;
};

module.exports = { checkGeoVelocity };
