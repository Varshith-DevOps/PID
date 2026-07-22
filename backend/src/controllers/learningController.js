const prisma = require('../config/database');
const { canAccessEmployee, getEmployeeScopeIds, isHr } = require('../services/accessControl');
const learningRepo = require('../services/learningRepository');
const {
  buildCourseData,
  validateAssignmentPayload,
  validateCoursePayload,
  validateMaterialPayload,
} = require('../validators/learningValidators');

const managerRoles = ['SUPER_ADMIN', 'ADMIN', 'HR', 'MANAGER'];
const adminRoles = ['SUPER_ADMIN', 'ADMIN'];

const asDate = (value) => (value ? new Date(value) : null);
const normalize = (value) => String(value || '').trim().toUpperCase();
const isManagerRole = (user) => managerRoles.includes(user?.role);
const isAdminRole = (user) => adminRoles.includes(user?.role);

const getMyEmployee = (user) => prisma.employee.findFirst({ where: { userId: user.id } });

const visibleEnrollmentWhere = async (req, requestedEmployeeId) => {
  const where = {};
  if (requestedEmployeeId) {
    if (!(await canAccessEmployee(req.user, requestedEmployeeId))) {
      const err = new Error('Access denied for requested learning records');
      err.status = 403;
      throw err;
    }
    where.employeeId = requestedEmployeeId;
    return where;
  }

  if (!isHr(req.user)) {
    const employeeIds = await getEmployeeScopeIds(req.user);
    where.employeeId = { in: employeeIds.length ? employeeIds : ['__no_employee_scope__'] };
  }
  return where;
};

const listCourses = async (req, res) => {
  try {
    const { search, category, department, difficulty, status, instructor } = req.query;
    const where = { isActive: true };
    if (status) where.status = normalize(status);
    if (category) where.category = String(category);
    if (department) where.department = String(department);
    if (difficulty) where.difficulty = normalize(difficulty);
    if (instructor) where.instructor = { contains: String(instructor) };
    if (search) {
      const term = String(search);
      where.OR = [
        { title: { contains: term } },
        { courseCode: { contains: term } },
        { instructor: { contains: term } },
        { department: { contains: term } },
        { category: { contains: term } },
      ];
    }
    res.json(await learningRepo.listCourses(where));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const getCourse = async (req, res) => {
  try {
    const course = await learningRepo.getCourse(req.params.id);
    if (!course || !course.isActive) return res.status(404).json({ error: 'Course not found' });
    res.json(course);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const createCourse = async (req, res) => {
  try {
    const errors = validateCoursePayload(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join(', ') });
    const course = await learningRepo.createCourse(buildCourseData(req.body));
    await learningRepo.logLearningAudit({ req, action: 'COURSE_CREATED', entity: 'LearningCourse', entityId: course.id, details: { title: course.title } });
    res.status(201).json(course);
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'Course code already exists' });
    res.status(500).json({ error: 'Server error' });
  }
};

const updateCourse = async (req, res) => {
  try {
    const errors = validateCoursePayload(req.body, true);
    if (errors.length) return res.status(400).json({ error: errors.join(', ') });
    const data = buildCourseData({ ...req.body, title: req.body.title || undefined });
    Object.keys(data).forEach((key) => data[key] === undefined && delete data[key]);
    const course = await learningRepo.updateCourse(req.params.id, data);
    await learningRepo.logLearningAudit({ req, action: 'COURSE_UPDATED', entity: 'LearningCourse', entityId: course.id, details: data });
    res.json(course);
  } catch (error) {
    res.status(error.code === 'P2025' ? 404 : 500).json({ error: error.code === 'P2025' ? 'Course not found' : 'Server error' });
  }
};

const deleteCourse = async (req, res) => {
  try {
    const course = await learningRepo.softDeleteCourse(req.params.id);
    await learningRepo.logLearningAudit({ req, action: 'COURSE_DELETED', entity: 'LearningCourse', entityId: course.id });
    res.json({ success: true });
  } catch (error) {
    res.status(error.code === 'P2025' ? 404 : 500).json({ error: error.code === 'P2025' ? 'Course not found' : 'Server error' });
  }
};

const publishCourse = async (req, res) => {
  try {
    const course = await learningRepo.updateCourse(req.params.id, { status: 'PUBLISHED' });
    await learningRepo.logLearningAudit({ req, action: 'COURSE_PUBLISHED', entity: 'LearningCourse', entityId: course.id });
    res.json(course);
  } catch (error) {
    res.status(error.code === 'P2025' ? 404 : 500).json({ error: error.code === 'P2025' ? 'Course not found' : 'Server error' });
  }
};

const createMaterial = async (req, res) => {
  try {
    const errors = validateMaterialPayload(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join(', ') });
    const uploaded = req.file;
    const material = await learningRepo.createMaterial({
      courseId: req.params.courseId || req.body.courseId,
      title: req.body.title.trim(),
      materialType: normalize(req.body.materialType),
      fileName: uploaded?.originalname || req.body.fileName || null,
      filePath: uploaded ? `learning://${Date.now()}-${uploaded.originalname}` : req.body.filePath || null,
      fileSize: uploaded?.size || (req.body.fileSize ? Number(req.body.fileSize) : null),
      mimeType: uploaded?.mimetype || req.body.mimeType || null,
      externalUrl: req.body.externalUrl || null,
      isDownloadable: req.body.isDownloadable !== false,
      sortOrder: req.body.sortOrder ? Number(req.body.sortOrder) : 0,
    });
    res.status(201).json(material);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const downloadMaterial = async (req, res) => {
  try {
    const material = await prisma.courseMaterial.findUnique({
      where: { id: req.params.id },
      include: { course: true },
    });
    if (!material) return res.status(404).json({ error: 'Material not found' });
    if (!material.isDownloadable) return res.status(403).json({ error: 'This material is not downloadable' });
    if (material.externalUrl) return res.json({ url: material.externalUrl });
    if (!material.filePath) return res.status(404).json({ error: 'Material file is not available' });
    res.setHeader('Content-Disposition', `attachment; filename="${material.fileName || 'learning-material'}"`);
    res.setHeader('Content-Type', material.mimeType || 'application/octet-stream');
    res.send(Buffer.from(`Learning material placeholder\n${material.course.title}\n${material.title}`));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const assignCourse = async (req, res) => {
  try {
    const errors = validateAssignmentPayload(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join(', ') });
    const courseId = req.body.courseId;
    const dueDate = asDate(req.body.dueDate);
    const targetEmployeeIds = new Set(req.body.employeeIds || []);
    if (req.body.employeeId) targetEmployeeIds.add(req.body.employeeId);

    const employeeWhere = { isActive: true };
    if (targetEmployeeIds.size) employeeWhere.id = { in: [...targetEmployeeIds] };
    else if (req.body.department) employeeWhere.department = { name: req.body.department };
    else if (req.body.designation) employeeWhere.jobTitle = req.body.designation;

    const employees = await prisma.employee.findMany({ where: employeeWhere, select: { id: true, firstName: true, lastName: true } });
    if (!employees.length) return res.status(404).json({ error: 'No employees matched the assignment target' });

    if (req.user.role === 'MANAGER') {
      for (const employee of employees) {
        if (!(await canAccessEmployee(req.user, employee.id))) return res.status(403).json({ error: 'Managers can assign only to direct reports' });
      }
    }

    const assignment = await learningRepo.createAssignment({
      courseId,
      assignmentType: req.body.assignmentType || (targetEmployeeIds.size > 1 ? 'MULTIPLE_EMPLOYEES' : targetEmployeeIds.size ? 'EMPLOYEE' : req.body.department ? 'DEPARTMENT' : req.body.designation ? 'DESIGNATION' : 'COMPANY'),
      employeeId: targetEmployeeIds.size === 1 ? [...targetEmployeeIds][0] : null,
      department: req.body.department || null,
      designation: req.body.designation || null,
      dueDate,
      priority: req.body.priority ? normalize(req.body.priority) : 'MEDIUM',
      notifyEmployees: req.body.notifyEmployees !== false,
      assignedBy: req.user.email || req.user.id,
    });

    const enrollments = [];
    for (const employee of employees) {
      const enrollment = await learningRepo.upsertEnrollment({ courseId, employeeId: employee.id, assignmentId: assignment.id, dueDate });
      enrollments.push(enrollment);
      if (assignment.notifyEmployees) {
        await learningRepo.createNotification({
          employeeId: employee.id,
          courseId,
          type: 'COURSE_ASSIGNED',
          title: 'Course assigned',
          message: `${enrollment.course.title} has been assigned to you.`,
        });
      }
    }
    await learningRepo.logLearningAudit({ req, action: 'COURSE_ASSIGNED', entity: 'CourseAssignment', entityId: assignment.id, details: { courseId, count: enrollments.length } });
    res.status(201).json({ assignment, enrollments });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const listEnrollments = async (req, res) => {
  try {
    const where = await visibleEnrollmentWhere(req, req.query.employeeId);
    if (req.query.status) where.status = normalize(req.query.status);
    const enrollments = await learningRepo.listEnrollments(where);
    res.json(enrollments);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Server error' });
  }
};

const updateEnrollment = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, progress, timeSpentMins } = req.body;
    const existing = await prisma.learningEnrollment.findUnique({ where: { id }, include: { course: true, employee: true } });
    if (!existing) return res.status(404).json({ error: 'Enrollment not found' });
    if (!(await canAccessEmployee(req.user, existing.employeeId))) return res.status(403).json({ error: 'Access denied for enrollment' });

    const parsedProgress = progress !== undefined ? Number(progress) : undefined;
    if (parsedProgress !== undefined && (!Number.isFinite(parsedProgress) || parsedProgress < 0 || parsedProgress > 100)) {
      return res.status(400).json({ error: 'Progress must be between 0 and 100' });
    }

    const finalStatus = status ? normalize(status) : (parsedProgress === 100 ? 'COMPLETED' : undefined);
    const updated = await prisma.learningEnrollment.update({
      where: { id },
      data: {
        status: finalStatus,
        progress: parsedProgress,
        timeSpentMins: timeSpentMins !== undefined ? Number(timeSpentMins) : undefined,
        lastAccessedAt: new Date(),
        completedAt: finalStatus === 'COMPLETED' || parsedProgress === 100 ? new Date() : undefined,
      },
      include: { course: true, certificate: true },
    });
    if ((finalStatus === 'COMPLETED' || parsedProgress === 100) && updated.course.certificateAvailable && !updated.certificate) {
      await generateCertificateForEnrollment(req, updated.id);
    }
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const createQuiz = async (req, res) => {
  try {
    const quiz = await prisma.quiz.create({
      data: {
        courseId: req.params.courseId || req.body.courseId,
        title: req.body.title || 'Course Quiz',
        passingMarks: Number(req.body.passingMarks ?? 70),
        timeLimitMins: req.body.timeLimitMins ? Number(req.body.timeLimitMins) : null,
        attemptLimit: Number(req.body.attemptLimit ?? 1),
        randomize: Boolean(req.body.randomize),
        questions: req.body.questions?.length ? {
          create: req.body.questions.map((q, index) => ({
            question: q.question,
            questionType: normalize(q.questionType || 'MULTIPLE_CHOICE'),
            options: Array.isArray(q.options) ? JSON.stringify(q.options) : q.options || null,
            correctAnswer: String(q.correctAnswer),
            marks: Number(q.marks ?? 1),
            sortOrder: index,
          })),
        } : undefined,
      },
      include: { questions: true },
    });
    res.status(201).json(quiz);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const submitQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    const enrollment = await prisma.learningEnrollment.findUnique({ where: { id: req.body.enrollmentId }, include: { employee: true, course: true } });
    if (!enrollment) return res.status(404).json({ error: 'Enrollment not found' });
    if (!(await canAccessEmployee(req.user, enrollment.employeeId))) return res.status(403).json({ error: 'Access denied for quiz attempt' });
    const quiz = await prisma.quiz.findUnique({ where: { id: quizId }, include: { questions: true } });
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
    const previousAttempts = await prisma.quizAttempt.count({ where: { quizId, enrollmentId: enrollment.id } });
    if (previousAttempts >= quiz.attemptLimit) return res.status(400).json({ error: 'Attempt limit reached' });

    const answers = req.body.answers || {};
    const totalMarks = quiz.questions.reduce((sum, question) => sum + question.marks, 0) || 1;
    const score = quiz.questions.reduce((sum, question) => {
      return sum + (String(answers[question.id]) === String(question.correctAnswer) ? question.marks : 0);
    }, 0);
    const percentage = Math.round((score / totalMarks) * 100);
    const passed = percentage >= quiz.passingMarks;
    const attempt = await prisma.quizAttempt.create({
      data: {
        quizId,
        enrollmentId: enrollment.id,
        score,
        percentage,
        attemptNumber: previousAttempts + 1,
        status: passed ? 'PASS' : 'FAIL',
        answers: JSON.stringify(answers),
        completionMins: req.body.completionMins ? Number(req.body.completionMins) : null,
      },
    });
    await learningRepo.logLearningAudit({ req, action: 'QUIZ_SUBMITTED', entity: 'QuizAttempt', entityId: attempt.id, details: { quizId, passed } });
    if (passed) {
      await prisma.learningNotification.create({
        data: { employeeId: enrollment.employeeId, courseId: enrollment.courseId, type: 'QUIZ_PASSED', title: 'Quiz passed', message: `You passed ${quiz.title}.` },
      });
    }
    res.status(201).json(attempt);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const generateCertificateForEnrollment = async (req, enrollmentId) => {
  const enrollment = await prisma.learningEnrollment.findUnique({
    where: { id: enrollmentId },
    include: { course: true, employee: true, certificate: true },
  });
  if (!enrollment) return null;
  if (enrollment.certificate) return enrollment.certificate;
  const cert = await prisma.certificate.create({
    data: {
      courseId: enrollment.courseId,
      employeeId: enrollment.employeeId,
      enrollmentId: enrollment.id,
      certificateNumber: `PID-LRN-${Date.now()}-${enrollment.employee.employeeId}`,
      employeeName: `${enrollment.employee.firstName} ${enrollment.employee.lastName}`,
      courseName: enrollment.course.title,
      completionDate: enrollment.completedAt || new Date(),
      qrCode: `learning:${enrollment.id}`,
      fileUrl: `/api/learning/certificates/${enrollment.id}/download`,
    },
  });
  await learningRepo.createNotification({
    employeeId: enrollment.employeeId,
    courseId: enrollment.courseId,
    type: 'CERTIFICATE_GENERATED',
    title: 'Certificate generated',
    message: `Your certificate for ${enrollment.course.title} is ready.`,
  });
  if (req) await learningRepo.logLearningAudit({ req, action: 'CERTIFICATE_GENERATED', entity: 'Certificate', entityId: cert.id });
  return cert;
};

const generateCertificate = async (req, res) => {
  try {
    const cert = await generateCertificateForEnrollment(req, req.body.enrollmentId || req.params.enrollmentId);
    if (!cert) return res.status(404).json({ error: 'Enrollment not found' });
    res.status(201).json(cert);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const downloadCertificate = async (req, res) => {
  try {
    const cert = await prisma.certificate.findUnique({ where: { id: req.params.id } });
    if (!cert) return res.status(404).json({ error: 'Certificate not found' });
    if (!(await canAccessEmployee(req.user, cert.employeeId))) return res.status(403).json({ error: 'Access denied for certificate' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${cert.certificateNumber}.pdf"`);
    res.send(Buffer.from(`PID HCMS Certificate\n${cert.employeeName}\n${cert.courseName}\n${cert.completionDate.toISOString()}`));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const toggleBookmark = async (req, res) => {
  try {
    const employee = await getMyEmployee(req.user);
    if (!employee) return res.status(404).json({ error: 'Employee profile not found' });
    const where = { employeeId_courseId: { employeeId: employee.id, courseId: req.params.courseId } };
    const existing = await prisma.learningBookmark.findUnique({ where });
    if (existing) {
      await prisma.learningBookmark.delete({ where });
      return res.json({ bookmarked: false });
    }
    await prisma.learningBookmark.create({ data: { employeeId: employee.id, courseId: req.params.courseId } });
    res.status(201).json({ bookmarked: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const getDashboard = async (req, res) => {
  try {
    const enrollmentWhere = await visibleEnrollmentWhere(req, req.query.employeeId);
    const [totalCourses, enrollments, certificates, upcoming, recent] = await Promise.all([
      prisma.learningCourse.count({ where: { isActive: true } }),
      learningRepo.listEnrollments(enrollmentWhere),
      prisma.certificate.count({ where: enrollmentWhere.employeeId ? { employeeId: enrollmentWhere.employeeId } : {} }),
      prisma.learningEnrollment.findMany({ where: { ...enrollmentWhere, dueDate: { gte: new Date() } }, include: { course: true }, take: 5, orderBy: { dueDate: 'asc' } }),
      prisma.learningEnrollment.findMany({ where: enrollmentWhere, include: { course: true }, take: 5, orderBy: { updatedAt: 'desc' } }),
    ]);
    const completed = enrollments.filter((e) => e.status === 'COMPLETED').length;
    res.json({
      totalCourses,
      assignedCourses: enrollments.length,
      completedCourses: completed,
      inProgress: enrollments.filter((e) => e.status === 'IN_PROGRESS').length,
      certificatesEarned: certificates,
      learningHours: Math.round(enrollments.reduce((sum, e) => sum + (e.timeSpentMins || 0), 0) / 60),
      upcomingTraining: upcoming,
      recentLearningActivity: recent,
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Server error' });
  }
};

const getReports = async (req, res) => {
  try {
    if (!isManagerRole(req.user)) return res.status(403).json({ error: 'Role not authorized' });
    const enrollments = await learningRepo.listEnrollments(await visibleEnrollmentWhere(req));
    const byDepartment = {};
    for (const row of enrollments) {
      const dept = row.employee?.department?.name || 'Unassigned';
      byDepartment[dept] = byDepartment[dept] || { assigned: 0, completed: 0 };
      byDepartment[dept].assigned += 1;
      if (row.status === 'COMPLETED') byDepartment[dept].completed += 1;
    }
    res.json({
      courseCompletion: enrollments,
      departmentCompletion: Object.entries(byDepartment).map(([department, data]) => ({ department, ...data })),
      pendingCourses: enrollments.filter((e) => e.status !== 'COMPLETED'),
      topLearners: enrollments.filter((e) => e.status === 'COMPLETED').slice(0, 10),
      exportFormats: ['Excel', 'PDF'],
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Server error' });
  }
};

const getEmployeeLearningSummary = async (req, res) => {
  try {
    const employeeId = req.params.employeeId;
    if (!(await canAccessEmployee(req.user, employeeId))) return res.status(403).json({ error: 'Access denied for requested learning records' });
    const [enrollments, certificates, attempts] = await Promise.all([
      learningRepo.listEnrollments({ employeeId }),
      prisma.certificate.findMany({ where: { employeeId }, include: { course: true }, orderBy: { issuedAt: 'desc' } }),
      prisma.quizAttempt.findMany({ where: { enrollment: { employeeId } }, orderBy: { submittedAt: 'desc' } }),
    ]);
    const completed = enrollments.filter((e) => e.status === 'COMPLETED');
    const avgScore = attempts.length ? Math.round(attempts.reduce((sum, a) => sum + a.percentage, 0) / attempts.length) : 0;
    res.json({
      completedCourses: completed,
      assignedCourses: enrollments,
      certificates,
      learningHours: Math.round(enrollments.reduce((sum, e) => sum + (e.timeSpentMins || 0), 0) / 60),
      averageScore: avgScore,
      recommendations: enrollments.length ? [] : ['Start with mandatory onboarding training', 'Build skills aligned to department goals'],
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  assignCourse,
  createCourse,
  createMaterial,
  downloadMaterial,
  createQuiz,
  deleteCourse,
  downloadCertificate,
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
};
