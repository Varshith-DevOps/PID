/**
 * @fileoverview One-time backfill: encrypt existing plaintext PII at rest.
 *
 * Run AFTER setting FIELD_ENCRYPTION_KEY. Idempotent — rows already in ciphertext
 * format are skipped, so it is safe to re-run. Uses a raw Prisma client so reads
 * are not transparently decrypted and writes are not double-handled.
 *
 * Usage:
 *   FIELD_ENCRYPTION_KEY="<32-byte base64>" node scripts/encrypt-backfill.js
 */

const { PrismaClient } = require('@prisma/client');
const { encrypt, isEncrypted, ENCRYPTED_FIELDS, isEncryptionEnabled } = require('../src/services/encryption');

const prisma = new PrismaClient();

// Prisma delegate name for each model that has encrypted fields.
const MODEL_DELEGATE = {
  User: 'user',
  Employee: 'employee',
  BankDetails: 'bankDetails',
};

async function backfillModel(model) {
  const fields = ENCRYPTED_FIELDS[model];
  const delegate = MODEL_DELEGATE[model];
  if (!fields || !delegate) return { model, scanned: 0, updated: 0 };

  const rows = await prisma[delegate].findMany();
  let updated = 0;

  for (const row of rows) {
    const data = {};
    for (const field of fields) {
      const val = row[field];
      if (typeof val === 'string' && val !== '' && !isEncrypted(val)) {
        data[field] = encrypt(val);
      }
    }
    if (Object.keys(data).length > 0) {
      await prisma[delegate].update({ where: { id: row.id }, data });
      updated++;
    }
  }
  return { model, scanned: rows.length, updated };
}

async function main() {
  if (!isEncryptionEnabled()) {
    console.error('❌ FIELD_ENCRYPTION_KEY is not configured (or not 32 bytes). Set it and re-run.');
    process.exit(1);
  }
  console.log('🔐 Backfilling field-level encryption for existing rows...');
  for (const model of Object.keys(ENCRYPTED_FIELDS)) {
    const res = await backfillModel(model);
    console.log(`  ${res.model}: scanned ${res.scanned}, encrypted ${res.updated}`);
  }
  console.log('✅ Backfill complete.');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
