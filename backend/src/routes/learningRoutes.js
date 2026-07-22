const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { uploadLearningMaterial } = require('../middleware/learningUpload');
const { rbacMiddleware, requireRole } = require('../rbac/rbacMiddleware');
const {
  assignCourse,
  createCourse,
  createMaterial,
  createQuiz,
  deleteCourse,
  downloadCertificate,
  downloadMaterial,
  generateCertificate,
  getCourse,
  getDashboard,
  getEmployeeLearningSummary,
  getReports,
  listCourses,
  listEnrollments,
  publishCourse,
  submitQuiz,
  toggleBookmark,
  updateCourse,
  updateEnrollment,
} = require('../controllers/learningController');

router.use(authenticate);

router.get('/', rbacMiddleware('LEARNING', 'VIEW'), getDashboard);
router.get('/dashboard', rbacMiddleware('LEARNING', 'VIEW'), getDashboard);

router.get('/courses', rbacMiddleware('LEARNING', 'VIEW'), listCourses);
router.post('/courses', requireRole('SUPER_ADMIN', 'ADMIN'), rbacMiddleware('LEARNING', 'CREATE'), createCourse);
router.get('/courses/:id', rbacMiddleware('LEARNING', 'VIEW'), getCourse);
router.put('/courses/:id', requireRole('SUPER_ADMIN', 'ADMIN'), rbacMiddleware('LEARNING', 'EDIT'), updateCourse);
router.delete('/courses/:id', requireRole('SUPER_ADMIN', 'ADMIN'), rbacMiddleware('LEARNING', 'DELETE'), deleteCourse);
router.post('/courses/:id/publish', requireRole('SUPER_ADMIN', 'ADMIN'), rbacMiddleware('LEARNING', 'EDIT'), publishCourse);
router.post('/courses/:courseId/bookmark', rbacMiddleware('LEARNING', 'VIEW'), toggleBookmark);

router.post('/courses/:courseId/materials', requireRole('SUPER_ADMIN', 'ADMIN'), rbacMiddleware('LEARNING', 'CREATE'), uploadLearningMaterial.single('file'), createMaterial);
router.post('/materials', requireRole('SUPER_ADMIN', 'ADMIN'), rbacMiddleware('LEARNING', 'CREATE'), uploadLearningMaterial.single('file'), createMaterial);
router.get('/materials/:id/download', rbacMiddleware('LEARNING', 'VIEW'), downloadMaterial);

router.post('/courses/:courseId/quizzes', requireRole('SUPER_ADMIN', 'ADMIN'), rbacMiddleware('LEARNING', 'CREATE'), createQuiz);
router.post('/quizzes', requireRole('SUPER_ADMIN', 'ADMIN'), rbacMiddleware('LEARNING', 'CREATE'), createQuiz);
router.post('/quizzes/:quizId/attempts', rbacMiddleware('LEARNING', 'EDIT'), submitQuiz);

router.get('/progress', rbacMiddleware('LEARNING', 'VIEW'), listEnrollments);
router.get('/enrollments', rbacMiddleware('LEARNING', 'VIEW'), listEnrollments);
router.put('/progress/:id', rbacMiddleware('LEARNING', 'EDIT'), updateEnrollment);
router.put('/enrollments/:id', rbacMiddleware('LEARNING', 'EDIT'), updateEnrollment);

router.post('/assignments', requireRole('SUPER_ADMIN', 'ADMIN', 'HR', 'MANAGER'), rbacMiddleware('LEARNING', 'CREATE'), assignCourse);
router.post('/enrollments', requireRole('SUPER_ADMIN', 'ADMIN', 'HR', 'MANAGER'), rbacMiddleware('LEARNING', 'CREATE'), assignCourse);

router.post('/certificates', requireRole('SUPER_ADMIN', 'ADMIN'), rbacMiddleware('LEARNING', 'CREATE'), generateCertificate);
router.post('/certificates/:enrollmentId/generate', requireRole('SUPER_ADMIN', 'ADMIN'), rbacMiddleware('LEARNING', 'CREATE'), generateCertificate);
router.get('/certificates/:id/download', rbacMiddleware('LEARNING', 'VIEW'), downloadCertificate);

router.get('/reports', requireRole('SUPER_ADMIN', 'ADMIN', 'HR', 'MANAGER'), rbacMiddleware('LEARNING', 'EXPORT'), getReports);
router.get('/employees/:employeeId/summary', rbacMiddleware('LEARNING', 'VIEW'), getEmployeeLearningSummary);

module.exports = router;
