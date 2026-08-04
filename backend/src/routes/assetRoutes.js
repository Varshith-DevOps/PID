const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { rbacMiddleware, requireRole } = require('../rbac/rbacMiddleware');
const { 
  getAssetDashboard,
  listAssets, 
  createAsset, 
  assignAsset, 
  returnAsset,
  maintenanceAsset,
  retireAsset,
  getAssetHistory
} = require('../controllers/assetController');

router.use(authenticate);

router.get('/dashboard', requireRole('SUPER_ADMIN', 'ADMIN', 'HR'), getAssetDashboard);
router.get('/', rbacMiddleware('ASSETS', 'VIEW'), listAssets);
router.post('/', requireRole('SUPER_ADMIN', 'ADMIN', 'HR'), rbacMiddleware('ASSETS', 'CREATE'), createAsset);
router.put('/:id/assign', requireRole('SUPER_ADMIN', 'ADMIN', 'HR'), rbacMiddleware('ASSETS', 'EDIT'), assignAsset);
router.put('/:id/return', requireRole('SUPER_ADMIN', 'ADMIN', 'HR'), rbacMiddleware('ASSETS', 'EDIT'), returnAsset);
router.put('/:id/maintenance', requireRole('SUPER_ADMIN', 'ADMIN', 'HR'), rbacMiddleware('ASSETS', 'EDIT'), maintenanceAsset);
router.put('/:id/retire', requireRole('SUPER_ADMIN', 'ADMIN', 'HR'), rbacMiddleware('ASSETS', 'EDIT'), retireAsset);
router.get('/:id/history', requireRole('SUPER_ADMIN', 'ADMIN', 'HR'), rbacMiddleware('ASSETS', 'VIEW'), getAssetHistory);

module.exports = router;
