const express = require('express');
const router = express.Router();
const { submitContactRequest, getContactRequests } = require('../controllers/contactController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/', submitContactRequest);
router.get('/', authenticate, authorize('SUPER_ADMIN'), getContactRequests);

module.exports = router;
