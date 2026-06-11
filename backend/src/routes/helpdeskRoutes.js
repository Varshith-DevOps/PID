const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { rbacMiddleware } = require('../rbac/rbacMiddleware');
const { listTickets, createTicket, updateTicket } = require('../controllers/helpdeskController');

router.use(authenticate);

router.get('/tickets', rbacMiddleware('HELPDESK', 'VIEW'), listTickets);
router.post('/tickets', rbacMiddleware('HELPDESK', 'CREATE'), createTicket);
router.put('/tickets/:id', rbacMiddleware('HELPDESK', 'EDIT'), updateTicket);

module.exports = router;
