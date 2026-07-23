const prisma = require('../config/database');
const PDFDocument = require('pdfkit');
const crypto = require('crypto');
const { parsePagination } = require('../middleware/validate');
const { canAccessEmployee, getEmployeeScopeIds, isHr } = require('../services/accessControl');
const learningRepo = require('../services/learningRepository');
const {
  buildCourseData,
  validateAssignmentPayload,
  validateChapterPayload,
  validateCoursePayload,
  validateLessonPayload,
  validateMaterialPayload,
  validateQuestionType,
} = require('../validators/learningValidators');

const managerRoles = ['SUPER_ADMIN', 'ADMIN', 'HR', 'MANAGER'];
const adminRoles = ['SUPER_ADMIN', 'ADMIN'];

const asDate = (value) => (value ? new Date(value) : null);
const normalize = (value) => String(value || '').trim().toUpperCase();
const isManagerRole = (user) => managerRoles.includes(user?.role);
const isAdminRole = (user) => adminRoles.includes(user?.role);

const getMyEmployee = (user) => prisma.employee.findFirst({ where: { userId: user.id } });
const clampPercent = (value) => Math.max(0, Math.min(100, Number(value) || 0));
const parseMaybeJson = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};
const safeJson = (value, fallback) => {
  if (value === undefined) return fallback;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
};

const normalizeQuestionType = (type) => {
  const value = normalize(type || 'MCQ');
  if (['MULTIPLE_SELECT', 'MULTIPLE_ANSWER'].includes(value)) return 'MULTIPLE_ANSWER';
  if (['TRUEFALSE', 'TRUE_FALSE', 'BOOLEAN'].includes(value)) return 'TRUE_FALSE';
  if (['ESSAY', 'DESCRIPTIVE'].includes(value)) return 'DESCRIPTIVE';
  if (['SHORT', 'SHORT_ANSWER'].includes(value)) return 'SHORT_ANSWER';
  return value;
};

const isObjectiveQuestion = (type) => ['MCQ', 'MULTIPLE_ANSWER', 'TRUE_FALSE'].includes(normalizeQuestionType(type));

const normalizeAnswer = (answer, type) => {
  if (Array.isArray(answer)) return JSON.stringify(answer.map((item) => String(item).trim()).sort());
  if (normalizeQuestionType(type) === 'TRUE_FALSE') return String(answer).trim().toLowerCase();
  return String(answer ?? '').trim();
};

const buildAssessmentConfig = (payload = {}) => ({
  passingScore: Number(payload.passingScore ?? payload.passingMarks ?? 70),
  timeLimitMins: payload.timeLimitMins !== undefined ? Number(payload.timeLimitMins) : payload.durationMinutes !== undefined ? Number(payload.durationMinutes) : null,
  randomize: Boolean(payload.randomize ?? payload.questionRandomization),
  questions: (payload.questions || []).map((question, index) => ({
    id: question.id || `q${index + 1}`,
    question: question.question || question.text || '',
    questionType: normalizeQuestionType(question.questionType || question.type || 'MCQ'),
    options: Array.isArray(question.options) ? question.options : parseMaybeJson(question.options, []),
    correctAnswer: question.correctAnswer ?? question.answer ?? '',
    marks: Number(question.marks ?? question.points ?? 1),
    sortOrder: Number(question.sortOrder ?? index),
  })),
});

const scoreAssessmentAnswers = (assessment, answers = {}) => {
  const config = parseMaybeJson(assessment.rubricJson, {});
  const questions = Array.isArray(config.questions) ? config.questions : [];
  const totalMarks = questions.reduce((sum, question) => sum + Number(question.marks || 0), 0) || assessment.maxMarks || 100;
  const hasDescriptive = questions.some((question) => !isObjectiveQuestion(question.questionType));
  const objectiveScore = questions.reduce((sum, question, index) => {
    if (!isObjectiveQuestion(question.questionType)) return sum;
    const key = question.id || `q${index + 1}`;
    const submitted = normalizeAnswer(answers[key] ?? answers[index] ?? answers[String(index)], question.questionType);
    const expected = normalizeAnswer(question.correctAnswer, question.questionType);
    return submitted === expected ? sum + Number(question.marks || 0) : sum;
  }, 0);
  const percentage = Math.round((objectiveScore / totalMarks) * 100);
  const passingScore = Number(config.passingScore ?? assessment.course?.passingScore ?? 70);
  return {
    score: objectiveScore,
    totalMarks,
    percentage,
    passed: !hasDescriptive && percentage >= passingScore,
    requiresManualReview: hasDescriptive,
    passingScore,
  };
};

const findEnrollmentForLearningAction = async (req, courseId, enrollmentId) => {
  if (enrollmentId) {
    return prisma.learningEnrollment.findUnique({ where: { id: enrollmentId }, include: { course: true, employee: true, certificate: true } });
  }
  const employee = await getMyEmployee(req.user);
  if (!employee || !courseId) return null;
  return prisma.learningEnrollment.findUnique({
    where: { courseId_employeeId: { courseId, employeeId: employee.id } },
    include: { course: true, employee: true, certificate: true },
  });
};

const recalculateEnrollmentProgress = async (enrollmentId) => {
  const enrollment = await prisma.learningEnrollment.findUnique({ where: { id: enrollmentId } });
  if (!enrollment) return null;
  const [activeLessons, completedLessons] = await Promise.all([
    prisma.learningLesson.count({ where: { courseId: enrollment.courseId, isActive: true } }),
    prisma.learningLessonProgress.count({ where: { enrollmentId, status: 'COMPLETED' } }),
  ]);
  const progress = activeLessons ? Math.floor((completedLessons / activeLessons) * 100) : 100;
  const now = new Date();
  return prisma.learningEnrollment.update({
    where: { id: enrollmentId },
    data: {
      progress,
      status: progress >= 100 ? 'COMPLETED' : progress > 0 ? 'IN_PROGRESS' : 'ASSIGNED',
      completedAt: progress >= 100 ? (enrollment.completedAt || now) : null,
      lastAccessedAt: now,
    },
    include: { course: true, employee: true, certificate: true },
  });
};

const hasPassedAssessment = async (enrollment) => {
  const [assessments, passedQuiz, submissions] = await Promise.all([
    prisma.learningAssessment.count({ where: { courseId: enrollment.courseId, status: 'ACTIVE' } }),
    prisma.quizAttempt.findFirst({
      where: { enrollmentId: enrollment.id, status: { in: ['PASS', 'PASSED'] } },
      orderBy: { submittedAt: 'desc' },
    }),
    prisma.learningAssessmentSubmission.findMany({
      where: { enrollmentId: enrollment.id },
      include: { assessment: { include: { course: true } } },
      orderBy: { submittedAt: 'desc' },
    }),
  ]);
  const passedSubmission = submissions.find((submission) => {
    if (['PASS', 'PASSED'].includes(normalize(submission.status))) return true;
    if (!['EVALUATED', 'REVIEWED'].includes(normalize(submission.status)) || submission.marks === null || submission.marks === undefined) return false;
    const config = parseMaybeJson(submission.assessment?.rubricJson, {});
    const maxMarks = submission.assessment?.maxMarks || 100;
    const percentage = Math.round((Number(submission.marks) / maxMarks) * 100);
    return percentage >= Number(config.passingScore ?? submission.assessment?.course?.passingScore ?? 70);
  });
  return {
    passed: Boolean(passedSubmission || (assessments === 0 && passedQuiz)),
    source: passedSubmission || passedQuiz || null,
    assessmentCount: assessments,
  };
};

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
    const { search, category, department, difficulty, status, instructor, sortBy, sortOrder } = req.query;
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
    const validSorts = new Set(['createdAt', 'updatedAt', 'title', 'durationMinutes', 'difficulty', 'status']);
    const direction = String(sortOrder || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
    const orderBy = validSorts.has(String(sortBy)) ? { [sortBy]: direction } : { createdAt: 'desc' };
    const paged = req.query.page !== undefined || req.query.limit !== undefined;
    const pagination = parsePagination(req.query);
    const [courses, total] = await Promise.all([
      learningRepo.listCourses(where, paged ? { orderBy, skip: pagination.skip, take: pagination.limit } : { orderBy }),
      paged ? learningRepo.countCourses(where) : Promise.resolve(undefined),
    ]);
    if (paged) return res.json({ courses, total, page: pagination.page, limit: pagination.limit });
    res.json(courses);
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
    await learningRepo.snapshotCourse({ courseId: course.id, changeSummary: 'Initial draft', createdBy: req.user.email || req.user.id, companyId: req.user.companyId });
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
    await learningRepo.snapshotCourse({ courseId: course.id, changeSummary: req.body.changeSummary || 'Course updated', createdBy: req.user.email || req.user.id, companyId: req.user.companyId });
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

const createChapter = async (req, res) => {
  try {
    const errors = validateChapterPayload(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join(', ') });
    const chapter = await prisma.learningChapter.create({
      data: {
        companyId: req.user.companyId,
        courseId: req.params.courseId || req.body.courseId,
        title: req.body.title.trim(),
        description: req.body.description || null,
        sortOrder: req.body.sortOrder !== undefined ? Number(req.body.sortOrder) : 0,
        minimumTimeMinutes: req.body.minimumTimeMinutes !== undefined ? Number(req.body.minimumTimeMinutes) : 0,
        prerequisiteJson: safeJson(req.body.prerequisites, '[]'),
        completionRuleJson: safeJson(req.body.completionRule, '{}'),
        status: normalize(req.body.status || 'DRAFT'),
        isPreview: Boolean(req.body.isPreview),
      },
      include: { lessons: true },
    });
    await learningRepo.snapshotCourse({ courseId: chapter.courseId, changeSummary: `Chapter added: ${chapter.title}`, createdBy: req.user.email || req.user.id, companyId: req.user.companyId });
    res.status(201).json(chapter);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const updateChapter = async (req, res) => {
  try {
    const errors = validateChapterPayload(req.body, true);
    if (errors.length) return res.status(400).json({ error: errors.join(', ') });
    const chapter = await prisma.learningChapter.update({
      where: { id: req.params.id },
      data: {
        title: req.body.title?.trim(),
        description: req.body.description,
        sortOrder: req.body.sortOrder !== undefined ? Number(req.body.sortOrder) : undefined,
        minimumTimeMinutes: req.body.minimumTimeMinutes !== undefined ? Number(req.body.minimumTimeMinutes) : undefined,
        prerequisiteJson: req.body.prerequisites !== undefined ? safeJson(req.body.prerequisites, '[]') : undefined,
        completionRuleJson: req.body.completionRule !== undefined ? safeJson(req.body.completionRule, '{}') : undefined,
        status: req.body.status ? normalize(req.body.status) : undefined,
        isPreview: req.body.isPreview !== undefined ? Boolean(req.body.isPreview) : undefined,
      },
    });
    await learningRepo.snapshotCourse({ courseId: chapter.courseId, changeSummary: `Chapter updated: ${chapter.title}`, createdBy: req.user.email || req.user.id, companyId: req.user.companyId });
    res.json(chapter);
  } catch (error) {
    res.status(error.code === 'P2025' ? 404 : 500).json({ error: error.code === 'P2025' ? 'Chapter not found' : 'Server error' });
  }
};

const reorderChapters = async (req, res) => {
  try {
    const orderedIds = req.body.chapterIds || req.body.orderedIds || [];
    if (!Array.isArray(orderedIds) || !orderedIds.length) return res.status(400).json({ error: 'Chapter order is required' });
    const updates = await prisma.$transaction(orderedIds.map((id, index) => prisma.learningChapter.update({ where: { id }, data: { sortOrder: index } })));
    if (updates[0]) await learningRepo.snapshotCourse({ courseId: updates[0].courseId, changeSummary: 'Chapter order updated', createdBy: req.user.email || req.user.id, companyId: req.user.companyId });
    res.json({ chapters: updates });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const archiveChapter = async (req, res) => {
  try {
    const chapter = await prisma.learningChapter.update({ where: { id: req.params.id }, data: { isActive: false, status: 'ARCHIVED' } });
    await learningRepo.snapshotCourse({ courseId: chapter.courseId, changeSummary: `Chapter archived: ${chapter.title}`, createdBy: req.user.email || req.user.id, companyId: req.user.companyId });
    res.json(chapter);
  } catch (error) {
    res.status(error.code === 'P2025' ? 404 : 500).json({ error: error.code === 'P2025' ? 'Chapter not found' : 'Server error' });
  }
};

const createLesson = async (req, res) => {
  try {
    const errors = validateLessonPayload(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join(', ') });
    const uploaded = req.file;
    const lesson = await prisma.learningLesson.create({
      data: {
        companyId: req.user.companyId,
        courseId: req.params.courseId || req.body.courseId,
        chapterId: req.body.chapterId || null,
        title: req.body.title.trim(),
        lessonType: normalize(req.body.lessonType || 'VIDEO'),
        contentUrl: req.body.contentUrl || req.body.externalUrl || null,
        embedUrl: req.body.embedUrl || req.body.videoUrl || null,
        fileName: uploaded?.originalname || req.body.fileName || null,
        filePath: uploaded ? `learning://${Date.now()}-${uploaded.originalname}` : req.body.filePath || null,
        mimeType: uploaded?.mimetype || req.body.mimeType || null,
        durationMinutes: req.body.durationMinutes !== undefined ? Number(req.body.durationMinutes) : 0,
        richText: req.body.richText || req.body.content || null,
        notes: req.body.notes || null,
        resourcesJson: safeJson(req.body.resources, '[]'),
        isPreview: Boolean(req.body.isPreview),
        isMandatory: Boolean(req.body.isMandatory),
        isDownloadable: req.body.isDownloadable !== false,
        sortOrder: req.body.sortOrder !== undefined ? Number(req.body.sortOrder) : 0,
        status: normalize(req.body.status || 'DRAFT'),
      },
    });
    await learningRepo.snapshotCourse({ courseId: lesson.courseId, changeSummary: `Lesson added: ${lesson.title}`, createdBy: req.user.email || req.user.id, companyId: req.user.companyId });
    res.status(201).json(lesson);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const archiveLesson = async (req, res) => {
  try {
    const lesson = await prisma.learningLesson.update({ where: { id: req.params.id }, data: { isActive: false, status: 'ARCHIVED' } });
    await learningRepo.snapshotCourse({ courseId: lesson.courseId, changeSummary: `Lesson archived: ${lesson.title}`, createdBy: req.user.email || req.user.id, companyId: req.user.companyId });
    res.json(lesson);
  } catch (error) {
    res.status(error.code === 'P2025' ? 404 : 500).json({ error: error.code === 'P2025' ? 'Lesson not found' : 'Server error' });
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
    const assignmentType = normalize(req.body.assignmentType);
    const departmentId = req.body.departmentId || req.body.department || null;
    const designationId = req.body.designationId || req.body.designation || null;
    const targetEmployeeIds = new Set(req.body.employeeIds || []);
    if (req.body.employeeId) targetEmployeeIds.add(req.body.employeeId);

    const course = await prisma.learningCourse.findFirst({ where: { id: courseId, isActive: true }, select: { id: true } });
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const employeeWhere = { isActive: true };
    if (targetEmployeeIds.size) employeeWhere.id = { in: [...targetEmployeeIds] };
    else if (departmentId) employeeWhere.departmentId = departmentId;
    else if (designationId) employeeWhere.jobTitle = designationId;

    const employees = await prisma.employee.findMany({ where: employeeWhere, select: { id: true, firstName: true, lastName: true } });
    if (!employees.length) return res.status(404).json({ error: 'No active employees found.' });

    if (req.user.role === 'MANAGER') {
      for (const employee of employees) {
        if (!(await canAccessEmployee(req.user, employee.id))) return res.status(403).json({ error: 'Managers can assign only to direct reports' });
      }
    }

    const employeeIds = employees.map((employee) => employee.id);
    const existingEnrollments = await prisma.learningEnrollment.findMany({
      where: { courseId, employeeId: { in: employeeIds } },
      select: { employeeId: true },
    });
    const alreadyAssigned = new Set(existingEnrollments.map((row) => row.employeeId));
    const assignableEmployees = employees.filter((employee) => !alreadyAssigned.has(employee.id));
    if (!assignableEmployees.length) return res.status(409).json({ error: 'Selected active employees already have this course assigned.' });

    const resolvedAssignmentType = assignmentType || (
      targetEmployeeIds.size > 1 ? 'MULTIPLE_EMPLOYEES'
        : targetEmployeeIds.size ? 'EMPLOYEE'
          : departmentId ? 'DEPARTMENT'
            : designationId ? 'DESIGNATION'
              : 'COMPANY'
    );
    const priority = req.body.priority ? normalize(req.body.priority) : 'MEDIUM';
    const notifyEmployees = req.body.notifyEmployees !== false;
    const assignedBy = req.user.email || req.user.id;
    const assignments = [];
    const enrollments = [];
    for (const employee of assignableEmployees) {
      const assignment = await learningRepo.createAssignment({
        courseId,
        assignmentType: resolvedAssignmentType === 'ORGANIZATION' ? 'COMPANY' : resolvedAssignmentType,
        employeeId: employee.id,
        department: departmentId,
        designation: designationId,
        dueDate,
        priority,
        notifyEmployees,
        assignedBy,
        companyId: req.user.companyId || null,
      });
      assignments.push(assignment);
      const enrollment = await learningRepo.upsertEnrollment({ courseId, employeeId: employee.id, assignmentId: assignment.id, dueDate });
      enrollments.push(enrollment);
      if (notifyEmployees) {
        await learningRepo.createNotification({
          employeeId: employee.id,
          courseId,
          type: 'COURSE_ASSIGNED',
          title: 'Course assigned',
          message: `${enrollment.course.title} has been assigned to you.`,
        });
      }
    }
    await learningRepo.logLearningAudit({ req, action: 'COURSE_ASSIGNED', entity: 'CourseAssignment', entityId: assignments[0].id, details: { courseId, count: enrollments.length, skippedDuplicates: alreadyAssigned.size } });
    res.status(201).json({ assignment: assignments[0], assignments, enrollments, skippedDuplicates: alreadyAssigned.size });
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
      await generateCertificateForEnrollment(req, updated.id).catch(() => null);
    }
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const updateLessonProgress = async (req, res) => {
  try {
    const enrollment = await prisma.learningEnrollment.findUnique({ where: { id: req.body.enrollmentId }, include: { employee: true } });
    if (!enrollment) return res.status(404).json({ error: 'Enrollment not found' });
    if (!(await canAccessEmployee(req.user, enrollment.employeeId))) return res.status(403).json({ error: 'Access denied for lesson progress' });
    const lesson = await prisma.learningLesson.findUnique({ where: { id: req.params.lessonId || req.body.lessonId }, include: { chapter: true } });
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });

    const previousLesson = await prisma.learningLesson.findFirst({
      where: { courseId: lesson.courseId, isActive: true, sortOrder: { lt: lesson.sortOrder } },
      orderBy: { sortOrder: 'desc' },
    });
    if (previousLesson) {
      const previousProgress = await prisma.learningLessonProgress.findUnique({
        where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId: previousLesson.id } },
      });
      if (!previousProgress || previousProgress.status !== 'COMPLETED') {
        return res.status(400).json({ error: 'Complete the previous lesson before continuing' });
      }
    }

    const requiredMinutes = Number(req.body.minimumTimeMinutes ?? lesson.chapter?.minimumTimeMinutes ?? 0);
    const addedMinutes = Number(req.body.timeSpentMins ?? req.body.actualTimeSpent ?? 0);
    const existing = await prisma.learningLessonProgress.findUnique({
      where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId: lesson.id } },
    });
    const totalSpent = (existing?.actualTimeSpent || existing?.timeSpentMins || 0) + Math.max(0, addedMinutes);
    const completionPercentage = requiredMinutes > 0 ? clampPercent(Math.floor((totalSpent / requiredMinutes) * 100)) : clampPercent(req.body.completionPercentage ?? req.body.progress ?? 100);
    const requestedComplete = normalize(req.body.status) === 'COMPLETED' || Number(req.body.progress) >= 100 || Number(req.body.completionPercentage) >= 100;
    if (requestedComplete && totalSpent < requiredMinutes) {
      const remainingMinutes = requiredMinutes - totalSpent;
      return res.status(400).json({ error: 'Minimum learning time not completed', remainingMinutes });
    }
    const status = requestedComplete || completionPercentage >= 100 ? 'COMPLETED' : totalSpent > 0 ? 'IN_PROGRESS' : 'NOT_STARTED';
    const now = new Date();
    const progress = await prisma.learningLessonProgress.upsert({
      where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId: lesson.id } },
      update: {
        employeeId: enrollment.employeeId,
        chapterId: lesson.chapterId,
        status,
        progress: completionPercentage,
        timeSpentMins: totalSpent,
        actualTimeSpent: totalSpent,
        completionPercentage,
        minimumTimeMinutes: requiredMinutes,
        chapterStartTime: existing?.chapterStartTime || now,
        chapterEndTime: status === 'COMPLETED' ? now : undefined,
        lastViewedAt: now,
        completedAt: status === 'COMPLETED' ? now : undefined,
      },
      create: {
        companyId: req.user.companyId,
        enrollmentId: enrollment.id,
        lessonId: lesson.id,
        employeeId: enrollment.employeeId,
        chapterId: lesson.chapterId,
        status,
        progress: completionPercentage,
        timeSpentMins: totalSpent,
        actualTimeSpent: totalSpent,
        completionPercentage,
        minimumTimeMinutes: requiredMinutes,
        chapterStartTime: now,
        chapterEndTime: status === 'COMPLETED' ? now : null,
        lastViewedAt: now,
        completedAt: status === 'COMPLETED' ? now : null,
      },
    });
    await prisma.learningEnrollment.update({
      where: { id: enrollment.id },
      data: {
        timeSpentMins: { increment: Math.max(0, addedMinutes) },
        lastAccessedAt: now,
      },
    });
    const updatedEnrollment = await recalculateEnrollmentProgress(enrollment.id);
    if (updatedEnrollment?.progress >= 100) {
      await learningRepo.createNotification({
        employeeId: enrollment.employeeId,
        courseId: enrollment.courseId,
        type: 'ASSESSMENT_UNLOCKED',
        title: 'Assessment available',
        message: `${updatedEnrollment.course.title} is complete. Your assessment is now available.`,
      }).catch(() => null);
    }
    res.json({ progress, enrollmentProgress: updatedEnrollment?.progress || 0, assessmentUnlocked: (updatedEnrollment?.progress || 0) >= 100, remainingMinutes: Math.max(0, requiredMinutes - totalSpent) });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const createLearningPath = async (req, res) => {
  try {
    if (!req.body.name?.trim()) return res.status(400).json({ error: 'Path name is required' });
    const courseIds = Array.isArray(req.body.courseIds) ? req.body.courseIds : [];
    const path = await prisma.learningPath.create({
      data: {
        companyId: req.user.companyId,
        name: req.body.name.trim(),
        description: req.body.description || null,
        pathType: normalize(req.body.pathType || 'OPTIONAL'),
        targetType: normalize(req.body.targetType || 'COMPANY'),
        targetValue: req.body.targetValue || null,
        createdBy: req.user.email || req.user.id,
        courses: courseIds.length ? { create: courseIds.map((courseId, index) => ({ companyId: req.user.companyId, courseId, sortOrder: index })) } : undefined,
      },
      include: { courses: { include: { course: true }, orderBy: { sortOrder: 'asc' } } },
    });
    res.status(201).json(path);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const listLearningPaths = async (req, res) => {
  try {
    const paths = await prisma.learningPath.findMany({
      where: { companyId: req.user.companyId || undefined },
      include: { courses: { include: { course: true }, orderBy: { sortOrder: 'asc' } }, assignments: true },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(paths);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const submitCourseFeedback = async (req, res) => {
  try {
    const employee = await getMyEmployee(req.user);
    if (!employee) return res.status(404).json({ error: 'Employee profile not found' });
    const rating = Number(req.body.rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    const feedback = await prisma.learningFeedback.upsert({
      where: { courseId_employeeId: { courseId: req.params.courseId, employeeId: employee.id } },
      update: { rating, feedback: req.body.feedback || null, suggestions: req.body.suggestions || null },
      create: { companyId: req.user.companyId, courseId: req.params.courseId, employeeId: employee.id, rating, feedback: req.body.feedback || null, suggestions: req.body.suggestions || null },
    });
    res.status(201).json(feedback);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const requestCourseApproval = async (req, res) => {
  try {
    const approval = await prisma.learningCourseApproval.create({
      data: { companyId: req.user.companyId, courseId: req.params.id, status: 'PENDING', requestedBy: req.user.email || req.user.id },
    });
    await prisma.learningCourse.update({ where: { id: req.params.id }, data: { status: 'DRAFT' } });
    res.status(201).json(approval);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const reviewCourseApproval = async (req, res) => {
  try {
    if (!isAdminRole(req.user)) return res.status(403).json({ error: 'Role not authorized' });
    const status = normalize(req.body.status);
    if (!['APPROVED', 'REJECTED'].includes(status)) return res.status(400).json({ error: 'Approval status must be APPROVED or REJECTED' });
    const approval = await prisma.learningCourseApproval.update({
      where: { id: req.params.approvalId },
      data: { status, reviewedBy: req.user.email || req.user.id, reviewerComment: req.body.comment || req.body.reviewerComment || null, reviewedAt: new Date() },
    });
    await prisma.learningCourse.update({ where: { id: approval.courseId }, data: { status: status === 'APPROVED' ? 'PUBLISHED' : 'DRAFT' } });
    res.json(approval);
  } catch (error) {
    res.status(error.code === 'P2025' ? 404 : 500).json({ error: error.code === 'P2025' ? 'Approval request not found' : 'Server error' });
  }
};

const restoreCourseVersion = async (req, res) => {
  try {
    const version = await prisma.learningCourseVersion.findUnique({ where: { id: req.params.versionId } });
    if (!version || version.courseId !== req.params.id) return res.status(404).json({ error: 'Version not found' });
    const snapshot = JSON.parse(version.snapshotJson || '{}');
    const course = await learningRepo.updateCourse(req.params.id, {
      title: snapshot.title,
      description: snapshot.description,
      category: snapshot.category,
      difficulty: snapshot.difficulty,
      durationMinutes: snapshot.durationMinutes,
      instructor: snapshot.instructor,
      thumbnailUrl: snapshot.thumbnailUrl,
      learningObjectives: snapshot.learningObjectives,
      prerequisites: snapshot.prerequisites,
      status: 'DRAFT',
    });
    await learningRepo.snapshotCourse({ courseId: course.id, changeSummary: `Restored version ${version.versionNumber}`, createdBy: req.user.email || req.user.id, companyId: req.user.companyId });
    res.json(course);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const createQuiz = async (req, res) => {
  try {
    const invalidQuestion = (req.body.questions || []).find((q) => !validateQuestionType(q.questionType || 'MCQ'));
    if (invalidQuestion) return res.status(400).json({ error: 'Unsupported question type' });
    const quiz = await prisma.quiz.create({
      data: {
        courseId: req.params.courseId || req.body.courseId,
        title: req.body.title || 'Course Quiz',
        passingMarks: Number(req.body.passingMarks ?? req.body.passingScore ?? 70),
        timeLimitMins: req.body.timeLimitMins || req.body.durationMinutes ? Number(req.body.timeLimitMins ?? req.body.durationMinutes) : null,
        attemptLimit: Number(req.body.attemptLimit ?? 1),
        randomize: Boolean(req.body.randomize),
        questions: req.body.questions?.length ? {
          create: req.body.questions.map((q, index) => ({
            question: q.question,
            questionType: normalize(q.questionType || 'MCQ'),
            options: Array.isArray(q.options) ? JSON.stringify(q.options) : q.options || null,
            correctAnswer: Array.isArray(q.correctAnswer) ? JSON.stringify(q.correctAnswer) : String(q.correctAnswer || ''),
            marks: Number(q.marks ?? q.points ?? 1),
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
    const enrollment = await findEnrollmentForLearningAction(req, req.body.courseId, req.body.enrollmentId);
    if (!enrollment) return res.status(404).json({ error: 'Enrollment not found' });
    if (!(await canAccessEmployee(req.user, enrollment.employeeId))) return res.status(403).json({ error: 'Access denied for quiz attempt' });
    const quiz = await prisma.quiz.findUnique({ where: { id: quizId }, include: { questions: true } });
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
    const previousAttempts = await prisma.quizAttempt.count({ where: { quizId, enrollmentId: enrollment.id } });
    if (previousAttempts >= quiz.attemptLimit) return res.status(400).json({ error: 'Attempt limit reached' });

    const answers = req.body.answers || {};
    const totalMarks = quiz.questions.reduce((sum, question) => sum + question.marks, 0) || 1;
    const score = quiz.questions.reduce((sum, question) => {
      const submitted = Array.isArray(answers[question.id]) ? JSON.stringify([...answers[question.id]].sort()) : String(answers[question.id] ?? '');
      let expected = String(question.correctAnswer ?? '');
      try {
        const parsed = JSON.parse(expected);
        if (Array.isArray(parsed)) expected = JSON.stringify([...parsed].sort());
      } catch {}
      return sum + (submitted === expected ? question.marks : 0);
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
      if (enrollment.progress >= 100 && enrollment.course.certificateAvailable) await generateCertificateForEnrollment(req, enrollment.id).catch(() => null);
    }
    res.status(201).json({ ...attempt, passed });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const createAssessment = async (req, res) => {
  try {
    if (!req.body.title?.trim()) return res.status(400).json({ error: 'Assessment title is required' });
    const config = buildAssessmentConfig(req.body);
    const invalidQuestion = config.questions.find((question) => !validateQuestionType(question.questionType));
    if (invalidQuestion) return res.status(400).json({ error: 'Unsupported question type' });
    const assessment = await prisma.learningAssessment.create({
      data: {
        companyId: req.user.companyId,
        courseId: req.params.courseId || req.body.courseId,
        title: req.body.title.trim(),
        assessmentType: normalize(req.body.assessmentType || (config.questions.length ? 'ASSESSMENT' : 'ASSIGNMENT')),
        instructions: req.body.instructions || null,
        rubricJson: safeJson(req.body.rubric ?? config, '{}'),
        maxMarks: Number(req.body.maxMarks ?? req.body.maxScore ?? (config.questions.reduce((sum, question) => sum + Number(question.marks || 0), 0) || 100)),
        dueDate: asDate(req.body.dueDate),
        attemptLimit: Number(req.body.attemptLimit ?? req.body.reattempts ?? 1),
        createdBy: req.user.email || req.user.id,
      },
    });
    res.status(201).json(assessment);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const submitAssessment = async (req, res) => {
  try {
    const assessment = await prisma.learningAssessment.findUnique({ where: { id: req.params.assessmentId }, include: { course: true } });
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });
    const enrollment = await findEnrollmentForLearningAction(req, assessment.courseId, req.body.enrollmentId);
    if (!enrollment) return res.status(404).json({ error: 'Enrollment not found' });
    if (!(await canAccessEmployee(req.user, enrollment.employeeId))) return res.status(403).json({ error: 'Access denied for assessment submission' });
    if (enrollment.progress < 100) return res.status(400).json({ error: 'Course not completed.' });
    const previousAttempts = await prisma.learningAssessmentSubmission.count({ where: { assessmentId: req.params.assessmentId, enrollmentId: enrollment.id } });
    if (previousAttempts >= assessment.attemptLimit) return res.status(400).json({ error: 'Attempt limit reached' });
    const answers = req.body.answers || parseMaybeJson(req.body.submissionText, null) || {};
    const scoring = scoreAssessmentAnswers(assessment, answers);
    const status = scoring.requiresManualReview ? 'PENDING_REVIEW' : scoring.passed ? 'PASS' : 'FAIL';
    const submission = await prisma.learningAssessmentSubmission.create({
      data: {
        companyId: req.user.companyId,
        assessmentId: assessment.id,
        enrollmentId: enrollment.id,
        employeeId: enrollment.employeeId,
        attemptNumber: previousAttempts + 1,
        submissionText: req.body.submissionText || JSON.stringify(answers),
        fileUrl: req.body.fileUrl || null,
        status,
        marks: scoring.requiresManualReview ? null : scoring.score,
      },
    });
    if (scoring.passed && enrollment.course.certificateAvailable) await generateCertificateForEnrollment(req, enrollment.id).catch(() => null);
    res.status(201).json({ ...submission, score: scoring.score, percentage: scoring.percentage, passed: scoring.passed, requiresManualReview: scoring.requiresManualReview, completionTime: req.body.completionTime ?? req.body.completionMins ?? null });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const evaluateAssessment = async (req, res) => {
  try {
    if (!isManagerRole(req.user)) return res.status(403).json({ error: 'Role not authorized' });
    const existing = await prisma.learningAssessmentSubmission.findUnique({ where: { id: req.params.submissionId }, include: { assessment: { include: { course: true } }, enrollment: { include: { course: true, employee: true, certificate: true } } } });
    if (!existing) return res.status(404).json({ error: 'Submission not found' });
    const marks = req.body.marks !== undefined ? Number(req.body.marks) : req.body.score !== undefined ? Number(req.body.score) : existing.marks;
    const config = parseMaybeJson(existing.assessment.rubricJson, {});
    const percentage = Math.round(((marks || 0) / (existing.assessment.maxMarks || 100)) * 100);
    const passed = percentage >= Number(config.passingScore ?? existing.assessment.course.passingScore ?? 70);
    const submission = await prisma.learningAssessmentSubmission.update({
      where: { id: req.params.submissionId },
      data: {
        marks,
        feedback: req.body.feedback || null,
        status: passed ? 'PASS' : 'FAIL',
        reviewedBy: req.user.email || req.user.id,
        reviewedAt: new Date(),
      },
    });
    if (passed && existing.enrollment.progress >= 100 && existing.enrollment.course.certificateAvailable) await generateCertificateForEnrollment(req, existing.enrollment.id).catch(() => null);
    res.json({ ...submission, percentage, passed });
  } catch (error) {
    res.status(error.code === 'P2025' ? 404 : 500).json({ error: error.code === 'P2025' ? 'Submission not found' : 'Server error' });
  }
};

const generateCourseWithAi = async (req, res) => {
  try {
    const inputText = String(req.body.text || req.body.rawText || '').trim();
    const uploaded = req.file;
    if (!inputText && !uploaded) return res.status(400).json({ error: 'Provide text or a supported file' });
    const sourceType = normalize(req.body.sourceType || (uploaded ? uploaded.originalname.split('.').pop() : 'TEXT'));
    const title = req.body.title?.trim() || inputText.split(/\r?\n/).find(Boolean)?.slice(0, 80) || `${sourceType} Generated Course`;
    const sentences = inputText.split(/[.!?]\s+/).filter(Boolean).slice(0, 6);
    const objectives = sentences.length ? sentences.slice(0, 4).map((s) => `- ${s.trim()}`).join('\n') : '- Understand the core concepts\n- Apply the learning in workplace scenarios';
    const chapters = (sentences.length ? sentences.slice(0, 5) : ['Introduction', 'Core Concepts', 'Practice', 'Assessment']).map((text, index) => ({
      title: text.length > 70 ? text.slice(0, 70) : text,
      sortOrder: index,
      lessons: { create: [{ companyId: req.user.companyId, title: `Lesson ${index + 1}`, lessonType: 'RICH_TEXT', richText: text, sortOrder: 0 }] },
    }));
    const course = await prisma.learningCourse.create({
      data: {
        companyId: req.user.companyId,
        title,
        description: req.body.description || (inputText ? inputText.slice(0, 240) : `Generated from ${uploaded.originalname}`),
        category: req.body.category || 'AI GENERATED',
        difficulty: normalize(req.body.difficulty || 'BEGINNER'),
        durationMinutes: Number(req.body.durationMinutes ?? Math.max(30, chapters.length * 15)),
        learningObjectives: objectives,
        status: 'DRAFT',
        chapters: { create: chapters.map((chapter) => ({ ...chapter, companyId: req.user.companyId })) },
        aiGenerations: {
          create: {
            companyId: req.user.companyId,
            sourceType,
            sourceFileName: uploaded?.originalname || null,
            inputPreview: inputText.slice(0, 1000),
            generatedJson: JSON.stringify({ title, objectives, chapters: chapters.map(({ lessons, ...chapter }) => chapter) }),
            requestedBy: req.user.email || req.user.id,
          },
        },
      },
      include: { chapters: { include: { lessons: true } }, aiGenerations: true },
    });
    await learningRepo.snapshotCourse({ courseId: course.id, changeSummary: 'AI generated draft', createdBy: req.user.email || req.user.id, companyId: req.user.companyId });
    res.status(201).json(course);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const upsertCourseSkill = async (req, res) => {
  try {
    if (!req.body.name?.trim()) return res.status(400).json({ error: 'Skill name is required' });
    const skill = await prisma.learningSkill.upsert({
      where: { companyId_name: { companyId: req.user.companyId || null, name: req.body.name.trim() } },
      update: { category: req.body.category || undefined, description: req.body.description || undefined },
      create: { companyId: req.user.companyId, name: req.body.name.trim(), category: req.body.category || null, description: req.body.description || null },
    });
    const courseSkill = await prisma.learningCourseSkill.upsert({
      where: { courseId_skillId: { courseId: req.params.courseId, skillId: skill.id } },
      update: { targetLevel: Number(req.body.targetLevel ?? 1) },
      create: { companyId: req.user.companyId, courseId: req.params.courseId, skillId: skill.id, targetLevel: Number(req.body.targetLevel ?? 1) },
      include: { skill: true },
    });
    res.status(201).json(courseSkill);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const generateCertificateForEnrollment = async (req, enrollmentId) => {
  const enrollment = await prisma.learningEnrollment.findUnique({
    where: { id: enrollmentId },
    include: { course: true, employee: true, assignment: true, certificate: true },
  });
  const fail = (message, status = 400) => {
    const err = new Error(message);
    err.status = status;
    throw err;
  };
  if (!enrollment) fail('Assignment not found.', 404);
  if (!enrollment.employee) fail('Employee not found.', 404);
  if (!enrollment.course) fail('Course not found.', 404);
  if (!enrollment.assignmentId && !enrollment.assignment) fail('Employee not assigned.');
  const currentEnrollment = await recalculateEnrollmentProgress(enrollment.id);
  if ((currentEnrollment?.progress || 0) < 100) fail('Course not completed.');
  const assessment = await hasPassedAssessment(currentEnrollment);
  if (!assessment.passed) fail('Assessment not passed.');
  if (enrollment.certificate) fail('Certificate already exists.', 409);

  const issuedAt = new Date();
  const completionDate = currentEnrollment.completedAt || issuedAt;
  const verificationToken = crypto.randomBytes(16).toString('hex');
  const certificateNumber = `PID-LRN-${issuedAt.getFullYear()}-${Date.now()}-${enrollment.employee.employeeId || enrollment.employeeId}`;
  const cert = await prisma.certificate.create({
    data: {
      courseId: enrollment.courseId,
      employeeId: enrollment.employeeId,
      enrollmentId: enrollment.id,
      certificateNumber,
      employeeName: `${enrollment.employee.firstName} ${enrollment.employee.lastName}`,
      courseName: enrollment.course.title,
      completionDate,
      qrCode: `PID-HCMS:${verificationToken}`,
      fileUrl: `/api/learning/certificates/${certificateNumber}/download`,
      issuedAt,
    },
  });
  await prisma.certificate.update({ where: { id: cert.id }, data: { fileUrl: `/api/learning/certificates/${cert.id}/download` } });
  await learningRepo.createNotification({
    employeeId: enrollment.employeeId,
    courseId: enrollment.courseId,
    type: 'CERTIFICATE_GENERATED',
    title: 'Certificate generated',
    message: `Your certificate for ${enrollment.course.title} is ready.`,
  });
  if (req) await learningRepo.logLearningAudit({ req, action: 'CERTIFICATE_GENERATED', entity: 'Certificate', entityId: cert.id });
  return { ...cert, fileUrl: `/api/learning/certificates/${cert.id}/download`, status: 'ISSUED', verificationToken };
};

const generateCertificate = async (req, res) => {
  try {
    const cert = await generateCertificateForEnrollment(req, req.body.enrollmentId || req.params.enrollmentId);
    res.status(201).json({ success: true, status: 'ISSUED', certificate: cert });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Server error' });
  }
};

const generateCertificatePdf = (cert) => new Promise((resolve, reject) => {
  try {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.rect(32, 32, 531, 778).lineWidth(2).strokeColor('#0f766e').stroke();
    doc.rect(44, 44, 507, 754).lineWidth(0.75).strokeColor('#93c5fd').stroke();
    doc.fillColor('#0f766e').font('Helvetica-Bold').fontSize(24).text('PID HCMS', 0, 88, { align: 'center' });
    doc.fillColor('#111827').fontSize(30).text('Certificate of Completion', 0, 140, { align: 'center' });
    doc.font('Helvetica').fontSize(12).fillColor('#4b5563').text('This certificate is proudly presented to', 0, 208, { align: 'center' });
    doc.font('Helvetica-Bold').fontSize(26).fillColor('#111827').text(cert.employeeName, 70, 240, { align: 'center' });
    doc.font('Helvetica').fontSize(12).fillColor('#4b5563').text('for successfully completing', 0, 302, { align: 'center' });
    doc.font('Helvetica-Bold').fontSize(21).fillColor('#111827').text(cert.courseName, 70, 332, { align: 'center' });
    doc.font('Helvetica').fontSize(11).fillColor('#374151')
      .text(`Completion Date: ${new Date(cert.completionDate).toLocaleDateString('en-IN')}`, 88, 420)
      .text(`Issue Date: ${new Date(cert.issuedAt).toLocaleDateString('en-IN')}`, 88, 444)
      .text(`Certificate Number: ${cert.certificateNumber}`, 88, 468);
    doc.roundedRect(400, 420, 96, 96, 4).lineWidth(1).strokeColor('#111827').stroke();
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827').text('QR CODE', 400, 452, { width: 96, align: 'center' });
    doc.font('Helvetica').fontSize(6).fillColor('#4b5563').text(cert.qrCode || 'Verification pending', 408, 472, { width: 80, align: 'center' });
    doc.moveTo(88, 610).lineTo(238, 610).strokeColor('#9ca3af').stroke();
    doc.moveTo(358, 610).lineTo(508, 610).strokeColor('#9ca3af').stroke();
    doc.font('Helvetica').fontSize(10).fillColor('#4b5563').text('Authorized Signatory', 88, 620, { width: 150, align: 'center' });
    doc.text('Learning Administrator', 358, 620, { width: 150, align: 'center' });
    doc.fontSize(8).fillColor('#6b7280').text('Generated from PID HCMS application. Verify using the certificate number or QR token.', 70, 744, { width: 455, align: 'center' });
    doc.end();
  } catch (error) {
    reject(error);
  }
});

const downloadCertificate = async (req, res) => {
  try {
    const cert = await prisma.certificate.findFirst({ where: { OR: [{ id: req.params.id }, { certificateNumber: req.params.id }] } });
    if (!cert) return res.status(404).json({ error: 'Certificate not found' });
    if (!(await canAccessEmployee(req.user, cert.employeeId))) return res.status(403).json({ error: 'Access denied for certificate' });
    const pdf = await generateCertificatePdf(cert);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${cert.certificateNumber}.pdf"`);
    res.send(pdf);
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
    const [totalCourses, enrollments, certificates, upcoming, recent, assessmentResults] = await Promise.all([
      prisma.learningCourse.count({ where: { isActive: true } }),
      learningRepo.listEnrollments(enrollmentWhere),
      prisma.certificate.count({ where: enrollmentWhere.employeeId ? { employeeId: enrollmentWhere.employeeId } : {} }),
      prisma.learningEnrollment.findMany({ where: { ...enrollmentWhere, dueDate: { gte: new Date() } }, include: { course: true }, take: 5, orderBy: { dueDate: 'asc' } }),
      prisma.learningEnrollment.findMany({ where: enrollmentWhere, include: { course: true }, take: 5, orderBy: { updatedAt: 'desc' } }),
      prisma.learningAssessmentSubmission.findMany({ where: enrollmentWhere.employeeId ? { employeeId: enrollmentWhere.employeeId } : {}, include: { assessment: true } }),
    ]);
    const completed = enrollments.filter((e) => e.status === 'COMPLETED').length;
    const evaluatedResults = assessmentResults.filter((row) => ['PASS', 'PASSED', 'FAIL', 'FAILED', 'EVALUATED'].includes(normalize(row.status)) && row.marks !== null);
    const passedResults = assessmentResults.filter((row) => ['PASS', 'PASSED'].includes(normalize(row.status)));
    const avgScore = evaluatedResults.length ? Math.round(evaluatedResults.reduce((sum, row) => sum + ((Number(row.marks) / (row.assessment?.maxMarks || 100)) * 100), 0) / evaluatedResults.length) : 0;
    res.json({
      totalCourses,
      assignedCourses: enrollments.length,
      completedCourses: completed,
      inProgress: enrollments.filter((e) => e.status === 'IN_PROGRESS').length,
      certificatesEarned: certificates,
      certificatesIssued: certificates,
      pendingCertificates: enrollments.filter((e) => e.course?.certificateAvailable && !e.certificate).length,
      assessmentResults,
      averageScore: avgScore,
      passRate: assessmentResults.length ? Math.round((passedResults.length / assessmentResults.length) * 100) : 0,
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
    const assessmentResults = await prisma.learningAssessmentSubmission.findMany({ include: { assessment: { include: { course: true } }, employee: { select: { firstName: true, lastName: true, employeeId: true } } }, orderBy: { submittedAt: 'desc' } });
    const issuedCertificates = await prisma.certificate.count();
    const certificateEligible = enrollments.filter((e) => e.course?.certificateAvailable);
    const evaluatedResults = assessmentResults.filter((row) => ['PASS', 'PASSED', 'FAIL', 'FAILED', 'EVALUATED'].includes(normalize(row.status)) && row.marks !== null);
    const passedResults = assessmentResults.filter((row) => ['PASS', 'PASSED'].includes(normalize(row.status)));
    res.json({
      courseCompletion: enrollments,
      departmentCompletion: Object.entries(byDepartment).map(([department, data]) => ({ department, ...data })),
      pendingCourses: enrollments.filter((e) => e.status !== 'COMPLETED'),
      topLearners: enrollments.filter((e) => e.status === 'COMPLETED').slice(0, 10),
      assessmentResults,
      averageScore: evaluatedResults.length ? Math.round(evaluatedResults.reduce((sum, row) => sum + ((Number(row.marks) / (row.assessment?.maxMarks || 100)) * 100), 0) / evaluatedResults.length) : 0,
      passRate: assessmentResults.length ? Math.round((passedResults.length / assessmentResults.length) * 100) : 0,
      certificatesIssued: issuedCertificates,
      pendingCertificates: certificateEligible.filter((e) => !e.certificate).length,
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
  archiveChapter,
  archiveLesson,
  createAssessment,
  createChapter,
  createCourse,
  createLearningPath,
  createLesson,
  createMaterial,
  downloadMaterial,
  createQuiz,
  deleteCourse,
  downloadCertificate,
  evaluateAssessment,
  generateCertificate,
  generateCourseWithAi,
  getCourse,
  getDashboard,
  getEmployeeLearningSummary,
  listLearningPaths,
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
};
