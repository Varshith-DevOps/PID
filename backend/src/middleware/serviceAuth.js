const timingSafeEqual = (left, right) => {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && require('crypto').timingSafeEqual(a, b);
};

const authenticateService = (req, res, next) => {
  const expected = process.env.HRMS_SERVICE_TOKEN || process.env.AI_RECRUITMENT_SERVICE_TOKEN || '';
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!expected || !timingSafeEqual(token, expected)) {
    return res.status(401).json({ code: 'UNAUTHORIZED_SERVICE', error: 'Unauthorized service request.' });
  }
  next();
};

module.exports = { authenticateService };
