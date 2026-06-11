const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { rbacMiddleware, requireRole } = require('../rbac/rbacMiddleware');
const { listAssets, createAsset, assignAsset, returnAsset } = require('../controllers/assetController');

router.use(authenticate);

router.get('/', rbacMiddleware('ASSETS', 'VIEW'), listAssets);
router.post('/', requireRole('SUPER_ADMIN', 'ADMIN', 'HR'), rbacMiddleware('ASSETS', 'CREATE'), createAsset);
router.put('/:id/assign', requireRole('SUPER_ADMIN', 'ADMIN', 'HR'), rbacMiddleware('ASSETS', 'EDIT'), assignAsset);
router.put('/:id/return', requireRole('SUPER_ADMIN', 'ADMIN', 'HR'), rbacMiddleware('ASSETS', 'EDIT'), returnAsset);

module.exports = router;
