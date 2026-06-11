/**
 * @fileoverview Shift Types & Rostering routes.
 * @module routes/shiftRoutes
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { rbacMiddleware, requireRole } = require('../rbac/rbacMiddleware');
const {
  getShiftTypes,
  createShiftType,
  updateShiftType,
  deleteShiftType,
  getShiftAssignments,
  createShiftAssignment,
  deleteShiftAssignment,
  verifyCheckin,
} = require('../controllers/shiftController');

// All shift management routes require authentication
router.use(authenticate);

// ──── Shift Types Endpoints ───────────────────────────────────────────────
router.get('/types', rbacMiddleware('ATTENDANCE', 'VIEW'), getShiftTypes);
router.post('/types', requireRole('SUPER_ADMIN', 'ADMIN', 'HR'), rbacMiddleware('ATTENDANCE', 'CREATE'), createShiftType);
router.put('/types/:id', requireRole('SUPER_ADMIN', 'ADMIN', 'HR'), rbacMiddleware('ATTENDANCE', 'EDIT'), updateShiftType);
router.delete('/types/:id', requireRole('SUPER_ADMIN', 'ADMIN'), rbacMiddleware('ATTENDANCE', 'DELETE'), deleteShiftType);

// ──── Shift Assignments Endpoints ──────────────────────────────────────────
router.get('/assignments', rbacMiddleware('ATTENDANCE', 'VIEW'), getShiftAssignments);
router.post('/assignments', requireRole('SUPER_ADMIN', 'ADMIN', 'HR', 'MANAGER'), rbacMiddleware('ATTENDANCE', 'EDIT'), createShiftAssignment);
router.delete('/assignments/:id', requireRole('SUPER_ADMIN', 'ADMIN', 'HR'), rbacMiddleware('ATTENDANCE', 'DELETE'), deleteShiftAssignment);

// ──── Geofence check-in verification hook ──────────────────────────────────
router.post('/verify-checkin', rbacMiddleware('ATTENDANCE', 'CREATE'), verifyCheckin);

// ──── Roster & Shift Audit Logs Endpoint ───────────────────────────────────
router.get('/audit-logs', requireRole('SUPER_ADMIN', 'ADMIN', 'HR'), rbacMiddleware('ATTENDANCE', 'VIEW'), async (req, res) => {
  try {
    const logs = await require('../config/database').auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
