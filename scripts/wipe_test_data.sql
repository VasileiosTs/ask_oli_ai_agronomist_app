-- Wipe all test data — fresh start for production
-- Order matters due to foreign key constraints

TRUNCATE TABLE kpi_snapshots CASCADE;
TRUNCATE TABLE admin_users CASCADE;
TRUNCATE TABLE push_subscriptions CASCADE;
TRUNCATE TABLE interventions CASCADE;
TRUNCATE TABLE chat_messages CASCADE;
TRUNCATE TABLE conversations CASCADE;
TRUNCATE TABLE crops CASCADE;
TRUNCATE TABLE fields CASCADE;
TRUNCATE TABLE grower_links CASCADE;
TRUNCATE TABLE users CASCADE;
