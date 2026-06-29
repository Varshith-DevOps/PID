/**
 * @fileoverview Pluggable file storage — local disk for dev/test, Amazon S3 for
 * production (multi-instance / ephemeral containers). The disk path is byte-for-
 * byte the legacy behaviour, so nothing changes unless AWS_S3_BUCKET is set.
 *
 * Env:
 *   AWS_S3_BUCKET            enable S3 when set
 *   AWS_REGION               S3 region
 *   AWS_S3_PREFIX            key prefix (default "uploads")
 *   AWS_S3_SIGNED_TTL_SECONDS  presigned download URL lifetime (default 300)
 * Credentials come from the standard AWS provider chain (IAM role on ECS/EC2).
 * @module services/fileStorage
 */

const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { ensureUploadDir, resolveStoredUpload } = require('../config/storage');

const BUCKET = process.env.AWS_S3_BUCKET || '';
const S3_ENABLED = !!BUCKET;
const S3_PREFIX = (process.env.AWS_S3_PREFIX || 'uploads').replace(/\/+$/, '');
const SIGNED_TTL = Number(process.env.AWS_S3_SIGNED_TTL_SECONDS) || 300;
const S3_REF = 's3://'; // stored in DB as `s3://<bucket-relative-key>`

let s3, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, getSignedUrl;
if (S3_ENABLED) {
  const c = require('@aws-sdk/client-s3');
  ({ PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = c);
  ({ getSignedUrl } = require('@aws-sdk/s3-request-presigner'));
  s3 = new c.S3Client({ region: process.env.AWS_REGION });
}

const isEnabled = () => S3_ENABLED;
const isS3Ref = (stored) => typeof stored === 'string' && stored.startsWith(S3_REF);
const keyOf = (stored) => stored.slice(S3_REF.length);
const randName = (original) => `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(original || '')}`;

/**
 * Build a multer storage engine. S3 → memoryStorage (buffer the file, then
 * persist() uploads it). Disk → the original diskStorage under uploads/<subdir>.
 */
function multerStorage(subdir = '') {
  if (S3_ENABLED) return multer.memoryStorage();
  const dir = ensureUploadDir(...(subdir ? [subdir] : []));
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename: (req, file, cb) => cb(null, randName(file.originalname)),
  });
}

/**
 * Persist an uploaded multer file and return { fileName, filePath } to store on
 * the record. Disk: the file is already written (use multer's path). S3: upload
 * the buffer (SSE-AES256) and store an `s3://key` reference.
 */
async function persist(file, subdir = '') {
  if (!file) return { fileName: null, filePath: null };
  if (!S3_ENABLED) return { fileName: file.filename, filePath: file.path };
  const key = `${S3_PREFIX}/${subdir ? subdir + '/' : ''}${randName(file.originalname)}`;
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
    ServerSideEncryption: 'AES256',
  }));
  return { fileName: path.basename(key), filePath: `${S3_REF}${key}` };
}

/**
 * Resolve a stored reference for download. S3 → { redirectUrl } (short-lived
 * presigned GET). Disk → { localPath } (validated under the upload root, or null).
 */
async function getDownload(stored) {
  if (isS3Ref(stored)) {
    const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: keyOf(stored) }), { expiresIn: SIGNED_TTL });
    return { redirectUrl: url };
  }
  return { localPath: resolveStoredUpload(stored) };
}

/** Delete the underlying object/file for a stored reference. */
async function remove(stored) {
  if (isS3Ref(stored)) {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: keyOf(stored) }));
    return;
  }
  const local = resolveStoredUpload(stored);
  if (local && fs.existsSync(local)) fs.unlinkSync(local);
}

module.exports = { isEnabled, isS3Ref, multerStorage, persist, getDownload, remove };
