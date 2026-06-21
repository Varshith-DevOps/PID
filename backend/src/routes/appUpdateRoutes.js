/**
 * @fileoverview Public mobile OTA update routes.
 * Intentionally unauthenticated: the Flutter app must be able to discover and
 * download a new build before (and after) a user signs in.
 * @module routes/appUpdateRoutes
 */

const express = require('express');
const router = express.Router();
const { getLatestVersion, downloadApk } = require('../controllers/appUpdateController');

router.get('/version', getLatestVersion);
router.get('/download', downloadApk);

module.exports = router;
