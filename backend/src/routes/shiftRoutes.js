/**
 * @fileoverview Shift Types & Rostering routes.
 * @module routes/shiftRoutes
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
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
router.get('/types', getShiftTypes);
router.post('/types', createShiftType);
router.put('/types/:id', updateShiftType);
router.delete('/types/:id', deleteShiftType);

// ──── Shift Assignments Endpoints ──────────────────────────────────────────
router.get('/assignments', getShiftAssignments);
router.post('/assignments', createShiftAssignment);
router.delete('/assignments/:id', deleteShiftAssignment);

// ──── Geofence check-in verification hook ──────────────────────────────────
router.post('/verify-checkin', verifyCheckin);

// ──── Roster & Shift Audit Logs Endpoint ───────────────────────────────────
router.get('/audit-logs', async (req, res) => {
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
