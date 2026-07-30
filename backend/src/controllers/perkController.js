const prisma = require('../config/database');

const getPerks = async (req, res) => {
  try {
    const employee = await prisma.employee.findFirst({ where: { userId: req.user.id } });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const list = await prisma.perkStoreItem.findMany({
      where: { companyId: employee.companyId, isActive: true },
      orderBy: { cost: 'asc' }
    });
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const purchasePerk = async (req, res) => {
  try {
    const { perkItemId } = req.body;

    const employee = await prisma.employee.findFirst({ where: { userId: req.user.id } });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const item = await prisma.perkStoreItem.findUnique({ where: { id: perkItemId } });
    if (!item || !item.isActive) {
      return res.status(404).json({ error: 'Perk item not found or inactive.' });
    }

    if (item.stock === 0) {
      return res.status(400).json({ error: 'Item is out of stock.' });
    }

    if (employee.kudosBalance < item.cost) {
      return res.status(400).json({ error: `Insufficient kudos balance. Required: ${item.cost}, Available: ${employee.kudosBalance}` });
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id: employee.id },
        data: { kudosBalance: { decrement: item.cost } }
      });

      if (item.stock !== -1) {
        await tx.perkStoreItem.update({
          where: { id: item.id },
          data: { stock: { decrement: 1 } }
        });
      }

      return await tx.perkPurchase.create({
        data: {
          companyId: employee.companyId,
          employeeId: employee.id,
          perkItemId: item.id,
          pointsSpent: item.cost,
          status: 'PENDING'
        },
        include: {
          perkItem: true
        }
      });
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('[PURCHASE PERK ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const getPurchases = async (req, res) => {
  try {
    const employee = await prisma.employee.findFirst({ where: { userId: req.user.id } });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const list = await prisma.perkPurchase.findMany({
      where: { employeeId: employee.id },
      include: {
        perkItem: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getPerks,
  purchasePerk,
  getPurchases
};
