-- ============================================================================
-- Defense-in-depth tenant isolation via PostgreSQL Row-Level Security (RLS).
--
-- ⚠️  DO NOT run this without the app-side change that sets the GUC
--     `app.current_company_id` per connection/transaction (see
--     docs/08_RLS_tenant_isolation.md). Otherwise queries return 0 rows.
--
-- This is the FAIL-OPEN-WHEN-UNSET variant (safe to roll out alongside the
-- existing app-level Prisma tenant filter): when the GUC is unset, rows are
-- visible (app filter still applies); once the GUC is set, the DB enforces
-- isolation as a second layer. Tighten to fail-closed (remove the IS NULL
-- branch) only after the GUC is reliably set on every connection.
-- ============================================================================

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'users','departments','employees','branches','locations','legal_entities',
    'policy_definitions','workflow_definitions','integration_connections',
    'compliance_obligations','subscriptions','payment_transactions'
  ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING ('
      || 'current_setting(''app.current_company_id'', true) IS NULL '
      || 'OR current_setting(''app.current_company_id'', true) = ''ALL'' '
      || 'OR "companyId" = current_setting(''app.current_company_id'', true)'
      || ');', t);
  END LOOP;
END $$;
