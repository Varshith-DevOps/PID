const prisma = require('../config/database');
const { canAccessEmployee, getEmployeeScopeIds, isHr } = require('../services/accessControl');

const listNotifications = async (req, res) => {
  try {
    const { employeeId, unreadOnly } = req.query;
    const where = {};
    if (employeeId) {
      if (!(await canAccessEmployee(req.user, employeeId))) return res.status(403).json({ error: 'Access denied for requested notifications' });
      where.OR = [{ employeeId }, { employeeId: null }];
    } else if (!isHr(req.user)) {
      const employeeIds = await getEmployeeScopeIds(req.user, { includeReports: false });
      where.OR = [{ employeeId: { in: employeeIds } }, { employeeId: null }];
    }
    if (unreadOnly === 'true') where.isRead = false;

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const createNotification = async (req, res) => {
  try {
    if (!isHr(req.user)) return res.status(403).json({ error: 'Only HR/admin roles can create notifications' });
    const { employeeId, title, message, type, actionUrl } = req.body;
    if (!title || !message) return res.status(400).json({ error: 'Title and message are required' });
    const notification = await prisma.notification.create({
      data: { employeeId: employeeId || null, title, message, type: type || 'INFO', actionUrl },
    });
    res.status(201).json(notification);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    if (notification.employeeId && !(await canAccessEmployee(req.user, notification.employeeId))) {
      return res.status(403).json({ error: 'Access denied for notification' });
    }
    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { listNotifications, createNotification, markNotificationRead };
