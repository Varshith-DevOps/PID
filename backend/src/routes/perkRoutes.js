const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const perkController = require('../controllers/perkController');

router.use(authenticate);

router.get('/', perkController.getPerks);
router.post('/purchase', perkController.purchasePerk);
router.get('/purchases', perkController.getPurchases);

module.exports = router;
