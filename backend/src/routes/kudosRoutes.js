const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const kudosController = require('../controllers/kudosController');

router.use(authenticate);

router.post('/', kudosController.sendKudos);
router.get('/received', kudosController.getReceivedKudos);
router.get('/sent', kudosController.getSentKudos);
router.get('/wall', kudosController.getKudosWall);

module.exports = router;
