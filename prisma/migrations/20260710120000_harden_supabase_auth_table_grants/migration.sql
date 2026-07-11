-- Tighten Data API table privileges for the Supabase Auth-native tables.
-- RLS policies already restrict rows to the owning authenticated user; this
-- additionally removes direct anon/PUBLIC SELECT grants so these tables are
-- not exposed more broadly than intended.

REVOKE ALL ON "profiles" FROM anon;
REVOKE ALL ON "billing_customers" FROM anon;
REVOKE ALL ON "subscriptions" FROM anon;

REVOKE ALL ON "profiles" FROM PUBLIC;
REVOKE ALL ON "billing_customers" FROM PUBLIC;
REVOKE ALL ON "subscriptions" FROM PUBLIC;

GRANT SELECT ON "profiles" TO authenticated;
GRANT SELECT ON "billing_customers" TO authenticated;
GRANT SELECT ON "subscriptions" TO authenticated;
