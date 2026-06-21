/**
 * @fileoverview Mobile app over-the-air (OTA) update controller.
 * Serves a public version manifest the Flutter app polls on launch, plus the
 * signed release APK for download. No authentication is required so the app can
 * check for (and apply) updates even before a user logs in.
 * @module controllers/appUpdateController
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Directory that holds the release artefacts:
 *   - app-version.json  (the manifest, editable on each release)
 *   - <apkFileName>.apk (the signed release build)
 * Overridable with APP_RELEASE_DIR for deployments that store builds elsewhere.
 */
const RELEASE_DIR = process.env.APP_RELEASE_DIR
  ? path.resolve(process.env.APP_RELEASE_DIR)
  : path.join(__dirname, '../../app-release');

const MANIFEST_PATH = path.join(RELEASE_DIR, 'app-version.json');

/** Read and parse the release manifest, or null when it is missing/invalid. */
function readManifest() {
  try {
    const raw = fs.readFileSync(MANIFEST_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    logger.error('App update manifest unavailable', { error: err.message, path: MANIFEST_PATH });
    return null;
  }
}

/** Build the absolute public URL of the APK download endpoint. */
function buildApkUrl(req) {
  // Honour reverse-proxy headers so the link works behind nginx / load balancers.
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}/api/app/download`;
}

/**
 * GET /api/app/version
 * Public manifest describing the latest available Android build. The mobile app
 * compares `latestVersionCode` against its own build number to decide whether to
 * prompt (or force, when `mandatory`/`minSupportedVersionCode`) an update.
 */
const getLatestVersion = (req, res) => {
  const manifest = readManifest();
  if (!manifest) {
    return res.status(503).json({ error: 'Update channel is not configured yet.' });
  }

  const apkPath = path.join(RELEASE_DIR, manifest.apkFileName || '');
  const apkAvailable = manifest.apkFileName ? fs.existsSync(apkPath) : false;
  const sizeBytes = apkAvailable ? fs.statSync(apkPath).size : 0;

  res.json({
    latestVersion: manifest.latestVersion,
    latestVersionCode: manifest.latestVersionCode,
    minSupportedVersionCode: manifest.minSupportedVersionCode ?? 0,
    mandatory: Boolean(manifest.mandatory),
    releaseNotes: manifest.releaseNotes || [],
    releasedAt: manifest.releasedAt || null,
    apkUrl: apkAvailable ? buildApkUrl(req) : null,
    apkAvailable,
    sizeBytes,
  });
};

/**
 * GET /api/app/download
 * Streams the latest release APK with headers that let Android download managers
 * resume and recognise the package.
 */
const downloadApk = (req, res) => {
  const manifest = readManifest();
  if (!manifest || !manifest.apkFileName) {
    return res.status(404).json({ error: 'No release build is available.' });
  }

  const apkPath = path.join(RELEASE_DIR, manifest.apkFileName);
  if (!fs.existsSync(apkPath)) {
    logger.error('Requested APK missing from release dir', { apkPath });
    return res.status(404).json({ error: 'Release build not found on server.' });
  }

  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', `attachment; filename="${manifest.apkFileName}"`);
  res.setHeader('Cache-Control', 'no-cache');
  res.download(apkPath, manifest.apkFileName, (err) => {
    if (err && !res.headersSent) {
      logger.error('APK download failed', { error: err.message });
      res.status(500).end();
    }
  });
};

module.exports = { getLatestVersion, downloadApk };
