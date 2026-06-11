const prisma = require('../config/database');
const { canAccessEmployee, getEmployeeScopeIds, isHr } = require('../services/accessControl');

const listCourses = async (req, res) => {
  try {
    const courses = await prisma.learningCourse.findMany({
      where: { isActive: true },
      include: { _count: { select: { enrollments: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(courses);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const createCourse = async (req, res) => {
  try {
    const { title, description, category, isMandatory } = req.body;
    if (!title) return res.status(400).json({ error: 'Course title is required' });
    const course = await prisma.learningCourse.create({
      data: { title, description, category: category || 'GENERAL', isMandatory: Boolean(isMandatory) },
    });
    res.status(201).json(course);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const assignCourse = async (req, res) => {
  try {
    const { courseId, employeeId, dueDate } = req.body;
    if (!courseId || !employeeId) return res.status(400).json({ error: 'Course and employee are required' });
    const enrollment = await prisma.learningEnrollment.upsert({
      where: { courseId_employeeId: { courseId, employeeId } },
      update: { dueDate: dueDate ? new Date(dueDate) : undefined, status: 'ASSIGNED' },
      create: { courseId, employeeId, dueDate: dueDate ? new Date(dueDate) : null },
      include: { course: true, employee: { select: { id: true, employeeId: true, firstName: true, lastName: true } } },
    });
    res.status(201).json(enrollment);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const listEnrollments = async (req, res) => {
  try {
    const { employeeId } = req.query;
    const where = {};
    if (employeeId) {
      if (!(await canAccessEmployee(req.user, employeeId))) return res.status(403).json({ error: 'Access denied for requested learning records' });
      where.employeeId = employeeId;
    } else if (!isHr(req.user)) {
      const employeeIds = await getEmployeeScopeIds(req.user);
      where.employeeId = { in: employeeIds.length ? employeeIds : ['__no_employee_scope__'] };
    }
    const enrollments = await prisma.learningEnrollment.findMany({
      where,
      include: { course: true, employee: { select: { id: true, employeeId: true, firstName: true, lastName: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(enrollments);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const updateEnrollment = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, progress } = req.body;
    const existing = await prisma.learningEnrollment.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Enrollment not found' });
    if (!(await canAccessEmployee(req.user, existing.employeeId))) return res.status(403).json({ error: 'Access denied for enrollment' });

    const parsedProgress = progress !== undefined ? Number(progress) : undefined;
    if (parsedProgress !== undefined && (!Number.isFinite(parsedProgress) || parsedProgress < 0 || parsedProgress > 100)) {
      return res.status(400).json({ error: 'Progress must be between 0 and 100' });
    }

    const updated = await prisma.learningEnrollment.update({
      where: { id },
      data: {
        status: status || undefined,
        progress: parsedProgress,
        completedAt: status === 'COMPLETED' || parsedProgress === 100 ? new Date() : undefined,
      },
      include: { course: true },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { listCourses, createCourse, assignCourse, listEnrollments, updateEnrollment };
