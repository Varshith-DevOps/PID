const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { rbacMiddleware, requireRole } = require('../rbac/rbacMiddleware');
const {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  addExpense,
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  getProjectBoard,
  moveTask,
  getProjectCosting,
  setResourceRate,
} = require('../controllers/projectController');
const {
  createSprint,
  getSprints,
  updateSprint,
  assignTaskToSprint,
  getBurndown,
} = require('../controllers/sprintController');

router.get('/tasks/all', authenticate, rbacMiddleware('PROJECTS', 'VIEW'), getTasks);
router.post('/tasks', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), rbacMiddleware('PROJECTS', 'CREATE'), createTask);
router.put('/tasks/:id/move', authenticate, rbacMiddleware('PROJECTS', 'EDIT'), moveTask);
router.put('/tasks/:id/sprint', authenticate, rbacMiddleware('PROJECTS', 'EDIT'), assignTaskToSprint);
router.put('/tasks/:id', authenticate, rbacMiddleware('PROJECTS', 'EDIT'), updateTask);

// ─── Sprints + burndown ───────────────────────────────────────────────────────
router.get('/sprints/:id/burndown', authenticate, rbacMiddleware('PROJECTS', 'VIEW'), getBurndown);
router.put('/sprints/:id', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), rbacMiddleware('PROJECTS', 'EDIT'), updateSprint);
router.get('/:projectId/sprints', authenticate, rbacMiddleware('PROJECTS', 'VIEW'), getSprints);
router.post('/:projectId/sprints', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), rbacMiddleware('PROJECTS', 'CREATE'), createSprint);
router.delete('/tasks/:id', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), rbacMiddleware('PROJECTS', 'DELETE'), deleteTask);

router.get('/', authenticate, rbacMiddleware('PROJECTS', 'VIEW'), getProjects);
router.get('/:id/board', authenticate, rbacMiddleware('PROJECTS', 'VIEW'), getProjectBoard);
router.get('/:id/costing', authenticate, rbacMiddleware('PROJECTS', 'VIEW'), getProjectCosting);
router.put('/:projectId/resource-rate', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), rbacMiddleware('PROJECTS', 'EDIT'), setResourceRate);
router.get('/:id', authenticate, rbacMiddleware('PROJECTS', 'VIEW'), getProjectById);
router.post('/', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), rbacMiddleware('PROJECTS', 'CREATE'), createProject);
router.put('/:id', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), rbacMiddleware('PROJECTS', 'EDIT'), updateProject);
router.delete('/:id', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), rbacMiddleware('PROJECTS', 'DELETE'), deleteProject);

router.post('/:projectId/expenses', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), rbacMiddleware('PROJECTS', 'EDIT'), addExpense);

module.exports = router;
