const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const appraisalController = require('../controllers/appraisalController');

router.use(authenticate);

router.post('/self-evaluation', appraisalController.submitSelfEvaluation);
router.post('/manager-evaluation', appraisalController.submitManagerEvaluation);
router.get('/9box-analytics', appraisalController.get9BoxAnalytics);
router.post('/9box-override/:id', appraisalController.override9BoxPlacement);

module.exports = router;
