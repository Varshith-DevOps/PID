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
const { auditPayrollMiddleware } = require('./middleware/auditMiddleware');
const { securityHeaders } = require('./middleware/securityHeaders');

const app = express();

// ──── Global Middleware ────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : 'http://localhost:3000',
  credentials: true
}));
app.use(cookieParser());
app.use(securityHeaders);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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

/** Health check endpoint for monitoring and load balancers */
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

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
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

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
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`✅ HRMS Backend running on http://localhost:${PORT}`);
    console.log(`📋 Health check: http://localhost:${PORT}/health`);
  });
}
