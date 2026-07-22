const prisma = require('../config/database');

const includeCourseDetails = {
  materials: { orderBy: { sortOrder: 'asc' } },
  chapters: { include: { lessons: { orderBy: { sortOrder: 'asc' } } }, orderBy: { sortOrder: 'asc' } },
  lessons: { orderBy: { sortOrder: 'asc' } },
  versions: { orderBy: { versionNumber: 'desc' } },
  approvals: { orderBy: { requestedAt: 'desc' } },
  courseSkills: { include: { skill: true } },
  feedback: true,
  aiGenerations: { orderBy: { createdAt: 'desc' } },
  quizzes: { include: { questions: { orderBy: { sortOrder: 'asc' } } } },
  _count: { select: { enrollments: true, assignments: true, certificates: true } },
};

const withEnterprisePayload = (course) => course && ({
  ...course,
  enterprise: {
    chapters: course.chapters || [],
    lessons: course.lessons || [],
    versions: course.versions || [],
    approvals: course.approvals || [],
    skills: course.courseSkills || [],
    feedback: course.feedback || [],
    aiGenerations: course.aiGenerations || [],
  },
});

const listCourses = (where = {}, options = {}) => prisma.learningCourse.findMany({
  where,
  include: { _count: { select: { enrollments: true, materials: true, quizzes: true } } },
  orderBy: options.orderBy || { createdAt: 'desc' },
  skip: options.skip,
  take: options.take,
});

const getCourse = (id) => prisma.learningCourse.findUnique({
  where: { id },
  include: includeCourseDetails,
}).then(withEnterprisePayload);

const countCourses = (where = {}) => prisma.learningCourse.count({ where });

const createCourse = (data) => prisma.learningCourse.create({ data, include: includeCourseDetails });

const updateCourse = (id, data) => prisma.learningCourse.update({ where: { id }, data, include: includeCourseDetails });

const softDeleteCourse = (id) => prisma.learningCourse.update({ where: { id }, data: { isActive: false, status: 'ARCHIVED' } });

const createMaterial = (data) => prisma.courseMaterial.create({ data });

const createAssignment = (data) => prisma.courseAssignment.create({ data });

const nextCourseVersionNumber = async (courseId) => {
  const last = await prisma.learningCourseVersion.findFirst({ where: { courseId }, orderBy: { versionNumber: 'desc' } });
  return (last?.versionNumber || 0) + 1;
};

const snapshotCourse = async ({ courseId, changeSummary, createdBy, companyId }) => {
  const course = await prisma.learningCourse.findUnique({
    where: { id: courseId },
    include: {
      materials: true,
      chapters: { include: { lessons: true } },
      lessons: true,
      quizzes: { include: { questions: true } },
    },
  });
  if (!course) return null;
  return prisma.learningCourseVersion.create({
    data: {
      companyId: companyId || course.companyId,
      courseId,
      versionNumber: await nextCourseVersionNumber(courseId),
      title: course.title,
      status: course.status,
      snapshotJson: JSON.stringify(course),
      changeSummary,
      createdBy,
    },
  });
};

const upsertEnrollment = ({ courseId, employeeId, assignmentId, dueDate }) => prisma.learningEnrollment.upsert({
  where: { courseId_employeeId: { courseId, employeeId } },
  update: { assignmentId, dueDate, status: 'ASSIGNED' },
  create: { courseId, employeeId, assignmentId, dueDate },
  include: { course: true, employee: { select: { id: true, employeeId: true, firstName: true, lastName: true, department: { select: { name: true } }, jobTitle: true } } },
});

const listEnrollments = (where = {}) => prisma.learningEnrollment.findMany({
  where,
  include: {
    course: true,
    employee: { select: { id: true, employeeId: true, firstName: true, lastName: true, department: { select: { name: true } }, jobTitle: true } },
    certificate: true,
  },
  orderBy: { updatedAt: 'desc' },
});

const createNotification = (data) => prisma.learningNotification.create({ data });

const logLearningAudit = async ({ req, action, entity, entityId, details }) => {
  try {
    await prisma.learningAuditLog.create({
      data: {
        companyId: req.user?.companyId,
        actorId: req.user?.id,
        actorEmail: req.user?.email,
        action,
        entity,
        entityId,
        details: details ? JSON.stringify(details) : null,
        ipAddress: req.ip,
      },
    });
  } catch (error) {
    console.error('[LEARNING AUDIT ERROR]:', error.message);
  }
};

module.exports = {
  createAssignment,
  createCourse,
  createMaterial,
  countCourses,
  createNotification,
  nextCourseVersionNumber,
  getCourse,
  listCourses,
  listEnrollments,
  logLearningAudit,
  snapshotCourse,
  softDeleteCourse,
  updateCourse,
  upsertEnrollment,
};
