const prisma = require('../config/database');

const recalculateObjectiveProgress = async (objectiveId, tx = prisma) => {
  const krs = await tx.keyResult.findMany({ where: { objectiveId } });
  if (krs.length === 0) {
    await tx.objective.update({
      where: { id: objectiveId },
      data: { progress: 0.0 }
    });
    return;
  }

  let totalWeight = 0;
  let weightedProgress = 0;

  for (const kr of krs) {
    const range = kr.targetValue - kr.startValue;
    let completion = 0;
    if (range !== 0) {
      completion = (kr.currentValue - kr.startValue) / range;
    } else {
      completion = kr.currentValue >= kr.targetValue ? 1 : 0;
    }
    const clampedProgress = Math.max(0, Math.min(1, completion));
    weightedProgress += clampedProgress * kr.weight;
    totalWeight += kr.weight;
  }

  const finalProgress = totalWeight > 0 ? (weightedProgress / totalWeight) * 100 : 0;

  await tx.objective.update({
    where: { id: objectiveId },
    data: { progress: Math.round(finalProgress * 100) / 100 }
  });
};

const createObjective = async (req, res) => {
  try {
    const { title, description, startDate, endDate, parentId } = req.body;

    const employee = await prisma.employee.findFirst({ where: { userId: req.user.id } });
    if (!employee) return res.status(404).json({ error: 'Employee profile not found.' });

    const objective = await prisma.objective.create({
      data: {
        companyId: employee.companyId,
        employeeId: employee.id,
        title,
        description,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        parentId: parentId || null
      }
    });

    res.status(201).json(objective);
  } catch (error) {
    console.error('[CREATE OBJECTIVE ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const addKeyResult = async (req, res) => {
  try {
    const { objectiveId, title, description, startValue, targetValue, currentValue, unit, weight } = req.body;

    const objective = await prisma.objective.findUnique({ where: { id: objectiveId } });
    if (!objective) return res.status(404).json({ error: 'Objective not found.' });

    const kr = await prisma.$transaction(async (tx) => {
      const newKr = await tx.keyResult.create({
        data: {
          objectiveId,
          title,
          description,
          startValue: parseFloat(startValue) || 0.0,
          targetValue: parseFloat(targetValue),
          currentValue: parseFloat(currentValue) || 0.0,
          unit: unit || '%',
          weight: parseFloat(weight) || 1.0
        }
      });

      await recalculateObjectiveProgress(objectiveId, tx);
      return newKr;
    });

    res.status(201).json(kr);
  } catch (error) {
    console.error('[ADD KEY RESULT ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const updateKeyResult = async (req, res) => {
  try {
    const { id } = req.params;
    const { currentValue } = req.body;

    const kr = await prisma.keyResult.findUnique({ where: { id } });
    if (!kr) return res.status(404).json({ error: 'Key Result not found.' });

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.keyResult.update({
        where: { id },
        data: { currentValue: parseFloat(currentValue) }
      });

      await recalculateObjectiveProgress(kr.objectiveId, tx);
      return result;
    });

    res.json(updated);
  } catch (error) {
    console.error('[UPDATE KEY RESULT ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const getEmployeeOkrs = async (req, res) => {
  try {
    const employee = await prisma.employee.findFirst({ where: { userId: req.user.id } });
    if (!employee) return res.status(404).json({ error: 'Employee profile not found.' });

    const list = await prisma.objective.findMany({
      where: { employeeId: employee.id },
      include: {
        keyResults: true,
        parent: { select: { id: true, title: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(list);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  createObjective,
  addKeyResult,
  updateKeyResult,
  getEmployeeOkrs
};
