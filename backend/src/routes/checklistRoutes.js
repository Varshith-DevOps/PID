/**
 * @fileoverview Onboarding & Offboarding Checklist routing.
 * Provides endpoints for templates and instantiated employee tasks.
 * @module routes/checklistRoutes
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getTemplates,
  createTemplate,
  deleteTemplate,
  updateTemplate,
  getEmployeeChecklistTasks,
  instantiateEmployeeChecklist,
  updateEmployeeChecklistTask,
  createCustomChecklistTask,
  completeOnboarding,
  completeOffboarding,
} = require('../controllers/checklistController');

// All routes require authentication
router.use(authenticate);

// ──── Templates CRUD ────────────────────────────────────────────────────────
router.get('/templates', getTemplates);
router.post('/templates', createTemplate);
router.put('/templates/:id', updateTemplate);
router.delete('/templates/:id', deleteTemplate);

// ──── Instantiated Employee Tasks ───────────────────────────────────────────
router.get('/employee/:employeeId', getEmployeeChecklistTasks);
router.post('/employee/:employeeId/instantiate', instantiateEmployeeChecklist);
router.put('/tasks/:taskId', updateEmployeeChecklistTask);
router.post('/tasks', createCustomChecklistTask);

// ──── Stage Transition Automations ──────────────────────────────────────────
router.post('/employee/:employeeId/complete-onboarding', completeOnboarding);
router.post('/employee/:employeeId/complete-offboarding', completeOffboarding);

module.exports = router;
