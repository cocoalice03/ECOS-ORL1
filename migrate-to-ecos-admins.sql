-- Migration: Switch to ecos_admins table for admin authorization
-- This script:
-- 1. Inserts the admin user into ecos_admins table
-- 2. Drops all unused ecos_* tables (keeping only ecos_admins)
-- 3. Drops the profiles table (not used by code)

-- ============================================================================
-- PART 1: INSERT ADMIN USER
-- ============================================================================

-- Insert admin email into ecos_admins table (idempotent - won't fail if already exists)
INSERT INTO public.ecos_admins (email, role, created_at)
VALUES ('cherubindavid@gmail.com', 'ADMIN', NOW())
ON CONFLICT (email) DO NOTHING;

-- Verify admin was inserted
SELECT * FROM public.ecos_admins WHERE email = 'cherubindavid@gmail.com';

-- ============================================================================
-- PART 2: DROP UNUSED ECOS_* TABLES
-- ============================================================================

-- Drop all ecos_* tables that are NOT being used by the code
-- These tables use UUID primary keys and reference auth.users (Supabase Auth)
-- The code actually uses the integer ID tables (scenarios, sessions, exchanges, evaluations)

DROP TABLE IF EXISTS public.ecos_symptome CASCADE;
DROP TABLE IF EXISTS public.ecos_rubrique_communication CASCADE;
DROP TABLE IF EXISTS public.ecos_prise_en_charge CASCADE;
DROP TABLE IF EXISTS public.ecos_patient_profil CASCADE;
DROP TABLE IF EXISTS public.ecos_item_aptitude CASCADE;
DROP TABLE IF EXISTS public.ecos_iconographie CASCADE;
DROP TABLE IF EXISTS public.ecos_document CASCADE;
DROP TABLE IF EXISTS public.ecos_consigne CASCADE;
DROP TABLE IF EXISTS public.ecos_scenario CASCADE;

-- Drop profiles table (not used by code, may be auto-created by Supabase Auth)
DROP TABLE IF EXISTS public.profiles CASCADE;

-- ============================================================================
-- PART 3: VERIFY REMAINING TABLES
-- ============================================================================

-- List all remaining tables in public schema
SELECT
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
ORDER BY table_name;

-- Expected remaining tables:
-- - ecos_admins (admin authorization)
-- - evaluations (ECOS assessment results)
-- - exchanges (chat messages)
-- - scenarios (medical scenarios)
-- - sessions (ECOS sessions)
-- - training_session_scenarios (training-scenario relationships)
-- - training_session_students (student assignments)
-- - training_sessions (training modules)
-- - user_roles (user role management)
-- - users (user accounts)
