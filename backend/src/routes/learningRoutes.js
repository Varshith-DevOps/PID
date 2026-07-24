const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { uploadLearningMaterial } = require('../middleware/learningUpload');
const { rbacMiddleware, requireRole } = require('../rbac/rbacMiddleware');
const { getKpiDashboard, createKpi, updateKpi, createKpa, updateKpa, listKpa, listLearningSkills } = require('../controllers/learningKpiController');
const {
  assignCourse,
  archiveChapter,
  archiveLesson,
  createAssessment,
  createChapter,
  createCourse,
  createLearningPath,
  createLesson,
  createMaterial,
  createQuestionBankItem,
  createQuiz,
  deleteCourse,
  downloadCertificate,
  downloadMaterial,
  evaluateAssessment,
  generateCertificate,
  getCourse,
  getDashboard,
  getEmployeeLearningSummary,
  listLearningPaths,
  listQuestionBank,
  listAssessments,
  getReports,
  requestCourseApproval,
  restoreCourseVersion,
  reviewCourseApproval,
  reorderChapters,
  submitAssessment,
  submitCourseFeedback,
  listCourses,
  listEnrollments,
  publishCourse,
  submitQuiz,
  toggleBookmark,
  upsertCourseSkill,
  updateChapter,
  updateCourse,
  updateEnrollment,
  updateLessonProgress,
  updateQuestionBankItem,
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
router.post('/courses/:id/approval-request', requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), rbacMiddleware('LEARNING', 'EDIT'), requestCourseApproval);
router.post('/courses/:id/versions/:versionId/restore', requireRole('SUPER_ADMIN', 'ADMIN'), rbacMiddleware('LEARNING', 'EDIT'), restoreCourseVersion);
router.post('/courses/:courseId/bookmark', rbacMiddleware('LEARNING', 'VIEW'), toggleBookmark);
router.post('/courses/:courseId/feedback', rbacMiddleware('LEARNING', 'EDIT'), submitCourseFeedback);
router.post('/courses/:courseId/skills', requireRole('SUPER_ADMIN', 'ADMIN', 'HR'), rbacMiddleware('LEARNING', 'EDIT'), upsertCourseSkill);
router.get('/question-bank', rbacMiddleware('LEARNING', 'VIEW'), listQuestionBank);
router.post('/question-bank', requireRole('SUPER_ADMIN', 'ADMIN', 'HR', 'MANAGER'), rbacMiddleware('LEARNING', 'CREATE'), createQuestionBankItem);
router.put('/question-bank/:questionId', requireRole('SUPER_ADMIN', 'ADMIN', 'HR', 'MANAGER'), rbacMiddleware('LEARNING', 'EDIT'), updateQuestionBankItem);
router.post('/courses/:courseId/question-bank', requireRole('SUPER_ADMIN', 'ADMIN', 'HR', 'MANAGER'), rbacMiddleware('LEARNING', 'CREATE'), createQuestionBankItem);

router.post('/courses/:courseId/chapters', requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), rbacMiddleware('LEARNING', 'CREATE'), createChapter);
router.put('/chapters/:id', requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), rbacMiddleware('LEARNING', 'EDIT'), updateChapter);
router.patch('/chapters/reorder', requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), rbacMiddleware('LEARNING', 'EDIT'), reorderChapters);
router.delete('/chapters/:id', requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), rbacMiddleware('LEARNING', 'DELETE'), archiveChapter);

router.post('/courses/:courseId/lessons', requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), rbacMiddleware('LEARNING', 'CREATE'), uploadLearningMaterial.single('file'), createLesson);
router.delete('/lessons/:id', requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), rbacMiddleware('LEARNING', 'DELETE'), archiveLesson);
router.put('/lessons/:lessonId/progress', rbacMiddleware('LEARNING', 'EDIT'), updateLessonProgress);

router.post('/courses/:courseId/materials', requireRole('SUPER_ADMIN', 'ADMIN'), rbacMiddleware('LEARNING', 'CREATE'), uploadLearningMaterial.single('file'), createMaterial);
router.post('/materials', requireRole('SUPER_ADMIN', 'ADMIN'), rbacMiddleware('LEARNING', 'CREATE'), uploadLearningMaterial.single('file'), createMaterial);
router.get('/materials/:id/download', rbacMiddleware('LEARNING', 'VIEW'), downloadMaterial);

router.post('/courses/:courseId/quizzes', requireRole('SUPER_ADMIN', 'ADMIN'), rbacMiddleware('LEARNING', 'CREATE'), createQuiz);
router.post('/quizzes', requireRole('SUPER_ADMIN', 'ADMIN'), rbacMiddleware('LEARNING', 'CREATE'), createQuiz);
router.post('/quizzes/:quizId/attempts', rbacMiddleware('LEARNING', 'EDIT'), submitQuiz);
router.post('/courses/:courseId/assessments', requireRole('SUPER_ADMIN', 'ADMIN'), rbacMiddleware('LEARNING', 'CREATE'), createAssessment);
router.get('/assessments', rbacMiddleware('LEARNING', 'VIEW'), listAssessments);
router.post('/assessments/:assessmentId/submissions', rbacMiddleware('LEARNING', 'EDIT'), submitAssessment);
router.put('/assessment-submissions/:submissionId/evaluate', requireRole('SUPER_ADMIN', 'ADMIN', 'HR', 'MANAGER'), rbacMiddleware('LEARNING', 'EDIT'), evaluateAssessment);

router.get('/progress', rbacMiddleware('LEARNING', 'VIEW'), listEnrollments);
router.get('/enrollments', rbacMiddleware('LEARNING', 'VIEW'), listEnrollments);
router.put('/progress/:id', rbacMiddleware('LEARNING', 'EDIT'), updateEnrollment);
router.put('/enrollments/:id', rbacMiddleware('LEARNING', 'EDIT'), updateEnrollment);

router.post('/assignments', requireRole('SUPER_ADMIN', 'ADMIN', 'HR', 'MANAGER'), rbacMiddleware('LEARNING', 'CREATE'), assignCourse);
router.post('/enrollments', requireRole('SUPER_ADMIN', 'ADMIN', 'HR', 'MANAGER'), rbacMiddleware('LEARNING', 'CREATE'), assignCourse);

router.get('/paths', rbacMiddleware('LEARNING', 'VIEW'), listLearningPaths);
router.post('/paths', requireRole('SUPER_ADMIN', 'ADMIN', 'HR', 'MANAGER'), rbacMiddleware('LEARNING', 'CREATE'), createLearningPath);
router.post('/approvals/:approvalId/review', requireRole('SUPER_ADMIN', 'ADMIN'), rbacMiddleware('LEARNING', 'EDIT'), reviewCourseApproval);

router.post('/certificates', requireRole('SUPER_ADMIN', 'ADMIN'), rbacMiddleware('LEARNING', 'CREATE'), generateCertificate);
router.post('/certificates/:enrollmentId/generate', requireRole('SUPER_ADMIN', 'ADMIN'), rbacMiddleware('LEARNING', 'CREATE'), generateCertificate);
router.get('/certificates/:id/download', rbacMiddleware('LEARNING', 'VIEW'), downloadCertificate);

router.get('/reports', requireRole('SUPER_ADMIN', 'ADMIN', 'HR', 'MANAGER'), rbacMiddleware('LEARNING', 'EXPORT'), getReports);
router.get('/employees/:employeeId/summary', rbacMiddleware('LEARNING', 'VIEW'), getEmployeeLearningSummary);

router.get('/kpi-dashboard', rbacMiddleware('LEARNING', 'VIEW'), getKpiDashboard);
router.get('/kpas', rbacMiddleware('LEARNING', 'VIEW'), listKpa);
router.get('/skills', rbacMiddleware('LEARNING', 'VIEW'), listLearningSkills);
router.post('/kpis', requireRole('SUPER_ADMIN', 'ADMIN', 'HR'), rbacMiddleware('LEARNING', 'CREATE'), createKpi);
router.put('/kpis/:id', requireRole('SUPER_ADMIN', 'ADMIN', 'HR'), rbacMiddleware('LEARNING', 'EDIT'), updateKpi);
router.post('/kpas', requireRole('SUPER_ADMIN', 'ADMIN', 'HR'), rbacMiddleware('LEARNING', 'CREATE'), createKpa);
router.put('/kpas/:id', requireRole('SUPER_ADMIN', 'ADMIN', 'HR'), rbacMiddleware('LEARNING', 'EDIT'), updateKpa);

module.exports = router;
