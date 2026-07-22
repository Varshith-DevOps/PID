const prisma = require('../config/database');

const includeCourseDetails = {
  materials: { orderBy: { sortOrder: 'asc' } },
  quizzes: { include: { questions: { orderBy: { sortOrder: 'asc' } } } },
  _count: { select: { enrollments: true, assignments: true, certificates: true } },
};

const listCourses = (where = {}) => prisma.learningCourse.findMany({
  where,
  include: { _count: { select: { enrollments: true, materials: true, quizzes: true } } },
  orderBy: { createdAt: 'desc' },
});

const getCourse = (id) => prisma.learningCourse.findUnique({
  where: { id },
  include: includeCourseDetails,
});

const createCourse = (data) => prisma.learningCourse.create({ data, include: includeCourseDetails });

const updateCourse = (id, data) => prisma.learningCourse.update({ where: { id }, data, include: includeCourseDetails });

const softDeleteCourse = (id) => prisma.learningCourse.update({ where: { id }, data: { isActive: false, status: 'ARCHIVED' } });

const createMaterial = (data) => prisma.courseMaterial.create({ data });

const createAssignment = (data) => prisma.courseAssignment.create({ data });

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
  createNotification,
  getCourse,
  listCourses,
  listEnrollments,
  logLearningAudit,
  softDeleteCourse,
  updateCourse,
  upsertEnrollment,
};
