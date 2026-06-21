/**
 * @fileoverview Generates prisma/schema.postgres.prisma from the canonical
 * SQLite schema by swapping ONLY the datasource block. The models stay a single
 * source of truth (no drift). Used for the Supabase/PostgreSQL environment while
 * local dev/test keep using the default SQLite schema.
 *
 * Usage: node scripts/make-postgres-schema.js
 */

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const OUT = path.join(__dirname, '..', 'prisma', 'schema.postgres.prisma');

const POSTGRES_DATASOURCE = `datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}`;

const source = fs.readFileSync(SRC, 'utf8');

// Replace the entire `datasource db { ... }` block.
const replaced = source.replace(/datasource\s+db\s*\{[^}]*\}/, POSTGRES_DATASOURCE);

if (replaced === source || !replaced.includes('provider  = "postgresql"')) {
  console.error('❌ Could not locate/replace the datasource block in schema.prisma');
  process.exit(1);
}

const banner = `// AUTO-GENERATED from schema.prisma by scripts/make-postgres-schema.js — do not edit.\n// Edit prisma/schema.prisma (the canonical models) and regenerate.\n\n`;
fs.writeFileSync(OUT, banner + replaced);
console.log('✅ Wrote prisma/schema.postgres.prisma (PostgreSQL datasource).');
