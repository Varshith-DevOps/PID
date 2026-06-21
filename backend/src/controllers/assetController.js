const prisma = require('../config/database');
const { canAccessEmployee, getEmployeeScopeIds, isHr, employeeInTenant } = require('../services/accessControl');

const listAssets = async (req, res) => {
  try {
    const { status, assignedToId } = req.query;
    const where = {};
    if (status) where.status = status;
    if (assignedToId) {
      if (!(await canAccessEmployee(req.user, assignedToId))) {
        return res.status(403).json({ error: 'Access denied for requested employee assets' });
      }
      where.assignedToId = assignedToId;
    } else if (!isHr(req.user)) {
      const employeeIds = await getEmployeeScopeIds(req.user);
      where.assignedToId = { in: employeeIds.length ? employeeIds : ['__no_employee_scope__'] };
    }

    const assets = await prisma.asset.findMany({
      where,
      include: { assignedTo: { select: { id: true, employeeId: true, firstName: true, lastName: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(assets);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const createAsset = async (req, res) => {
  try {
    const { assetTag, name, category, serialNumber, condition, notes } = req.body;
    if (!assetTag || !name || !category) {
      return res.status(400).json({ error: 'Asset tag, name and category are required' });
    }

    const asset = await prisma.asset.create({
      data: { assetTag, name, category, serialNumber, condition: condition || 'GOOD', notes },
    });
    res.status(201).json(asset);
  } catch (error) {
    if (error.code === 'P2002') return res.status(400).json({ error: 'Asset tag already exists' });
    res.status(500).json({ error: 'Server error' });
  }
};

const assignAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const { employeeId } = req.body;
    if (!employeeId) return res.status(400).json({ error: 'Employee is required' });

    // Tenant guard: the asset (if already assigned) and the target employee must
    // belong to the caller's company. Employee lookup is tenant-scoped, so a
    // cross-tenant employeeId returns null below.
    const existing = await prisma.asset.findUnique({
      where: { id },
      include: { assignedTo: { select: { id: true } } },
    });
    if (!existing) return res.status(404).json({ error: 'Asset not found' });
    if (existing.assignedToId && !(await employeeInTenant(existing.assignedToId))) {
      return res.status(403).json({ error: 'Access denied for this asset.' });
    }

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const asset = await prisma.asset.update({
      where: { id },
      data: { assignedToId: employeeId, assignedAt: new Date(), returnedAt: null, status: 'ASSIGNED', recoveryStatus: 'PENDING_RETURN' },
      include: { assignedTo: { select: { id: true, employeeId: true, firstName: true, lastName: true } } },
    });
    res.json(asset);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const returnAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const { condition, notes } = req.body;

    // Tenant guard: only act on an asset assigned to someone in the caller's company.
    const existing = await prisma.asset.findUnique({
      where: { id },
      select: { id: true, assignedToId: true },
    });
    if (!existing) return res.status(404).json({ error: 'Asset not found' });
    if (existing.assignedToId && !(await employeeInTenant(existing.assignedToId))) {
      return res.status(403).json({ error: 'Access denied for this asset.' });
    }

    const asset = await prisma.asset.update({
      where: { id },
      data: {
        assignedToId: null,
        returnedAt: new Date(),
        condition: condition || undefined,
        notes: notes !== undefined ? notes : undefined,
        status: 'AVAILABLE',
        recoveryStatus: 'RETURNED',
      },
    });
    res.json(asset);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { listAssets, createAsset, assignAsset, returnAsset };
