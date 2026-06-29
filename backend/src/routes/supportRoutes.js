const express = require('express');
const router = express.Router();
const { myAssignments } = require('../controllers/supportStaffController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// A support user's own assigned tenants (the customers they may view read-only).
router.get('/my-assignments', authorize('SUPPORT'), myAssignments);

module.exports = router;
