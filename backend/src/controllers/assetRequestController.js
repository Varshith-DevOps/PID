const prisma = require('../config/database');

const createAssetRequest = async (req, res) => {
  try {
    const { assetType, reason } = req.body;

    const employee = await prisma.employee.findFirst({ where: { userId: req.user.id } });
    if (!employee) return res.status(404).json({ error: 'Employee profile not found.' });

    const request = await prisma.assetRequest.create({
      data: {
        companyId: employee.companyId,
        employeeId: employee.id,
        assetType,
        reason,
        status: 'PENDING'
      }
    });

    res.status(201).json(request);
  } catch (error) {
    console.error('[CREATE ASSET REQ ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const getEmployeeRequests = async (req, res) => {
  try {
    const employee = await prisma.employee.findFirst({ where: { userId: req.user.id } });
    if (!employee) return res.status(404).json({ error: 'Employee profile not found.' });

    const list = await prisma.assetRequest.findMany({
      where: { employeeId: employee.id },
      include: { asset: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json(list);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const getAdminRequests = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    if (!companyId) return res.status(400).json({ error: 'Company context missing.' });

    const list = await prisma.assetRequest.findMany({
      where: { companyId },
      include: {
        employee: { select: { firstName: true, lastName: true, jobTitle: true } },
        asset: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Also get list of AVAILABLE assets to choose from for assignment dropdown
    const availableAssets = await prisma.asset.findMany({
      where: { companyId, status: 'AVAILABLE' }
    });

    res.json({
      requests: list,
      availableAssets
    });
  } catch (error) {
    console.error('[GET ADMIN ASSETS ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const approveAssetRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { assetId, reviewerComments } = req.body;

    const request = await prisma.assetRequest.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ error: 'Asset request not found.' });

    let finalAssetId = assetId;

    // If an assetId was provided, update that asset status
    if (finalAssetId) {
      const asset = await prisma.asset.findUnique({ where: { id: finalAssetId } });
      if (!asset) return res.status(404).json({ error: 'Selected physical asset not found.' });
      if (asset.status !== 'AVAILABLE') return res.status(400).json({ error: 'Selected asset is not available.' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      // If no assetId provided, let's create a temporary virtual Asset to satisfy the assignment
      if (!finalAssetId) {
        const companyId = req.user.companyId || request.companyId;
        const newAsset = await tx.asset.create({
          data: {
            companyId,
            assetTag: `VIRTUAL-${Date.now()}`,
            name: `${request.assetType} Allocation`,
            category: request.assetType,
            status: 'ASSIGNED',
            assignedToId: request.employeeId,
            assignedAt: new Date()
          }
        });
        finalAssetId = newAsset.id;
      } else {
        await tx.asset.update({
          where: { id: finalAssetId },
          data: {
            status: 'ASSIGNED',
            assignedToId: request.employeeId,
            assignedAt: new Date()
          }
        });
      }

      const reqUpdate = await tx.assetRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          assetId: finalAssetId,
          reviewerComments: reviewerComments || 'Approved by system/HR'
        },
        include: { asset: true }
      });

      return reqUpdate;
    });

    res.json(updated);
  } catch (error) {
    console.error('[APPROVE ASSET REQ ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const rejectAssetRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewerComments } = req.body;

    const request = await prisma.assetRequest.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ error: 'Asset request not found.' });

    const updated = await prisma.assetRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewerComments: reviewerComments || 'Rejected by HR/Manager'
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('[REJECT ASSET REQ ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  createAssetRequest,
  getEmployeeRequests,
  getAdminRequests,
  approveAssetRequest,
  rejectAssetRequest
};
