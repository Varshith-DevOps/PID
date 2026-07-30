const { createClient } = require('redis');
const logger = require('./logger');

let redisClient = null;
const inMemoryBlacklist = new Map(); // token -> expiryTimestamp

const getRedisClient = async () => {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (!redisClient) {
    try {
      redisClient = createClient({ url });
      redisClient.on('error', (e) => logger.warn('Redis error (blacklist)', { error: e.message }));
      await redisClient.connect();
    } catch (e) {
      logger.warn('Failed to connect to Redis for token blacklist, falling back to memory', { error: e.message });
      redisClient = null;
    }
  }
  return redisClient;
};

// Auto-cleanup memory blacklist every 5 minutes
if (process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    const now = Date.now();
    for (const [token, expiry] of inMemoryBlacklist.entries()) {
      if (now > expiry) {
        inMemoryBlacklist.delete(token);
      }
    }
  }, 5 * 60 * 1000).unref();
}

const blacklistToken = async (token, expiresInSeconds) => {
  try {
    const client = await getRedisClient();
    if (client) {
      await client.set(`blacklist:${token}`, '1', {
        EX: Math.max(1, Math.ceil(expiresInSeconds))
      });
    } else {
      const expiry = Date.now() + (expiresInSeconds * 1000);
      inMemoryBlacklist.set(token, expiry);
    }
  } catch (err) {
    logger.warn('Error blacklisting token, falling back to memory', { error: err.message });
    const expiry = Date.now() + (expiresInSeconds * 1000);
    inMemoryBlacklist.set(token, expiry);
  }
};

const isTokenBlacklisted = async (token) => {
  try {
    const client = await getRedisClient();
    if (client) {
      const result = await client.get(`blacklist:${token}`);
      return result === '1';
    } else {
      const expiry = inMemoryBlacklist.get(token);
      if (!expiry) return false;
      if (Date.now() > expiry) {
        inMemoryBlacklist.delete(token);
        return false;
      }
      return true;
    }
  } catch (err) {
    logger.warn('Error checking token blacklist, checking memory', { error: err.message });
    const expiry = inMemoryBlacklist.get(token);
    return expiry && Date.now() <= expiry;
  }
};

module.exports = {
  blacklistToken,
  isTokenBlacklisted
};
