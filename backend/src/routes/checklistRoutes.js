/**
 * @fileoverview Onboarding & Offboarding Checklist routing.
 * Provides endpoints for templates and instantiated employee tasks.
 * @module routes/checklistRoutes
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { rbacMiddleware, requireRole } = require('../rbac/rbacMiddleware');
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
router.get('/templates', rbacMiddleware('ONBOARDING', 'VIEW'), getTemplates);
router.post('/templates', requireRole('SUPER_ADMIN', 'ADMIN', 'HR', 'ONBOARDING'), rbacMiddleware('ONBOARDING', 'CREATE'), createTemplate);
router.put('/templates/:id', requireRole('SUPER_ADMIN', 'ADMIN', 'HR', 'ONBOARDING'), rbacMiddleware('ONBOARDING', 'EDIT'), updateTemplate);
router.delete('/templates/:id', requireRole('SUPER_ADMIN', 'ADMIN', 'HR', 'ONBOARDING'), rbacMiddleware('ONBOARDING', 'DELETE'), deleteTemplate);

// ──── Instantiated Employee Tasks ───────────────────────────────────────────
router.get('/employee/:employeeId', rbacMiddleware('ONBOARDING', 'VIEW'), getEmployeeChecklistTasks);
router.post('/employee/:employeeId/instantiate', requireRole('SUPER_ADMIN', 'ADMIN', 'HR', 'ONBOARDING'), rbacMiddleware('ONBOARDING', 'CREATE'), instantiateEmployeeChecklist);
router.put('/tasks/:taskId', rbacMiddleware('ONBOARDING', 'EDIT'), updateEmployeeChecklistTask);
router.post('/tasks', requireRole('SUPER_ADMIN', 'ADMIN', 'HR', 'ONBOARDING'), rbacMiddleware('ONBOARDING', 'CREATE'), createCustomChecklistTask);

// ──── Stage Transition Automations ──────────────────────────────────────────
router.post('/employee/:employeeId/complete-onboarding', requireRole('SUPER_ADMIN', 'ADMIN', 'HR', 'ONBOARDING'), rbacMiddleware('ONBOARDING', 'EDIT'), completeOnboarding);
router.post('/employee/:employeeId/complete-offboarding', requireRole('SUPER_ADMIN', 'ADMIN', 'HR', 'ONBOARDING'), rbacMiddleware('ONBOARDING', 'EDIT'), completeOffboarding);

module.exports = router;
