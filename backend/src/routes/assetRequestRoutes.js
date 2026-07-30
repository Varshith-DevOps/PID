const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const assetRequestController = require('../controllers/assetRequestController');

router.use(authenticate);

router.post('/', assetRequestController.createAssetRequest);
router.get('/employee', assetRequestController.getEmployeeRequests);
router.get('/admin', assetRequestController.getAdminRequests);
router.put('/:id/approve', assetRequestController.approveAssetRequest);
router.put('/:id/reject', assetRequestController.rejectAssetRequest);

module.exports = router;
