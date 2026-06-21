# Tenant Isolation: Defense-in-Depth with PostgreSQL RLS

Today, tenant isolation is enforced **in application code** — the Prisma client
extension in `src/config/database.js` auto-injects `companyId` into queries for
the tenant models. That works, but it's one forgotten query (or raw SQL) away
from a cross-tenant leak. PostgreSQL **Row-Level Security (RLS)** adds a second,
database-enforced layer so the DB itself refuses to return another tenant's rows.

This is a **staged rollout**, not a one-click change. Applied incorrectly, RLS
returns zero rows and looks like total data loss. Follow the steps below and
test in staging first.

## How it works
RLS policies filter rows by comparing `"companyId"` to a per-connection session
variable, `app.current_company_id`. The application must set that variable on
each connection/transaction to the authenticated user's company.

## Step 1 — App change: set the tenant GUC per request
The current pooled connection must carry the tenant id. Wrap tenant-scoped work
in a transaction that sets `app.current_company_id` with `SET LOCAL` (works with
the PgBouncer **transaction** pooler; a plain `SET` only persists in **session**
mode). Sketch for `src/config/database.js` / the auth layer:

```js
// After authenticate resolves req.user.companyId:
async function withTenant(companyId, work) {
  return prisma.$transaction(async (tx) => {
    // SUPER_ADMIN (cross-tenant) uses the literal 'ALL'.
    const value = companyId || 'ALL';
    await tx.$executeRawUnsafe(`SET LOCAL app.current_company_id = '${value}'`);
    return work(tx);
  });
}
```

Because every query in the request must run on that same `tx`, this is a real
refactor of the data-access layer (or use a connection-pinned approach). Budget
for it — it's the bulk of the effort.

## Step 2 — Apply the policies (staging first)
```bash
psql "$DIRECT_URL" -f backend/prisma/rls/enable_rls.sql      # apply
psql "$DIRECT_URL" -f backend/prisma/rls/disable_rls.sql     # rollback
```
The shipped policy is **fail-open when the GUC is unset** (rows visible, so the
existing app-level filter still governs) — safe to enable alongside the current
behavior. Once Step 1 reliably sets the GUC everywhere, tighten to **fail-closed**
by removing the `current_setting(...) IS NULL` branch in the policy.

## Step 3 — Verify
- As tenant A, confirm queries return only A's rows even if you deliberately omit
  the app-level `companyId` filter.
- Confirm `SET LOCAL app.current_company_id = 'ALL'` (super-admin path) sees all.
- Run the full test suite against the RLS-enabled DB.

## Caveats
- **Pooler mode matters.** `SET LOCAL` requires the statement to run inside the
  same transaction as the queries; the Supabase transaction pooler (6543) is fine
  with that. Plain `SET` needs the session pooler (5432) or a pinned connection.
- **Migrations / admin tools** connect without the GUC — keep them on a role with
  `BYPASSRLS` or run them before tightening to fail-closed.
- RLS is **defense in depth**, not a replacement for the app-level filter — keep
  both.
