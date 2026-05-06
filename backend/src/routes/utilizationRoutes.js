const express = require('express');
const router = express.Router();
const utilizationController = require('../controllers/utilizationController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/employee', authenticate, authorize('EMPLOYEE', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'), utilizationController.getEmployeeUtilization);
router.get('/all', authenticate, authorize('MANAGER', 'ADMIN', 'SUPER_ADMIN'), utilizationController.getAllEmployeesUtilization);
router.get('/dashboard', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), utilizationController.getDashboardStats);
router.get('/manager/:managerId', authenticate, authorize('MANAGER', 'ADMIN', 'SUPER_ADMIN'), utilizationController.getManagerDashboard);
router.get('/employee/:employeeId', authenticate, authorize('MANAGER', 'ADMIN', 'SUPER_ADMIN'), utilizationController.getEmployeeDashboard);
router.get('/project/:projectId', authenticate, authorize('MANAGER', 'ADMIN', 'SUPER_ADMIN'), utilizationController.getProjectDashboard);
router.get('/resource-allocation', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), utilizationController.getResourceAllocation);

module.exports = router;