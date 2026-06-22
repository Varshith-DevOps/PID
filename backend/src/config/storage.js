/**
 * @fileoverview Upload path helpers.
 *
 * Vercel serverless functions can only write to the OS temp directory. Local
 * development keeps using backend/uploads. Set UPLOAD_ROOT to override either.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

function getUploadRoot() {
  return path.resolve(
    process.env.UPLOAD_ROOT ||
    (process.env.VERCEL ? path.join(os.tmpdir(), 'hrms-uploads') : path.join(__dirname, '../../uploads'))
  );
}

function getUploadDir(...segments) {
  return path.join(getUploadRoot(), ...segments);
}

function ensureUploadDir(...segments) {
  const dir = getUploadDir(...segments);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function resolveStoredUpload(storedPath) {
  if (!storedPath) return null;
  const uploadRoot = getUploadRoot();
  const normalized = String(storedPath).replace(/\\/g, '/').replace(/^\/uploads\//, '');
  const resolved = path.isAbsolute(normalized)
    ? path.resolve(normalized)
    : path.resolve(uploadRoot, normalized);
  return resolved === uploadRoot || resolved.startsWith(uploadRoot + path.sep) ? resolved : null;
}

module.exports = {
  getUploadRoot,
  getUploadDir,
  ensureUploadDir,
  resolveStoredUpload,
};
