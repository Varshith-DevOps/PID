const prisma = require('../config/database');
const { canAccessEmployee, getEmployeeScopeIds, isHr } = require('../services/accessControl');

const managerRoles = ['SUPER_ADMIN', 'ADMIN', 'HR', 'MANAGER'];
const canManage = (user) => managerRoles.includes(user?.role);
const asNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

const employeeFilter = async (req) => {
  if (req.query.employeeId) {
    if (!(await canAccessEmployee(req.user, req.query.employeeId))) throw Object.assign(new Error('Access denied'), { status: 403 });
    return { id: req.query.employeeId };
  }
  if (req.user.employeeId) return { id: req.user.employeeId };
  if (isHr(req.user)) return { companyId: req.user.companyId };
  const ids = await getEmployeeScopeIds(req.user);
  return { id: { in: ids.length ? ids : ['__no_employee_scope__'] } };
};

const calculateKpi = (kpi, employeeId) => {
  const courses = kpi.kpas.flatMap((link) => link.kpa.courses.map((courseLink) => courseLink.courseId));
  return prisma.learningEnrollment.findMany({ where: { employeeId, courseId: { in: [...new Set(courses)] } }, select: { progress: true } }).then((enrollments) => {
    const completionPct = courses.length ? Math.round(enrollments.reduce((sum, row) => sum + row.progress, 0) / courses.length) : 0;
    return { completionPct, score: Math.min(100, completionPct) };
  });
};

const materializeAssignments = async (companyId, employees, kpis) => {
  for (const employee of employees) {
    const matches = kpis.filter((kpi) => (!kpi.departmentId || kpi.departmentId === employee.departmentId) && (!kpi.designation || kpi.designation === employee.jobTitle));
    for (const kpi of matches) {
      const calculated = await calculateKpi(kpi, employee.id);
      await prisma.employeeKpiAssignment.upsert({
        where: { employeeId_kpiId: { employeeId: employee.id, kpiId: kpi.id } },
        update: { completionPct: calculated.completionPct, score: calculated.score, lastCalculated: new Date(), inherited: true },
        create: { companyId, employeeId: employee.id, kpiId: kpi.id, completionPct: calculated.completionPct, score: calculated.score, lastCalculated: new Date(), inherited: true },
      });
    }
  }
};

const getKpiDashboard = async (req, res) => {
  try {
    const employees = await prisma.employee.findMany({ where: await employeeFilter(req), select: { id: true, firstName: true, lastName: true, employeeId: true, jobTitle: true, departmentId: true, department: { select: { name: true } } } });
    const kpis = await prisma.kpiDefinition.findMany({ where: { companyId: req.user.companyId || undefined, status: 'ACTIVE' }, include: { department: { select: { name: true } }, kpas: { include: { kpa: { include: { courses: true } } } } }, orderBy: { updatedAt: 'desc' } });
    await materializeAssignments(req.user.companyId, employees, kpis);
    const assignments = await prisma.employeeKpiAssignment.findMany({ where: { employeeId: { in: employees.map((employee) => employee.id) }, kpi: { companyId: req.user.companyId || undefined } }, include: { kpi: { include: { department: { select: { name: true } } } }, employee: { select: { firstName: true, lastName: true, employeeId: true, department: { select: { name: true } } } } }, orderBy: { updatedAt: 'desc' } });
    const average = assignments.length ? Math.round(assignments.reduce((sum, item) => sum + item.score, 0) / assignments.length) : 0;
    res.json({ kpis, assignments, summary: { totalKpis: kpis.length, assignedEmployees: new Set(assignments.map((item) => item.employeeId)).size, averageScore: average, averageCompletion: average } });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Server error' });
  }
};

const createKpi = async (req, res) => {
  try {
    if (!canManage(req.user)) return res.status(403).json({ error: 'Only HR or administrators can configure KPIs.' });
    if (!req.body.name?.trim()) return res.status(400).json({ error: 'KPI name is required' });
    const kpi = await prisma.kpiDefinition.create({ data: { companyId: req.user.companyId, name: req.body.name.trim(), description: req.body.description || null, departmentId: req.body.departmentId || null, designation: req.body.designation || null, targetValue: asNumber(req.body.targetValue, 100), unit: req.body.unit || 'PERCENTAGE', weightage: asNumber(req.body.weightage), createdBy: req.user.email || req.user.id, kpas: { create: (req.body.kpaIds || []).map((kpaId) => ({ kpaId })) } } });
    await prisma.kpiVersion.create({ data: { kpiId: kpi.id, version: 1, snapshotJson: JSON.stringify(kpi), changedBy: req.user.email || req.user.id } });
    res.status(201).json(kpi);
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
};

const updateKpi = async (req, res) => {
  try {
    if (!canManage(req.user)) return res.status(403).json({ error: 'Only HR or administrators can configure KPIs.' });
    const existing = await prisma.kpiDefinition.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'KPI not found' });
    const version = existing.version + 1;
    const kpi = await prisma.kpiDefinition.update({ where: { id: existing.id }, data: { name: req.body.name?.trim() || existing.name, description: req.body.description ?? existing.description, departmentId: req.body.departmentId !== undefined ? req.body.departmentId || null : existing.departmentId, designation: req.body.designation !== undefined ? req.body.designation || null : existing.designation, targetValue: req.body.targetValue !== undefined ? asNumber(req.body.targetValue) : existing.targetValue, unit: req.body.unit || existing.unit, weightage: req.body.weightage !== undefined ? asNumber(req.body.weightage) : existing.weightage, version } });
    if (Array.isArray(req.body.kpaIds)) {
      await prisma.kpiKpa.deleteMany({ where: { kpiId: existing.id } });
      await prisma.kpiKpa.createMany({ data: req.body.kpaIds.map((kpaId) => ({ kpiId: existing.id, kpaId })), skipDuplicates: true });
    }
    await prisma.kpiVersion.create({ data: { kpiId: kpi.id, version, snapshotJson: JSON.stringify(kpi), changedBy: req.user.email || req.user.id } });
    res.json(kpi);
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
};

const createKpa = async (req, res) => {
  try {
    if (!canManage(req.user)) return res.status(403).json({ error: 'Only HR or administrators can configure KPAs.' });
    if (!req.body.name?.trim()) return res.status(400).json({ error: 'KPA name is required' });
    const kpa = await prisma.kpaDefinition.create({
      data: {
        companyId: req.user.companyId,
        name: req.body.name.trim(),
        description: req.body.description || null,
        createdBy: req.user.email || req.user.id,
        skills: { create: (req.body.skillIds || []).map((skillId) => ({ skillId })) },
        courses: { create: (req.body.courseIds || []).map((courseId) => ({ courseId })) },
      },
    });
    await prisma.kpaVersion.create({ data: { kpaId: kpa.id, version: 1, snapshotJson: JSON.stringify(req.body), changedBy: req.user.email || req.user.id } });
    res.status(201).json(kpa);
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
};

const updateKpa = async (req, res) => {
  try {
    if (!canManage(req.user)) return res.status(403).json({ error: 'Only HR or administrators can configure KPAs.' });
    const existing = await prisma.kpaDefinition.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'KPA not found' });
    const version = existing.version + 1;
    const kpa = await prisma.kpaDefinition.update({ where: { id: existing.id }, data: { name: req.body.name?.trim() || existing.name, description: req.body.description ?? existing.description, version } });
    if (Array.isArray(req.body.skillIds) || Array.isArray(req.body.courseIds)) {
      await prisma.kpaSkill.deleteMany({ where: { kpaId: existing.id } });
      await prisma.kpaCourse.deleteMany({ where: { kpaId: existing.id } });
      if (Array.isArray(req.body.skillIds) && req.body.skillIds.length) await prisma.kpaSkill.createMany({ data: req.body.skillIds.map((skillId) => ({ kpaId: existing.id, skillId })), skipDuplicates: true });
      if (Array.isArray(req.body.courseIds) && req.body.courseIds.length) await prisma.kpaCourse.createMany({ data: req.body.courseIds.map((courseId) => ({ kpaId: existing.id, courseId })), skipDuplicates: true });
    }
    await prisma.kpaVersion.create({ data: { kpaId: kpa.id, version, snapshotJson: JSON.stringify(req.body), changedBy: req.user.email || req.user.id } });
    res.json(kpa);
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
};

const listKpa = async (req, res) => {
  try {
    const kpas = await prisma.kpaDefinition.findMany({ where: { companyId: req.user.companyId || undefined, status: 'ACTIVE' }, include: { skills: { include: { skill: true } }, courses: { include: { course: { select: { id: true, title: true } } } }, kpis: true }, orderBy: { updatedAt: 'desc' } });
    res.json(kpas);
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
};

const listLearningSkills = async (req, res) => {
  try {
    const skills = await prisma.learningSkill.findMany({ where: { companyId: req.user.companyId || undefined, isActive: true }, orderBy: { name: 'asc' } });
    res.json(skills);
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
};

module.exports = { getKpiDashboard, createKpi, updateKpi, createKpa, updateKpa, listKpa, listLearningSkills };
