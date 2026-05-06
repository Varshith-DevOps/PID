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

router.get('/', authenticate, rbacMiddleware('PAYROLL', 'VIEW'), getProjects);
router.get('/:id', authenticate, getProjectById);
router.post('/', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), createProject);
router.put('/:id', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), updateProject);
router.delete('/:id', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), deleteTask);

router.post('/:projectId/expenses', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), addExpense);

router.get('/tasks/all', authenticate, getTasks);
router.post('/tasks', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), createTask);
router.put('/tasks/:id', authenticate, updateTask);
router.delete('/tasks/:id', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), deleteTask);

module.exports = router;