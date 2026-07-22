const prisma = require('../config/database');
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
const safeJson = (value, fallback) => {
  if (value === undefined) return fallback;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
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
    const activeLessons = await prisma.learningLesson.count({ where: { courseId: enrollment.courseId, isActive: true } });
    const completedLessons = await prisma.learningLessonProgress.count({ where: { enrollmentId: enrollment.id, status: 'COMPLETED' } });
    const enrollmentProgress = activeLessons ? Math.floor((completedLessons / activeLessons) * 100) : completionPercentage;
    await prisma.learningEnrollment.update({
      where: { id: enrollment.id },
      data: {
        progress: enrollmentProgress,
        status: enrollmentProgress >= 100 ? 'COMPLETED' : 'IN_PROGRESS',
        timeSpentMins: { increment: Math.max(0, addedMinutes) },
        lastAccessedAt: now,
        completedAt: enrollmentProgress >= 100 ? now : undefined,
      },
    });
    res.json({ progress, enrollmentProgress, remainingMinutes: Math.max(0, requiredMinutes - totalSpent) });
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
        passingMarks: Number(req.body.passingMarks ?? 70),
        timeLimitMins: req.body.timeLimitMins ? Number(req.body.timeLimitMins) : null,
        attemptLimit: Number(req.body.attemptLimit ?? 1),
        randomize: Boolean(req.body.randomize),
        questions: req.body.questions?.length ? {
          create: req.body.questions.map((q, index) => ({
            question: q.question,
            questionType: normalize(q.questionType || 'MCQ'),
            options: Array.isArray(q.options) ? JSON.stringify(q.options) : q.options || null,
            correctAnswer: Array.isArray(q.correctAnswer) ? JSON.stringify(q.correctAnswer) : String(q.correctAnswer || ''),
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
    }
    res.status(201).json(attempt);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const createAssessment = async (req, res) => {
  try {
    if (!req.body.title?.trim()) return res.status(400).json({ error: 'Assessment title is required' });
    const assessment = await prisma.learningAssessment.create({
      data: {
        companyId: req.user.companyId,
        courseId: req.params.courseId || req.body.courseId,
        title: req.body.title.trim(),
        assessmentType: normalize(req.body.assessmentType || 'ASSIGNMENT'),
        instructions: req.body.instructions || null,
        rubricJson: safeJson(req.body.rubric, '[]'),
        maxMarks: Number(req.body.maxMarks ?? 100),
        dueDate: asDate(req.body.dueDate),
        attemptLimit: Number(req.body.attemptLimit ?? 1),
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
    const enrollment = await prisma.learningEnrollment.findUnique({ where: { id: req.body.enrollmentId } });
    if (!enrollment) return res.status(404).json({ error: 'Enrollment not found' });
    if (!(await canAccessEmployee(req.user, enrollment.employeeId))) return res.status(403).json({ error: 'Access denied for assessment submission' });
    const previousAttempts = await prisma.learningAssessmentSubmission.count({ where: { assessmentId: req.params.assessmentId, enrollmentId: enrollment.id } });
    const assessment = await prisma.learningAssessment.findUnique({ where: { id: req.params.assessmentId } });
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });
    if (previousAttempts >= assessment.attemptLimit) return res.status(400).json({ error: 'Attempt limit reached' });
    const submission = await prisma.learningAssessmentSubmission.create({
      data: {
        companyId: req.user.companyId,
        assessmentId: assessment.id,
        enrollmentId: enrollment.id,
        employeeId: enrollment.employeeId,
        attemptNumber: previousAttempts + 1,
        submissionText: req.body.submissionText || null,
        fileUrl: req.body.fileUrl || null,
      },
    });
    res.status(201).json(submission);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const evaluateAssessment = async (req, res) => {
  try {
    if (!isManagerRole(req.user)) return res.status(403).json({ error: 'Role not authorized' });
    const submission = await prisma.learningAssessmentSubmission.update({
      where: { id: req.params.submissionId },
      data: {
        marks: req.body.marks !== undefined ? Number(req.body.marks) : undefined,
        feedback: req.body.feedback || null,
        status: 'EVALUATED',
        reviewedBy: req.user.email || req.user.id,
        reviewedAt: new Date(),
      },
    });
    res.json(submission);
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
