const express = require('express');
const {
  getPublicOffer,
  downloadPublicOffer,
  acceptPublicOffer,
  rejectPublicOffer,
} = require('../controllers/recruitmentController');
const { publicApplicationLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.get('/offers/:token', publicApplicationLimiter, getPublicOffer);
router.get('/offers/:token/download', publicApplicationLimiter, downloadPublicOffer);
router.post('/offers/:token/accept', publicApplicationLimiter, acceptPublicOffer);
router.post('/offers/:token/reject', publicApplicationLimiter, rejectPublicOffer);

module.exports = router;
