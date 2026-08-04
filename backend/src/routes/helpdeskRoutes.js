const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const helpdeskController = require('../controllers/helpdeskController');

router.use(authenticate);

router.post('/', helpdeskController.createTicket);
router.post('/tickets', helpdeskController.createTicket);
router.get('/tickets', helpdeskController.getTickets);
router.get('/employee', helpdeskController.getEmployeeTickets);
router.get('/admin', helpdeskController.getAdminTickets);
router.put('/:id/resolve', helpdeskController.resolveTicket);

module.exports = router;
