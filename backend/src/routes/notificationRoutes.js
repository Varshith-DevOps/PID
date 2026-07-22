const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { rbacMiddleware } = require('../rbac/rbacMiddleware');
const {
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
} = require('../controllers/notificationController');

router.use(authenticate);

router.get('/center', rbacMiddleware('NOTIFICATIONS', 'VIEW'), listNotificationCenter);
router.patch('/read-all', rbacMiddleware('NOTIFICATIONS', 'EDIT'), markAllNotificationsRead);
router.get('/history', rbacMiddleware('NOTIFICATIONS', 'VIEW'), listNotificationHistory);

router.get('/templates', rbacMiddleware('NOTIFICATIONS', 'VIEW'), listTemplates);
router.post('/templates', rbacMiddleware('NOTIFICATIONS', 'CREATE'), createTemplate);
router.post('/templates/seed-defaults', rbacMiddleware('NOTIFICATIONS', 'CREATE'), seedTemplates);
router.put('/templates/:id', rbacMiddleware('NOTIFICATIONS', 'EDIT'), updateTemplate);
router.delete('/templates/:id', rbacMiddleware('NOTIFICATIONS', 'DELETE'), deleteTemplate);

router.get('/preferences', rbacMiddleware('NOTIFICATIONS', 'VIEW'), listPreferences);
router.put('/preferences', rbacMiddleware('NOTIFICATIONS', 'EDIT'), updatePreferences);

router.get('/settings', rbacMiddleware('NOTIFICATIONS', 'VIEW'), getSettings);
router.put('/settings', rbacMiddleware('NOTIFICATIONS', 'EDIT'), updateSettings);

router.get('/', rbacMiddleware('NOTIFICATIONS', 'VIEW'), listNotifications);
router.post('/', rbacMiddleware('NOTIFICATIONS', 'CREATE'), createNotification);
router.patch('/:id/read', rbacMiddleware('NOTIFICATIONS', 'EDIT'), markNotificationRead);
router.put('/:id/read', rbacMiddleware('NOTIFICATIONS', 'EDIT'), markNotificationRead);
router.delete('/:id', rbacMiddleware('NOTIFICATIONS', 'EDIT'), deleteNotification);

module.exports = router;
