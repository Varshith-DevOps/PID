# Free Deployment Plan

Recommended quick path:

1. Keep Supabase as PostgreSQL.
2. Deploy `backend/` as a Vercel Express backend.
3. Deploy `frontend/` as a Vercel Next.js app.
4. Set `NEXT_PUBLIC_API_URL=/api` on the frontend.
5. Set `BACKEND_URL=https://<backend-project>.vercel.app` on the frontend so Next.js proxies `/api/*` to the backend.

This keeps browser API calls same-origin from the frontend domain, so the
HttpOnly session cookie and CSRF cookie continue to work with `SameSite=Lax`.
Netlify can host Next.js, but splitting frontend on Netlify and backend on
Vercel adds cross-site cookie/CORS complexity. Use Netlify only if you also add
a Netlify `/api/*` proxy or move to a custom shared parent domain.

## Backend Vercel Settings

Project root:

```text
backend
```

Build command:

```bash
npm run vercel-build
```

The build command generates Prisma Client from `prisma/schema.postgres.prisma`,
which is generated from the canonical SQLite schema with a PostgreSQL
datasource.

Environment variables:

```text
NODE_ENV=production
DATABASE_URL=<Supabase transaction pooler URL>
DIRECT_URL=<Supabase direct connection URL>
JWT_SECRET=<48 random bytes, base64url>
FIELD_ENCRYPTION_KEY=<32 random bytes, base64>
ALLOWED_ORIGINS=https://<frontend-project>.vercel.app
ALLOW_IN_MEMORY_LIMITERS=true
ALLOW_MOCK_BILLING=false
ALLOW_SALES_CUSTOM_PLANS=false
```

For a free quick deployment, `ALLOW_IN_MEMORY_LIMITERS=true` avoids adding Redis.
For a real production HRMS, use Redis and remove that exception.

Before first deploy, push the schema to Supabase from your machine:

```bash
cd backend
npm run db:pg:push
```

## Frontend Vercel Settings

Project root:

```text
frontend
```

Environment variables:

```text
NEXT_PUBLIC_API_URL=/api
BACKEND_URL=https://<backend-project>.vercel.app
```

## Known Free-Tier Limits

Vercel serverless is okay for a demo/MVP API, but HRMS workflows like uploads,
payroll exports, report generation, and bulk email can exceed free/serverless
constraints. Uploaded files on Vercel are written to `/tmp` for compatibility
and are not durable. Move documents, resumes, receipts, employee photos, and
generated PDFs to Supabase Storage or S3 before calling this production-ready.

For a stronger low-cost production backend, use a persistent Node host such as
Render, Fly.io, Railway, or a VPS, with Supabase Postgres, Redis, and object
storage.
