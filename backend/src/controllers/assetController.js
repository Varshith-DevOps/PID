const prisma = require('../config/database');
const { canAccessEmployee, getEmployeeScopeIds, isHr, employeeInTenant } = require('../services/accessControl');

const getAssetDashboard = async (req, res) => {
  try {
    const where = {};
    if (!isHr(req.user)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const counts = await prisma.asset.groupBy({
      by: ['status'],
      _count: { _all: true }
    });

    const metrics = {
      TOTAL: 0,
      AVAILABLE: 0,
      ASSIGNED: 0,
      MAINTENANCE: 0,
      RETIRED: 0,
      LOST: 0
    };

    counts.forEach(c => {
      metrics[c.status] = c._count._all;
      metrics.TOTAL += c._count._all;
    });

    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

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
    const { assetTag, name, category, serialNumber, condition, notes, location, purchaseDate, purchaseCost, warrantyExpiry } = req.body;
    if (!assetTag || !name || !category) {
      return res.status(400).json({ error: 'Asset tag, name and category are required' });
    }

    const asset = await prisma.asset.create({
      data: { 
        assetTag, 
        name, 
        category, 
        serialNumber, 
        condition: condition || 'GOOD', 
        notes,
        location,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        purchaseCost: purchaseCost ? parseFloat(purchaseCost) : null,
        warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : null
      },
    });

    await prisma.assetHistory.create({
      data: {
        assetId: asset.id,
        action: 'CREATE',
        performedBy: req.user.id,
        details: 'Asset registered'
      }
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
    const { employeeId, assignedAt, notes } = req.body;
    if (!employeeId) return res.status(400).json({ error: 'Employee is required' });

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
      data: { 
        assignedToId: employeeId, 
        assignedAt: assignedAt ? new Date(assignedAt) : new Date(), 
        returnedAt: null, 
        status: 'ASSIGNED', 
        recoveryStatus: 'PENDING_RETURN' 
      },
      include: { assignedTo: { select: { id: true, employeeId: true, firstName: true, lastName: true } } },
    });

    await prisma.assetHistory.create({
      data: {
        assetId: asset.id,
        action: 'ASSIGN',
        performedBy: req.user.id,
        details: `Assigned to ${employee.firstName} ${employee.lastName}. Notes: ${notes || 'None'}`
      }
    });

    res.json(asset);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const returnAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const { condition, notes, returnedAt } = req.body;

    const existing = await prisma.asset.findUnique({
      where: { id },
      select: { id: true, assignedToId: true, assignedTo: { select: { firstName: true, lastName: true } } },
    });
    if (!existing) return res.status(404).json({ error: 'Asset not found' });
    if (existing.assignedToId && !(await employeeInTenant(existing.assignedToId))) {
      return res.status(403).json({ error: 'Access denied for this asset.' });
    }

    let nextStatus = 'AVAILABLE';
    if (condition === 'DAMAGED') nextStatus = 'MAINTENANCE';
    if (condition === 'LOST') nextStatus = 'LOST';

    const asset = await prisma.asset.update({
      where: { id },
      data: {
        assignedToId: null,
        returnedAt: returnedAt ? new Date(returnedAt) : new Date(),
        condition: condition || undefined,
        notes: notes !== undefined ? notes : undefined,
        status: nextStatus,
        recoveryStatus: 'RETURNED',
      },
    });

    const empName = existing.assignedTo ? `${existing.assignedTo.firstName} ${existing.assignedTo.lastName}` : 'Unknown';

    await prisma.assetHistory.create({
      data: {
        assetId: asset.id,
        action: 'RETURN',
        performedBy: req.user.id,
        details: `Returned by ${empName}. Condition: ${condition || 'GOOD'}. Notes: ${notes || 'None'}`
      }
    });

    res.json(asset);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

const maintenanceAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, cost, vendor, notes } = req.body;

    const existing = await prisma.asset.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Asset not found' });

    let status = 'MAINTENANCE';
    if (action === 'FINISH_MAINTENANCE') {
      status = 'AVAILABLE';
    }

    const asset = await prisma.asset.update({
      where: { id },
      data: { status, notes }
    });

    await prisma.assetHistory.create({
      data: {
        assetId: asset.id,
        action: action === 'FINISH_MAINTENANCE' ? 'RETURN_MAINTENANCE' : 'MAINTENANCE',
        performedBy: req.user.id,
        cost: cost ? parseFloat(cost) : null,
        details: `${action === 'FINISH_MAINTENANCE' ? 'Returned from maintenance' : 'Sent to maintenance'}. Vendor: ${vendor || 'N/A'}. Notes: ${notes || 'None'}`
      }
    });

    res.json(asset);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const retireAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, notes } = req.body;

    const existing = await prisma.asset.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Asset not found' });

    const asset = await prisma.asset.update({
      where: { id },
      data: { status: 'RETIRED', assignedToId: null, notes }
    });

    await prisma.assetHistory.create({
      data: {
        assetId: asset.id,
        action: 'RETIRE',
        performedBy: req.user.id,
        details: `Retired. Reason: ${reason}. Notes: ${notes || 'None'}`
      }
    });

    res.json(asset);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const getAssetHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const history = await prisma.assetHistory.findMany({
      where: { assetId: id },
      orderBy: { createdAt: 'desc' }
    });
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { 
  getAssetDashboard,
  listAssets, 
  createAsset, 
  assignAsset, 
  returnAsset, 
  maintenanceAsset, 
  retireAsset, 
  getAssetHistory 
};
