const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const pulseController = require('../controllers/pulseController');

router.use(authenticate);

router.post('/', pulseController.publishPulseSurvey);
router.get('/active', pulseController.getActiveSurvey);
router.post('/respond', pulseController.submitResponse);
router.get('/summary', pulseController.getPulseSummary);

module.exports = router;
