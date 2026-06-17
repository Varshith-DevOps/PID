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
} = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../rbac/rbacMiddleware');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimit');

router.post('/login', loginLimiter, login);
router.post('/signup', registerLimiter, signup);
router.post('/mfa/verify-login', loginLimiter, verifyMfaLogin);
router.post('/register', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), registerLimiter, register);
router.get('/profile', authenticate, getProfile);
router.put('/change-password', authenticate, changePassword);
router.put('/reset-password/:userId', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), resetPasswordForUser);
router.post('/mfa/setup', authenticate, setupMfa);
router.post('/mfa/enable', authenticate, enableMfa);
router.post('/mfa/disable', authenticate, disableMfa);

module.exports = router;
