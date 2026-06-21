const express = require('express');
const router = express.Router();
const {
  login,
  register,
  signup,
  getProfile,
  changePassword,
  resetPasswordForUser,
  setupMfa,
  enableMfa,
  disableMfa,
  verifyMfaLogin,
  getCsrfToken,
  logout,
  refresh,
} = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../rbac/rbacMiddleware');
const { loginLimiter, registerLimiter, sensitiveLimiter } = require('../middleware/rateLimit');
const { validate } = require('../middleware/validate');
const { loginSchema, changePasswordSchema, resetPasswordSchema } = require('../schemas/authSchemas');

router.post('/login', loginLimiter, validate(loginSchema), login);
router.post('/signup', registerLimiter, signup);
router.post('/mfa/verify-login', loginLimiter, verifyMfaLogin);
router.post('/refresh', loginLimiter, refresh);
router.post('/register', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), registerLimiter, register);
router.get('/profile', authenticate, getProfile);
router.get('/csrf-token', authenticate, getCsrfToken);
router.post('/logout', authenticate, logout);
router.put('/change-password', authenticate, sensitiveLimiter, validate(changePasswordSchema), changePassword);
router.put('/reset-password/:userId', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), sensitiveLimiter, validate(resetPasswordSchema), resetPasswordForUser);
router.post('/mfa/setup', authenticate, sensitiveLimiter, setupMfa);
router.post('/mfa/enable', authenticate, sensitiveLimiter, enableMfa);
router.post('/mfa/disable', authenticate, sensitiveLimiter, disableMfa);

module.exports = router;
