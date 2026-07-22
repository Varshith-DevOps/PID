const prisma = require('../config/database');
const { sendMail, sanitizeEmailError } = require('./emailService');
const { sendSms, providerName } = require('./smsProviderService');
const { renderTemplate, resolveTemplate } = require('./notificationTemplateService');
const logger = require('../utils/logger');

const CHANNELS = new Set(['EMAIL', 'SMS', 'IN_APP']);
const DEFAULT_RETRY_COUNT = 3;
const retryTimers = new Set();

const parseJson = (value, fallback = {}) => {
  if (!value) return fallback;
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return fallback;
  }
};

const asChannel = (channel) => {
  const normalized = String(channel || 'IN_APP').trim().toUpperCase();
  return CHANNELS.has(normalized) ? normalized : 'IN_APP';
};

const serialize = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
};

const getCompanySettings = async (companyId) => {
  const settings = companyId
    ? await prisma.notificationSetting.findUnique({ where: { companyId } })
    : null;
  return settings || {
    retryCount: Number(process.env.NOTIFICATION_RETRY_COUNT || DEFAULT_RETRY_COUNT),
    smsProvider: process.env.SMS_PROVIDER || 'MOCK',
    reminderTimings: process.env.NOTIFICATION_REMINDER_TIMINGS || '24h,1h,15m',
    senderName: process.env.SMTP_FROM_NAME || 'PID HCMS',
  };
};

const getPreference = async ({ employeeId, module }) => {
  if (!employeeId) return null;
  return prisma.notificationPreference.findFirst({
    where: { employeeId, module: module || 'GENERAL' },
  });
};

const channelAllowedByPreference = (preference, channel) => {
  if (!preference) return true;
  if (channel === 'EMAIL') return preference.emailEnabled;
  if (channel === 'SMS') return preference.smsEnabled;
  return preference.inAppEnabled;
};

const enrichRecipient = async (payload) => {
  if (!payload.employeeId) return payload;
  const employee = await prisma.employee.findUnique({
    where: { id: payload.employeeId },
    select: { id: true, email: true, phone: true, firstName: true, lastName: true, companyId: true },
  });
  if (!employee) return payload;
  return {
    ...payload,
    recipientType: payload.recipientType || 'EMPLOYEE',
    recipientId: payload.recipientId || employee.id,
    recipientEmail: payload.recipientEmail || employee.email || null,
    recipientPhone: payload.recipientPhone || employee.phone || null,
    companyId: payload.companyId || employee.companyId || null,
    variables: {
      EmployeeName: `${employee.firstName} ${employee.lastName}`.trim(),
      ...(payload.variables || {}),
    },
  };
};

const logNotificationAudit = async ({ actor, action, notification, req }) => {
  try {
    await prisma.auditLog.create({
      data: {
        userId: actor?.id || null,
        userEmail: actor?.email || null,
        actorRole: actor?.role || null,
        category: 'TENANT',
        action,
        entity: 'Notification',
        entityId: notification?.id || null,
        newDetails: JSON.stringify({
          title: notification?.title,
          channel: notification?.channel,
          status: notification?.status,
          recipientType: notification?.recipientType,
          recipientId: notification?.recipientId,
        }),
        ipAddress: req?.ip || null,
      },
    });
  } catch (error) {
    logger.warn('Notification audit log failed', { error: error.message });
  }
};

const createDeliveryLog = async ({ notificationId, provider, status, response, retryCount }) => {
  try {
    return await prisma.notificationLog.create({
      data: {
        notificationId,
        provider,
        status,
        response: serialize(response),
        retryCount: retryCount || 0,
      },
    });
  } catch (error) {
    logger.error('Notification delivery log failed', { notificationId, error: error.message });
    return null;
  }
};

const updateNotificationStatus = async (notificationId, status, data = {}) => {
  return prisma.notification.update({
    where: { id: notificationId },
    data: {
      status,
      ...(status === 'SENT' || status === 'DELIVERED' ? { sentAt: data.sentAt || new Date() } : {}),
      ...(status === 'DELIVERED' ? { deliveredAt: data.deliveredAt || new Date() } : {}),
      ...(status === 'READ' ? { isRead: true, read: true, readAt: data.readAt || new Date() } : {}),
      ...(status === 'ARCHIVED' ? { archivedAt: data.archivedAt || new Date() } : {}),
    },
  });
};

const deliverNotification = async (notificationId, attempt = 0) => {
  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notification || notification.status === 'ARCHIVED' || notification.archivedAt) return null;
  if (notification.scheduledAt && new Date(notification.scheduledAt) > new Date()) {
    scheduleDelivery(notification.id, new Date(notification.scheduledAt).getTime() - Date.now());
    return notification;
  }

  const settings = await getCompanySettings(notification.companyId);
  const maxRetries = Math.max(0, Number(settings.retryCount ?? DEFAULT_RETRY_COUNT));
  const provider = notification.channel === 'SMS' ? providerName(settings) : notification.channel === 'EMAIL' ? 'SMTP' : 'IN_APP';

  try {
    if (notification.channel === 'EMAIL') {
      if (!notification.recipientEmail) {
        const error = new Error('Recipient email is missing.');
        error.code = 'INVALID_RECIPIENT';
        throw error;
      }
      await sendMail({
        to: notification.recipientEmail,
        subject: notification.title,
        html: notification.message,
        text: notification.message.replace(/<[^>]+>/g, ' '),
        smtpConfig: settings.smtpHost ? {
          smtpHost: settings.smtpHost,
          smtpPort: settings.smtpPort,
          smtpUsername: settings.smtpUsername,
          smtpPassword: settings.smtpPassword,
          smtpSecure: settings.smtpSecure,
          senderName: settings.senderName,
        } : undefined,
      });
      await createDeliveryLog({ notificationId, provider, status: 'SENT', response: { attempt }, retryCount: attempt });
      return updateNotificationStatus(notificationId, 'SENT');
    }

    if (notification.channel === 'SMS') {
      if (!notification.recipientPhone) {
        const error = new Error('Recipient phone number is missing.');
        error.code = 'INVALID_RECIPIENT';
        throw error;
      }
      const result = await sendSms({ to: notification.recipientPhone, message: notification.message, settings });
      await createDeliveryLog({ notificationId, provider, status: 'SENT', response: result, retryCount: attempt });
      return updateNotificationStatus(notificationId, 'SENT');
    }

    await createDeliveryLog({ notificationId, provider, status: 'DELIVERED', response: { channel: 'IN_APP' }, retryCount: attempt });
    return updateNotificationStatus(notificationId, 'DELIVERED');
  } catch (error) {
    const response = notification.channel === 'EMAIL' ? sanitizeEmailError(error) : error.message;
    await createDeliveryLog({ notificationId, provider, status: 'FAILED', response, retryCount: attempt });
    if (attempt < maxRetries) {
      const delay = Math.min(60000, 1000 * 2 ** attempt);
      scheduleDelivery(notificationId, delay, attempt + 1);
      return updateNotificationStatus(notificationId, 'QUEUED');
    }
    return updateNotificationStatus(notificationId, 'FAILED');
  }
};

const scheduleDelivery = (notificationId, delay = 0, attempt = 0) => {
  const timer = setTimeout(() => {
    retryTimers.delete(timer);
    deliverNotification(notificationId, attempt).catch((error) => {
      logger.error('Notification delivery failed outside request lifecycle', { notificationId, error: error.message });
    });
  }, Math.max(0, delay));
  timer.unref?.();
  retryTimers.add(timer);
};

const createNotificationRecord = async (payload, options = {}) => {
  const enriched = await enrichRecipient(payload);
  const channel = asChannel(enriched.channel);
  const module = String(enriched.module || enriched.type || 'GENERAL').toUpperCase();
  const preference = await getPreference({ employeeId: enriched.employeeId, module });
  const allowed = channelAllowedByPreference(preference, channel);

  const companyId = enriched.companyId ?? options.actor?.companyId ?? null;
  const template = enriched.event
    ? await resolveTemplate(prisma, { companyId, event: enriched.event, channel, locale: enriched.locale || 'en-IN' })
    : null;
  const rendered = template ? renderTemplate(template, enriched.variables || {}) : {};

  const title = rendered.subject || enriched.subject || enriched.title;
  const message = rendered.body || enriched.body || enriched.message;
  if (!title || !message) {
    const error = new Error('Notification title and message are required.');
    error.statusCode = 400;
    throw error;
  }

  const notification = await prisma.notification.create({
    data: {
      companyId,
      employeeId: enriched.employeeId || null,
      title,
      message,
      type: String(enriched.type || enriched.event || 'INFO').toUpperCase(),
      channel,
      recipientType: enriched.recipientType || (enriched.employeeId ? 'EMPLOYEE' : 'BROADCAST'),
      recipientId: enriched.recipientId || enriched.employeeId || null,
      recipientEmail: enriched.recipientEmail || null,
      recipientPhone: enriched.recipientPhone || null,
      status: allowed ? 'QUEUED' : 'ARCHIVED',
      isRead: false,
      read: false,
      metadata: serialize({
        ...(parseJson(enriched.metadata, enriched.metadata || {})),
        module,
        event: enriched.event || null,
        preferenceSkipped: !allowed,
      }),
      actionUrl: enriched.actionUrl || null,
      scheduledAt: enriched.scheduledAt ? new Date(enriched.scheduledAt) : null,
      archivedAt: allowed ? null : new Date(),
    },
  });

  await logNotificationAudit({ actor: options.actor, action: 'NOTIFICATION_CREATED', notification, req: options.req });
  if (allowed) {
    scheduleDelivery(notification.id, notification.scheduledAt ? new Date(notification.scheduledAt).getTime() - Date.now() : 0);
  } else {
    await createDeliveryLog({ notificationId: notification.id, provider: channel, status: 'SKIPPED', response: 'Disabled by employee preference' });
  }
  return notification;
};

const markNotificationRead = async (notificationId, options = {}) => {
  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true, read: true, status: 'READ', readAt: new Date() },
  });
  await logNotificationAudit({ actor: options.actor, action: 'NOTIFICATION_READ', notification: updated, req: options.req });
  return updated;
};

const archiveNotification = async (notificationId, options = {}) => {
  const updated = await updateNotificationStatus(notificationId, 'ARCHIVED');
  await logNotificationAudit({ actor: options.actor, action: 'NOTIFICATION_ARCHIVED', notification: updated, req: options.req });
  return updated;
};

const enqueueDueNotifications = async () => {
  const due = await prisma.notification.findMany({
    where: {
      status: 'QUEUED',
      OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
    },
    take: 50,
    orderBy: { createdAt: 'asc' },
  });
  due.forEach((notification) => scheduleDelivery(notification.id, 0));
  return due.length;
};

module.exports = {
  asChannel,
  createNotificationRecord,
  deliverNotification,
  markNotificationRead,
  archiveNotification,
  enqueueDueNotifications,
  getCompanySettings,
};
