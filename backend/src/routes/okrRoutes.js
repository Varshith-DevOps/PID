const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const okrController = require('../controllers/okrController');

router.use(authenticate);

router.post('/objectives', okrController.createObjective);
router.post('/key-results', okrController.addKeyResult);
router.put('/key-results/:id', okrController.updateKeyResult);
router.get('/employee', okrController.getEmployeeOkrs);

module.exports = router;
