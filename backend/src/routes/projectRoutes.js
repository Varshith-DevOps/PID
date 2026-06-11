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
} = require('../controllers/projectController');

router.get('/tasks/all', authenticate, rbacMiddleware('PROJECTS', 'VIEW'), getTasks);
router.post('/tasks', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), rbacMiddleware('PROJECTS', 'CREATE'), createTask);
router.put('/tasks/:id', authenticate, rbacMiddleware('PROJECTS', 'EDIT'), updateTask);
router.delete('/tasks/:id', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), rbacMiddleware('PROJECTS', 'DELETE'), deleteTask);

router.get('/', authenticate, rbacMiddleware('PROJECTS', 'VIEW'), getProjects);
router.get('/:id', authenticate, rbacMiddleware('PROJECTS', 'VIEW'), getProjectById);
router.post('/', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), rbacMiddleware('PROJECTS', 'CREATE'), createProject);
router.put('/:id', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), rbacMiddleware('PROJECTS', 'EDIT'), updateProject);
router.delete('/:id', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), rbacMiddleware('PROJECTS', 'DELETE'), deleteProject);

router.post('/:projectId/expenses', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), rbacMiddleware('PROJECTS', 'EDIT'), addExpense);

module.exports = router;
