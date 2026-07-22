const prisma = require('../config/database');
const { canAccessEmployee, getEmployeeScopeIds, isHr } = require('../services/accessControl');
const {
  archiveNotification,
  createNotificationRecord,
  markNotificationRead: markReadInService,
} = require('../services/notificationService');
const { seedDefaultTemplates } = require('../services/notificationTemplateService');

const NOTIFICATION_MODULES = [
  'GENERAL',
  'LEAVE',
  'ATTENDANCE',
  'PAYROLL',
  'RECRUITMENT',
  'LEARNING',
  'PERFORMANCE',
  'HELPDESK',
  'ASSETS',
  'EMPLOYEES',
];

const parsePositiveInt = (value, fallback, max = 100) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
};

const notificationAccessWhere = async (req, { employeeId, includeArchived = false } = {}) => {
  const where = {};
  if (employeeId) {
    if (!(await canAccessEmployee(req.user, employeeId))) {
      const error = new Error('Access denied for requested notifications');
      error.statusCode = 403;
      throw error;
    }
    where.OR = [{ employeeId }, { employeeId: null }];
  } else if (!isHr(req.user)) {
    const employeeIds = await getEmployeeScopeIds(req.user, { includeReports: false });
    where.OR = [{ employeeId: { in: employeeIds.length ? employeeIds : ['__no_employee_scope__'] } }, { employeeId: null }];
  }
  if (!includeArchived) where.archivedAt = null;
  return where;
};

const canAccessNotification = async (req, notification) => {
  if (!notification) return false;
  if (!notification.employeeId) return true;
  return canAccessEmployee(req.user, notification.employeeId);
};

const sendError = (res, error, fallback = 'Server error') => {
  const status = error.statusCode || error.status || 500;
  return res.status(status).json({ error: error.message || fallback });
};

const listNotifications = async (req, res) => {
  try {
    const { employeeId, unreadOnly } = req.query;
    const where = await notificationAccessWhere(req, { employeeId });
    if (unreadOnly === 'true') where.isRead = false;

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(notifications);
  } catch (error) {
    sendError(res, error);
  }
};

const listNotificationCenter = async (req, res) => {
  try {
    const { employeeId, unreadOnly, status, channel, search } = req.query;
    const page = parsePositiveInt(req.query.page, 1, 1000);
    const limit = parsePositiveInt(req.query.limit, 20, 100);
    const where = await notificationAccessWhere(req, { employeeId });
    if (unreadOnly === 'true') where.isRead = false;
    if (status) where.status = String(status).toUpperCase();
    if (channel) where.channel = String(channel).toUpperCase();
    if (search) {
      const q = String(search);
      where.AND = [
        ...(where.AND || []),
        { OR: [{ title: { contains: q } }, { message: { contains: q } }] },
      ];
    }

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: { logs: { orderBy: { createdAt: 'desc' }, take: 3 } },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { ...(await notificationAccessWhere(req, { employeeId })), isRead: false } }),
    ]);

    res.json({ notifications, total, unreadCount, page, limit });
  } catch (error) {
    sendError(res, error);
  }
};

const createNotification = async (req, res) => {
  try {
    if (!isHr(req.user)) return res.status(403).json({ error: 'Only HR/admin roles can create notifications' });
    const notification = await createNotificationRecord(req.body, { actor: req.user, req });
    res.status(201).json(notification);
  } catch (error) {
    sendError(res, error);
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    if (!(await canAccessNotification(req, notification))) {
      return res.status(403).json({ error: 'Access denied for notification' });
    }
    const updated = await markReadInService(id, { actor: req.user, req });
    res.json(updated);
  } catch (error) {
    sendError(res, error);
  }
};

const markAllNotificationsRead = async (req, res) => {
  try {
    const where = await notificationAccessWhere(req, { employeeId: req.body?.employeeId || req.query.employeeId });
    where.isRead = false;
    const notifications = await prisma.notification.findMany({ where, select: { id: true } });
    await Promise.all(notifications.map((item) => markReadInService(item.id, { actor: req.user, req })));
    res.json({ updated: notifications.length });
  } catch (error) {
    sendError(res, error);
  }
};

const deleteNotification = async (req, res) => {
  try {
    const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    if (!(await canAccessNotification(req, notification))) {
      return res.status(403).json({ error: 'Access denied for notification' });
    }
    const updated = await archiveNotification(req.params.id, { actor: req.user, req });
    res.json(updated);
  } catch (error) {
    sendError(res, error);
  }
};

const listNotificationHistory = async (req, res) => {
  try {
    const page = parsePositiveInt(req.query.page, 1, 1000);
    const limit = parsePositiveInt(req.query.limit, 25, 100);
    const where = await notificationAccessWhere(req, { includeArchived: true });
    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: { logs: { orderBy: { createdAt: 'desc' } } },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where }),
    ]);
    res.json({ notifications, total, page, limit });
  } catch (error) {
    sendError(res, error);
  }
};

const listTemplates = async (req, res) => {
  try {
    const templates = await prisma.notificationTemplate.findMany({
      orderBy: [{ event: 'asc' }, { channel: 'asc' }],
    });
    res.json(templates);
  } catch (error) {
    sendError(res, error);
  }
};

const createTemplate = async (req, res) => {
  try {
    const { name, event, subject, body, channel, active = true, locale = 'en-IN' } = req.body;
    if (!name || !event || !body) return res.status(400).json({ error: 'Name, event and body are required' });
    const template = await prisma.notificationTemplate.create({
      data: { name, event: String(event).toUpperCase(), subject, body, channel: String(channel || 'EMAIL').toUpperCase(), active: Boolean(active), locale },
    });
    res.status(201).json(template);
  } catch (error) {
    sendError(res, error);
  }
};

const updateTemplate = async (req, res) => {
  try {
    const { name, event, subject, body, channel, active, locale } = req.body;
    const template = await prisma.notificationTemplate.update({
      where: { id: req.params.id },
      data: {
        name,
        event: event ? String(event).toUpperCase() : undefined,
        subject,
        body,
        channel: channel ? String(channel).toUpperCase() : undefined,
        active: active === undefined ? undefined : Boolean(active),
        locale,
      },
    });
    res.json(template);
  } catch (error) {
    sendError(res, error);
  }
};

const deleteTemplate = async (req, res) => {
  try {
    await prisma.notificationTemplate.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    sendError(res, error);
  }
};

const seedTemplates = async (req, res) => {
  try {
    const templates = await seedDefaultTemplates(prisma, req.user.companyId || null);
    res.json({ templates, count: templates.length });
  } catch (error) {
    sendError(res, error);
  }
};

const listPreferences = async (req, res) => {
  try {
    const employeeId = req.query.employeeId || req.user.employeeId;
    if (!employeeId) return res.status(400).json({ error: 'Employee is required' });
    if (!(await canAccessEmployee(req.user, employeeId))) return res.status(403).json({ error: 'Access denied for preferences' });

    const existing = await prisma.notificationPreference.findMany({ where: { employeeId }, orderBy: { module: 'asc' } });
    const byModule = new Map(existing.map((item) => [item.module, item]));
    res.json(NOTIFICATION_MODULES.map((module) => byModule.get(module) || {
      id: null,
      employeeId,
      module,
      emailEnabled: true,
      smsEnabled: true,
      inAppEnabled: true,
    }));
  } catch (error) {
    sendError(res, error);
  }
};

const updatePreferences = async (req, res) => {
  try {
    const employeeId = req.body.employeeId || req.user.employeeId;
    if (!employeeId) return res.status(400).json({ error: 'Employee is required' });
    if (!(await canAccessEmployee(req.user, employeeId))) return res.status(403).json({ error: 'Access denied for preferences' });
    const preferences = Array.isArray(req.body.preferences) ? req.body.preferences : [req.body];
    const updated = [];
    for (const preference of preferences) {
      const module = String(preference.module || 'GENERAL').toUpperCase();
      updated.push(await prisma.notificationPreference.upsert({
        where: { employeeId_module: { employeeId, module } },
        create: {
          employeeId,
          module,
          emailEnabled: preference.emailEnabled !== false,
          smsEnabled: preference.smsEnabled !== false,
          inAppEnabled: preference.inAppEnabled !== false,
        },
        update: {
          emailEnabled: preference.emailEnabled === undefined ? undefined : Boolean(preference.emailEnabled),
          smsEnabled: preference.smsEnabled === undefined ? undefined : Boolean(preference.smsEnabled),
          inAppEnabled: preference.inAppEnabled === undefined ? undefined : Boolean(preference.inAppEnabled),
        },
      }));
    }
    res.json(updated);
  } catch (error) {
    sendError(res, error);
  }
};

const getSettings = async (req, res) => {
  try {
    const settings = await prisma.notificationSetting.findFirst({ where: { companyId: req.user.companyId || null } });
    res.json(settings || {
      smtpHost: '',
      smtpPort: 587,
      smtpUsername: '',
      smtpPassword: '',
      smtpSecure: false,
      smsProvider: 'MOCK',
      smsConfig: '{}',
      retryCount: 3,
      reminderTimings: '24h,1h,15m',
      emailSignature: '',
      companyLogo: '',
      senderName: 'PID HCMS',
    });
  } catch (error) {
    sendError(res, error);
  }
};

const updateSettings = async (req, res) => {
  try {
    const companyId = req.user.companyId || null;
    const data = {
      smtpHost: req.body.smtpHost || null,
      smtpPort: req.body.smtpPort ? Number(req.body.smtpPort) : null,
      smtpUsername: req.body.smtpUsername || null,
      smtpPassword: req.body.smtpPassword || null,
      smtpSecure: Boolean(req.body.smtpSecure),
      smsProvider: String(req.body.smsProvider || 'MOCK').toUpperCase(),
      smsConfig: req.body.smsConfig || '{}',
      retryCount: Number(req.body.retryCount || 3),
      reminderTimings: req.body.reminderTimings || '24h,1h,15m',
      emailSignature: req.body.emailSignature || null,
      companyLogo: req.body.companyLogo || null,
      senderName: req.body.senderName || null,
    };
    const existing = await prisma.notificationSetting.findFirst({ where: { companyId } });
    const settings = existing
      ? await prisma.notificationSetting.update({ where: { id: existing.id }, data })
      : await prisma.notificationSetting.create({ data: { companyId, ...data } });
    res.json(settings);
  } catch (error) {
    sendError(res, error);
  }
};

module.exports = {
  listNotifications,
  createNotification,
  markNotificationRead,
  listNotificationCenter,
  markAllNotificationsRead,
  deleteNotification,
  listNotificationHistory,
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  seedTemplates,
  listPreferences,
  updatePreferences,
  getSettings,
  updateSettings,
};
