-- ECOS-ORL Database Setup Script
-- This script creates all necessary tables with proper permissions and RLS policies

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- SESSIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sessions (
    id SERIAL PRIMARY KEY,
    session_id TEXT NOT NULL UNIQUE,
    student_email TEXT NOT NULL,
    scenario_id INTEGER NOT NULL,
    status TEXT DEFAULT 'active',
    start_time TIMESTAMPTZ DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_sessions_student FOREIGN KEY (student_email) REFERENCES public.users(email) ON DELETE CASCADE,
    CONSTRAINT fk_sessions_scenario FOREIGN KEY (scenario_id) REFERENCES public.scenarios(id) ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON public.sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_student_email ON public.sessions(student_email);
CREATE INDEX IF NOT EXISTS idx_sessions_scenario_id ON public.sessions(scenario_id);

-- ============================================================================
-- EXCHANGES TABLE (for messages)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.exchanges (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    question TEXT,
    response TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_exchanges_session FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_exchanges_session_id ON public.exchanges(session_id);
CREATE INDEX IF NOT EXISTS idx_exchanges_created_at ON public.exchanges(created_at);

-- ============================================================================
-- EVALUATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.evaluations (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL,
    scenario_id INTEGER NOT NULL,
    student_email TEXT NOT NULL,
    scores JSONB DEFAULT '{}',
    global_score INTEGER DEFAULT 0,
    strengths TEXT[] DEFAULT '{}',
    weaknesses TEXT[] DEFAULT '{}',
    recommendations TEXT[] DEFAULT '{}',
    feedback TEXT,
    heuristic JSONB,
    llm_score_percent INTEGER,
    criteria_details JSONB,
    evaluated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_evaluations_session FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_evaluations_scenario FOREIGN KEY (scenario_id) REFERENCES public.scenarios(id) ON DELETE CASCADE,
    CONSTRAINT fk_evaluations_student FOREIGN KEY (student_email) REFERENCES public.users(email) ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_evaluations_session_id ON public.evaluations(session_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_student_email ON public.evaluations(student_email);
CREATE INDEX IF NOT EXISTS idx_evaluations_scenario_id ON public.evaluations(scenario_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchanges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can create their own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Service role has full access to sessions" ON public.sessions;

DROP POLICY IF EXISTS "Users can view exchanges from their sessions" ON public.exchanges;
DROP POLICY IF EXISTS "Users can create exchanges in their sessions" ON public.exchanges;
DROP POLICY IF EXISTS "Service role has full access to exchanges" ON public.exchanges;

DROP POLICY IF EXISTS "Users can view their own evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Users can create their own evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Service role has full access to evaluations" ON public.evaluations;

-- Sessions policies
CREATE POLICY "Users can view their own sessions" ON public.sessions
    FOR SELECT USING (student_email = current_setting('request.jwt.claims', true)::json->>'email');

CREATE POLICY "Users can create their own sessions" ON public.sessions
    FOR INSERT WITH CHECK (student_email = current_setting('request.jwt.claims', true)::json->>'email');

CREATE POLICY "Users can update their own sessions" ON public.sessions
    FOR UPDATE USING (student_email = current_setting('request.jwt.claims', true)::json->>'email');

CREATE POLICY "Service role has full access to sessions" ON public.sessions
    FOR ALL USING (true);

-- Exchanges policies
CREATE POLICY "Users can view exchanges from their sessions" ON public.exchanges
    FOR SELECT USING (
        session_id IN (
            SELECT id FROM public.sessions
            WHERE student_email = current_setting('request.jwt.claims', true)::json->>'email'
        )
    );

CREATE POLICY "Users can create exchanges in their sessions" ON public.exchanges
    FOR INSERT WITH CHECK (
        session_id IN (
            SELECT id FROM public.sessions
            WHERE student_email = current_setting('request.jwt.claims', true)::json->>'email'
        )
    );

CREATE POLICY "Service role has full access to exchanges" ON public.exchanges
    FOR ALL USING (true);

-- Evaluations policies
CREATE POLICY "Users can view their own evaluations" ON public.evaluations
    FOR SELECT USING (student_email = current_setting('request.jwt.claims', true)::json->>'email');

CREATE POLICY "Users can create their own evaluations" ON public.evaluations
    FOR INSERT WITH CHECK (student_email = current_setting('request.jwt.claims', true)::json->>'email');

CREATE POLICY "Service role has full access to evaluations" ON public.evaluations
    FOR ALL USING (true);

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.sessions TO authenticated;
GRANT SELECT, INSERT ON public.exchanges TO authenticated;
GRANT SELECT, INSERT ON public.evaluations TO authenticated;

-- Grant permissions to service role
GRANT ALL ON public.sessions TO service_role;
GRANT ALL ON public.exchanges TO service_role;
GRANT ALL ON public.evaluations TO service_role;

-- Grant permissions to anon role (for public access)
GRANT SELECT ON public.sessions TO anon;
GRANT SELECT ON public.exchanges TO anon;
GRANT SELECT ON public.evaluations TO anon;

-- Grant sequence permissions
GRANT USAGE, SELECT ON SEQUENCE public.sessions_id_seq TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.exchanges_id_seq TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.evaluations_id_seq TO authenticated, service_role;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify tables exist
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('sessions', 'exchanges', 'evaluations')
ORDER BY table_name;

-- Verify columns
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN ('sessions', 'exchanges', 'evaluations')
ORDER BY table_name, ordinal_position;

-- Check RLS status
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('sessions', 'exchanges', 'evaluations');

SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('sessions', 'exchanges', 'evaluations')
ORDER BY tablename, policyname;
