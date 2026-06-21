-- Rollback for enable_rls.sql — drops the tenant_isolation policy and disables RLS.
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'users','departments','employees','branches','locations','legal_entities',
    'policy_definitions','workflow_definitions','integration_connections',
    'compliance_obligations','subscriptions','payment_transactions'
  ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', t);
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;
