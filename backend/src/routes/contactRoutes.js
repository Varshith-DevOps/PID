const express = require('express');
const router = express.Router();
const { submitContactRequest, getContactRequests, updateContactRequest, deleteContactRequest } = require('../controllers/contactController');
const { authenticate, authorize } = require('../middleware/auth');
const { publicFormLimiter } = require('../middleware/rateLimit');
const { validate } = require('../middleware/validate');
const { contactSchema } = require('../schemas/publicSchemas');

router.post('/', publicFormLimiter, validate(contactSchema), submitContactRequest);
router.get('/', authenticate, authorize('SUPER_ADMIN'), getContactRequests);
router.put('/:id', authenticate, authorize('SUPER_ADMIN'), updateContactRequest);
router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), deleteContactRequest);

module.exports = router;
