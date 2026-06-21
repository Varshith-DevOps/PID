# PostgreSQL Migration Runbook

The app ships configured for **SQLite** (`backend/prisma/dev.db`) for fast local
development. SQLite is **not** suitable for production (no concurrency, no row-level
security, no replication/PITR). This runbook describes the cutover to **PostgreSQL**,
the supported production database.

> The cutover changes the Prisma `datasource` provider, which is a static value in
> `schema.prisma` (Prisma does not allow `env()` for the provider). Validate every
> step against a real PostgreSQL instance in staging before production.

## 1. Stand up PostgreSQL

Local/staging via the provided compose file:

```bash
docker compose up -d db        # postgres:16 on localhost:5432 (user/pass/db = hrms)
```

Production: use a managed instance (AWS RDS, Azure Database, Cloud SQL) with
automated backups + point-in-time recovery enabled.

## 2. Point the app at PostgreSQL

In `backend/.env` (see `backend/.env.example`):

```env
DATABASE_URL="postgresql://hrms:hrms@localhost:5432/hrms?schema=public"
JWT_SECRET="<32+ char generated secret>"
FIELD_ENCRYPTION_KEY="<32-byte base64 key>"   # required in production
```

## 3. Switch the Prisma provider

In `backend/prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"   // was: "sqlite"
  url      = env("DATABASE_URL")
}
```

## 4. Initialize migration history (replaces `prisma db push`)

The project currently uses `prisma db push` (no migration history). Adopt
migrations for production:

```bash
cd backend
npx prisma migrate dev --name init      # creates prisma/migrations + applies to Postgres
npx prisma generate
```

For production deploys, use the non-interactive apply:

```bash
npx prisma migrate deploy
```

Replace any `npm run prisma:push` step in deploy/CI with `prisma migrate deploy`.

## 5. Move existing data (only if migrating live SQLite data)

For a fresh environment, run `npm run seed`. To carry over existing SQLite rows,
export per table and import into Postgres (e.g. via a one-off Node script using two
Prisma clients, or `sqlite3` CSV export + `\copy`). Preserve insertion order so
foreign keys resolve (companies → users/employees → dependent records).

## 6. Encrypt PII at rest

With `FIELD_ENCRYPTION_KEY` set, new writes are encrypted automatically. Backfill
existing rows once:

```bash
FIELD_ENCRYPTION_KEY="<key>" node scripts/encrypt-backfill.js
```

(Idempotent — safe to re-run; already-encrypted rows are skipped.)

## 7. Verify

```bash
cd backend
npm test                       # suite is provider-agnostic (Prisma)
npx prisma studio              # spot-check rows; PAN/Aadhaar/accountNumber/mfaSecret show ciphertext
node -e "require('./src/index')"   # boot check
```

In production, confirm the server **refuses to boot** without a strong `JWT_SECRET`
and a valid 32-byte `FIELD_ENCRYPTION_KEY` (see `src/config/secrets.js`).

## Supabase specifics

Supabase is managed PostgreSQL, so the steps above apply, with these differences
(see `backend/.env.supabase.example`):

1. **Two URLs.** Set both in `.env` and reference them in `schema.prisma`:
   ```prisma
   datasource db {
     provider  = "postgresql"
     url       = env("DATABASE_URL")   // transaction pooler, port 6543, ?pgbouncer=true
     directUrl = env("DIRECT_URL")     // direct, port 5432 — used by Migrate
   }
   ```
   Prisma Migrate cannot run DDL through the PgBouncer transaction pooler, so it
   uses `directUrl`; the running app uses the pooled `url`.
2. **SSL.** Supabase requires TLS — keep `?sslmode=require` on both URLs.
3. **Apply schema + seed:**
   ```bash
   cd backend
   npx prisma migrate deploy      # or: npx prisma db push   (first-time, no history)
   npm run seed                   # optional demo data
   FIELD_ENCRYPTION_KEY="<key>" node scripts/encrypt-backfill.js   # if migrating existing PII
   ```
4. **Auth:** this app has its own JWT auth — you do NOT need Supabase Auth. Use
   Supabase purely as the database (and optionally Storage, see below).
5. **Storage (optional):** to move file uploads off the local filesystem, the
   `multer` disk storage in upload routes would be swapped for the Supabase
   Storage SDK — a separate change, not required just to use the database.
6. **Connection limit (required).** Prisma's default pool size (`CPU*2+1`) can
   exceed the Supabase pooler cap (15 on the free tier), causing
   `FATAL: (EMAXCONNSESSION) max clients reached`. Always set `connection_limit`
   on `DATABASE_URL` (e.g. `&connection_limit=10`) comfortably under your plan's
   pool size. The app's dashboard/platform endpoints issue ~10 parallel queries
   per request, so leave headroom.
7. **Prepared statements:** if you see "prepared statement already exists" on the
   transaction pooler, confirm `pgbouncer=true` is present on `DATABASE_URL`.

## Notes / gotchas

- Keep dev on SQLite by leaving the provider unchanged on local branches, or use a
  separate `schema.postgres.prisma` and `--schema` flag if you need both regularly.
- After switching providers, delete the SQLite `dev.db` artifacts from any image.
- Add connection pooling (PgBouncer / Prisma Accelerate / RDS Proxy) before scaling
  out backend instances.
