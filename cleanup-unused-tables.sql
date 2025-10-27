-- Cleanup script to remove unused tables from the database
-- These tables were defined with ecos_ prefix but are not used by the code
-- The code uses tables without the prefix: sessions, exchanges, evaluations

-- Drop unused tables with ecos_ prefix
DROP TABLE IF EXISTS public.ecos_messages CASCADE;
DROP TABLE IF EXISTS public.ecos_evaluations CASCADE;
DROP TABLE IF EXISTS public.ecos_sessions CASCADE;
DROP TABLE IF EXISTS public.ecos_scenarios CASCADE;
DROP TABLE IF EXISTS public.ecos_reports CASCADE;

-- Drop other unused tables
DROP TABLE IF EXISTS public.daily_counters CASCADE;

-- Verify cleanup - list remaining tables
SELECT
    schemaname,
    tablename,
    tableowner
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Verify we kept only the tables we need
-- Expected tables:
-- - users
-- - scenarios
-- - sessions (ECOS sessions, not auth)
-- - exchanges (messages)
-- - evaluations
-- - training_sessions
-- - training_session_scenarios
-- - training_session_students
