const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { rbacMiddleware, requireRole } = require('../rbac/rbacMiddleware');
const { listCourses, createCourse, assignCourse, listEnrollments, updateEnrollment } = require('../controllers/learningController');

router.use(authenticate);

router.get('/courses', rbacMiddleware('LEARNING', 'VIEW'), listCourses);
router.post('/courses', requireRole('SUPER_ADMIN', 'ADMIN', 'HR'), rbacMiddleware('LEARNING', 'CREATE'), createCourse);
router.get('/enrollments', rbacMiddleware('LEARNING', 'VIEW'), listEnrollments);
router.post('/enrollments', requireRole('SUPER_ADMIN', 'ADMIN', 'HR', 'MANAGER'), rbacMiddleware('LEARNING', 'CREATE'), assignCourse);
router.put('/enrollments/:id', rbacMiddleware('LEARNING', 'EDIT'), updateEnrollment);

module.exports = router;
