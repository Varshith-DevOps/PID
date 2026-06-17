const express = require('express');
const router = express.Router();
const {
  getPlans,
  getSubscription,
  checkout,
  confirmPayment,
  getTransactions
} = require('../controllers/billingController');
const { authenticate } = require('../middleware/auth');

router.get('/plans', getPlans);
router.get('/subscription', authenticate, getSubscription);
router.post('/checkout', authenticate, checkout);
router.post('/confirm-payment', authenticate, confirmPayment);
router.get('/transactions', authenticate, getTransactions);

module.exports = router;
