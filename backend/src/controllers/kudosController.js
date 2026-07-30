const prisma = require('../config/database');

const resetAllowanceJIT = async (employeeId, tx = prisma) => {
  const employee = await tx.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return null;

  const now = new Date();
  const currentMonthStart = new Date();
  currentMonthStart.setUTCDate(1);
  currentMonthStart.setUTCHours(0, 0, 0, 0);

  if (!employee.lastKudosAllowanceReset || employee.lastKudosAllowanceReset < currentMonthStart) {
    return await tx.employee.update({
      where: { id: employeeId },
      data: {
        monthlyKudosAllowance: 100,
        lastKudosAllowanceReset: now
      }
    });
  }
  return employee;
};

const sendKudos = async (req, res) => {
  try {
    const { receiverId, points, message } = req.body;

    const sender = await prisma.employee.findFirst({ where: { userId: req.user.id } });
    if (!sender) {
      return res.status(404).json({ error: 'Sender employee profile not found.' });
    }

    if (sender.id === receiverId) {
      return res.status(400).json({ error: 'You cannot send kudos to yourself.' });
    }

    const pts = parseInt(points);
    if (isNaN(pts) || pts <= 0) {
      return res.status(400).json({ error: 'Points must be a positive integer.' });
    }

    const updatedSender = await resetAllowanceJIT(sender.id);

    if (updatedSender.monthlyKudosAllowance < pts) {
      return res.status(400).json({ error: `Insufficient kudos allowance. Remaining: ${updatedSender.monthlyKudosAllowance} coins.` });
    }

    const receiver = await prisma.employee.findUnique({ where: { id: receiverId } });
    if (!receiver) {
      return res.status(404).json({ error: 'Receiver employee profile not found.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id: sender.id },
        data: { monthlyKudosAllowance: { decrement: pts } }
      });

      await tx.employee.update({
        where: { id: receiverId },
        data: { kudosBalance: { increment: pts } }
      });

      return await tx.kudos.create({
        data: {
          companyId: sender.companyId,
          senderId: sender.id,
          receiverId,
          points: pts,
          message: message || 'Great job!'
        },
        include: {
          sender: { select: { firstName: true, lastName: true } },
          receiver: { select: { firstName: true, lastName: true } }
        }
      });
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('[SEND KUDOS ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const getReceivedKudos = async (req, res) => {
  try {
    const employee = await prisma.employee.findFirst({ where: { userId: req.user.id } });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const list = await prisma.kudos.findMany({
      where: { receiverId: employee.id },
      include: {
        sender: { select: { firstName: true, lastName: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const getSentKudos = async (req, res) => {
  try {
    const employee = await prisma.employee.findFirst({ where: { userId: req.user.id } });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const list = await prisma.kudos.findMany({
      where: { senderId: employee.id },
      include: {
        receiver: { select: { firstName: true, lastName: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const getKudosWall = async (req, res) => {
  try {
    const employee = await prisma.employee.findFirst({ where: { userId: req.user.id } });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const list = await prisma.kudos.findMany({
      where: { companyId: employee.companyId },
      include: {
        sender: { select: { firstName: true, lastName: true } },
        receiver: { select: { firstName: true, lastName: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    // Run reset JIT for the caller too, so their balance info is always accurate on fetching wall
    const updated = await resetAllowanceJIT(employee.id);

    res.json({
      wall: list,
      allowance: updated.monthlyKudosAllowance,
      balance: updated.kudosBalance
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  sendKudos,
  getReceivedKudos,
  getSentKudos,
  getKudosWall
};
