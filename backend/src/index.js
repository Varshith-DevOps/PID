/**
 * @fileoverview Express application entry point.
 * Configures middleware, mounts API routes, and starts the HTTP server.
 * @module index
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');

// ──── Route Imports ────────────────────────────────────────────────────────
const authRoutes = require('./routes/authRoutes');
const permissionRoutes = require('./routes/permissionRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const documentRoutes = require('./routes/documentRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const payrollRoutes = require('./routes/payrollRoutes');
const payslipRoutes = require('./routes/payslipRoutes');
const projectRoutes = require('./routes/projectRoutes');
const timesheetRoutes = require('./routes/timesheetRoutes');
const overtimeRoutes = require('./routes/overtimeRoutes');
const utilizationRoutes = require('./routes/utilizationRoutes');
const recruitmentRoutes = require('./routes/recruitmentRoutes');
const performanceRoutes = require('./routes/performanceRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const shiftRoutes = require('./routes/shiftRoutes');
const regularizationRoutes = require('./routes/regularizationRoutes');
const checklistRoutes = require('./routes/checklistRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const taxRoutes = require('./routes/taxRoutes');
const complianceRoutes = require('./routes/complianceRoutes');
const fnfRoutes = require('./routes/fnfRoutes');
const reportRoutes = require('./routes/reportRoutes');
const assetRoutes = require('./routes/assetRoutes');
const learningRoutes = require('./routes/learningRoutes');
const helpdeskRoutes = require('./routes/helpdeskRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const platformRoutes = require('./routes/platformRoutes');
const billingRoutes = require('./routes/billingRoutes');
const contactRoutes = require('./routes/contactRoutes');
const platformAdminRoutes = require('./routes/platformAdminRoutes');
const aiRoutes = require('./routes/aiRoutes');
const appUpdateRoutes = require('./routes/appUpdateRoutes');
const { auditPayrollMiddleware } = require('./middleware/auditMiddleware');
const { globalLimiter } = require('./middleware/rateLimit');
const { securityHeaders } = require('./middleware/securityHeaders');
const { csrfProtection } = require('./middleware/csrf');
const logger = require('./utils/logger');
const prisma = require('./config/database');
const { initSentry, captureException } = require('./config/sentry');

initSentry();

const app = express();
app.disable('x-powered-by');

// ──── Global Middleware ────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : 'http://localhost:3000',
  credentials: true
}));
app.use(cookieParser());
app.use(securityHeaders);
// Default per-IP rate limit on every route (per-route limiters stack on top).
app.use(globalLimiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
// CSRF guard for cookie-authenticated mutations (Bearer/API requests are exempt).
// Skipped under the integration test runner, which authenticates with the cookie
// value as a token shorthand rather than simulating a real browser; the guard
// logic is covered directly in __tests__/csrf.test.js.
if (process.env.NODE_ENV !== 'test') {
  app.use(csrfProtection);
}

/** Uploaded HR files are deliberately not served statically; use authenticated download APIs. */
app.use(auditPayrollMiddleware);

// ──── API Routes ───────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/payslip', payslipRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/timesheet', timesheetRoutes);
app.use('/api/overtime', overtimeRoutes);
app.use('/api/utilization', utilizationRoutes);
app.use('/api/recruitment', recruitmentRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/regularizations', regularizationRoutes);
app.use('/api/checklists', checklistRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/tax', taxRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/fnf', fnfRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/learning', learningRoutes);
app.use('/api/helpdesk', helpdeskRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/platform', platformRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/platform-admin', platformAdminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/app', appUpdateRoutes);

/** Liveness probe: process is up (no dependency checks). */
app.get('/health/live', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

/**
 * Readiness probe: verifies the database is reachable. Returns 503 when the DB
 * is down so load balancers / orchestrators stop routing traffic to this instance.
 */
const readiness = async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'up', uptime: process.uptime() });
  } catch (err) {
    logger.error('Health check: database unreachable', { error: err.message });
    res.status(503).json({ status: 'degraded', db: 'down' });
  }
};
app.get('/health/ready', readiness);
/** Back-compat default health endpoint now includes the DB check. */
app.get('/health', readiness);

// ──── Global Error Handler (Express 5 pattern) ────────────────────────────
/**
 * Centralized error handler.
 * Express 5 automatically routes rejected promises and thrown errors here.
 * @param {Error} err - The error object
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
app.use((err, req, res, next) => {
  logger.error('Unhandled request error', { method: req.method, path: req.path, error: err.message });
  if (res.statusCode >= 500 || !err.status) captureException(err, { method: req.method, path: req.path });

  // Handle Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large' });
  }

  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  });
});

// Export app for testing
module.exports = app;

if (require.main === module) {
  const { validateStartupSecrets } = require('./config/secrets');
  validateStartupSecrets();

  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, () => {
    console.log(`✅ HRMS Backend running on http://localhost:${PORT}`);
    console.log(`📋 Health check: http://localhost:${PORT}/health`);
  });

  // ──── Crash safety ────────────────────────────────────────────────────────
  // A rejected promise or thrown error outside the request lifecycle must not
  // silently crash (or, worse, leave the process in an undefined state).
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', { error: reason instanceof Error ? reason.message : String(reason) });
    captureException(reason instanceof Error ? reason : new Error(String(reason)), { kind: 'unhandledRejection' });
    // Keep serving; a single bad promise should not take the whole server down.
  });

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { error: err.message, stack: err.stack });
    captureException(err, { kind: 'uncaughtException' });
    // An uncaught exception leaves the process in an unknown state — shut down
    // cleanly so the orchestrator can restart a healthy instance.
    gracefulShutdown('uncaughtException', 1);
  });

  // ──── Graceful shutdown ───────────────────────────────────────────────────
  let shuttingDown = false;
  const gracefulShutdown = (signal, exitCode = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Received ${signal}, shutting down gracefully`);

    // Stop accepting new connections, let in-flight requests finish.
    server.close(async () => {
      try {
        await prisma.$disconnectBase();
      } catch (e) {
        logger.error('Error during Prisma disconnect', { error: e.message });
      }
      logger.info('Shutdown complete');
      process.exit(exitCode);
    });

    // Hard cap so a hung connection can't block shutdown forever.
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(exitCode || 1);
    }, 15000).unref();
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}
