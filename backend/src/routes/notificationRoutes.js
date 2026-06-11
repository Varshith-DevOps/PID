const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { rbacMiddleware } = require('../rbac/rbacMiddleware');
const { listNotifications, createNotification, markNotificationRead } = require('../controllers/notificationController');

router.use(authenticate);

router.get('/', rbacMiddleware('NOTIFICATIONS', 'VIEW'), listNotifications);
router.post('/', rbacMiddleware('NOTIFICATIONS', 'CREATE'), createNotification);
router.put('/:id/read', rbacMiddleware('NOTIFICATIONS', 'EDIT'), markNotificationRead);

module.exports = router;
