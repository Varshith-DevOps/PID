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
  generatePasskeyRegistrationOptions,
  verifyPasskeyRegistration,
  generatePasskeyAuthenticationOptions,
  verifyPasskeyAuthentication,
  ssoLogin,
  ssoCallback,
  ssoRequestAccess,
} = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../rbac/rbacMiddleware');
const { loginLimiter, registerLimiter, sensitiveLimiter } = require('../middleware/rateLimit');
const { validate } = require('../middleware/validate');
const { loginSchema, changePasswordSchema, resetPasswordSchema } = require('../schemas/authSchemas');
const { signupSchema } = require('../schemas/publicSchemas');

router.post('/login', loginLimiter, validate(loginSchema), login);
router.post('/signup', registerLimiter, validate(signupSchema), signup);
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

// Passkey (WebAuthn) Routes
router.get('/webauthn/register/options', authenticate, generatePasskeyRegistrationOptions);
router.post('/webauthn/register/verify', authenticate, verifyPasskeyRegistration);
router.post('/webauthn/login/options', generatePasskeyAuthenticationOptions);
router.post('/webauthn/login/verify', verifyPasskeyAuthentication);

// SSO Routes
router.post('/sso/login', ssoLogin);
router.post('/sso/callback', ssoCallback);
router.post('/sso/request-access', ssoRequestAccess);

module.exports = router;
