-- CRITICAL FIX: Create Missing Database Tables for ECOS-ORL
-- Project: fglqynwvvgunchrycuxh
-- Date: October 27, 2025
--
-- ISSUE: UnifiedDatabaseService expects sessions, exchanges, and evaluations tables
--        but these tables are NOT in the Supabase schema cache, causing PGRST205 errors.
--        All data is currently stored in fallback memory and LOST on server restart.
--
-- SOLUTION: Create these tables immediately to enable database persistence.
--
-- HOW TO RUN:
-- 1. Go to https://supabase.com/dashboard/project/fglqynwvvgunchrycuxh/sql
-- 2. Paste this entire script
-- 3. Click "Run"
-- 4. Verify output shows tables created
-- 5. Restart your server: npm run dev

-- ============================================================================
-- 1. CREATE SESSIONS TABLE
-- ============================================================================
-- This table stores ECOS session records
-- Maps string session IDs (e.g., "session_5_1758021134446_gm0k1a8xi") to database records

CREATE TABLE IF NOT EXISTS public.sessions (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) UNIQUE NOT NULL,
  student_email VARCHAR(255) NOT NULL REFERENCES public.users(email) ON DELETE CASCADE,
  scenario_id INTEGER REFERENCES public.scenarios(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'in_progress', 'completed', 'cancelled')),
  start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.sessions IS 'ECOS training session records';
COMMENT ON COLUMN public.sessions.session_id IS 'String identifier like session_5_1758021134446_gm0k1a8xi';
COMMENT ON COLUMN public.sessions.id IS 'Database integer primary key used as foreign key';

-- ============================================================================
-- 2. CREATE EXCHANGES TABLE
-- ============================================================================
-- This table stores conversation messages between students and AI patient

CREATE TABLE IF NOT EXISTS public.exchanges (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  question TEXT DEFAULT '',
  response TEXT DEFAULT '',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.exchanges IS 'Chat messages for ECOS sessions';
COMMENT ON COLUMN public.exchanges.session_id IS 'References sessions.id (integer DB ID, not session_id string)';
COMMENT ON COLUMN public.exchanges.role IS 'Message sender: user (student), assistant (AI patient), or system';

-- ============================================================================
-- 3. CREATE EVALUATIONS TABLE
-- ============================================================================
-- This table stores assessment results for completed ECOS sessions

CREATE TABLE IF NOT EXISTS public.evaluations (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  scenario_id INTEGER REFERENCES public.scenarios(id) ON DELETE SET NULL,
  student_email VARCHAR(255) NOT NULL REFERENCES public.users(email) ON DELETE CASCADE,
  scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  global_score INTEGER NOT NULL CHECK (global_score >= 0 AND global_score <= 100),
  strengths TEXT[] DEFAULT '{}',
  weaknesses TEXT[] DEFAULT '{}',
  recommendations TEXT[] DEFAULT '{}',
  feedback TEXT,
  heuristic JSONB,
  llm_score_percent INTEGER CHECK (llm_score_percent >= 0 AND llm_score_percent <= 100),
  criteria_details JSONB,
  evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.evaluations IS 'Assessment results for ECOS sessions';
COMMENT ON COLUMN public.evaluations.global_score IS 'Overall score out of 100';
COMMENT ON COLUMN public.evaluations.heuristic IS 'Heuristic evaluation data (fallback scoring)';
COMMENT ON COLUMN public.evaluations.llm_score_percent IS 'LLM-generated score percentage';

-- ============================================================================
-- 4. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Sessions table indexes
CREATE INDEX IF NOT EXISTS idx_sessions_student_email ON public.sessions(student_email);
CREATE INDEX IF NOT EXISTS idx_sessions_scenario_id ON public.sessions(scenario_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON public.sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON public.sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON public.sessions(created_at);

-- Exchanges table indexes
CREATE INDEX IF NOT EXISTS idx_exchanges_session_id ON public.exchanges(session_id);
CREATE INDEX IF NOT EXISTS idx_exchanges_timestamp ON public.exchanges(timestamp);
CREATE INDEX IF NOT EXISTS idx_exchanges_role ON public.exchanges(role);

-- Evaluations table indexes
CREATE INDEX IF NOT EXISTS idx_evaluations_session_id ON public.evaluations(session_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_student_email ON public.evaluations(student_email);
CREATE INDEX IF NOT EXISTS idx_evaluations_scenario_id ON public.evaluations(scenario_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_evaluated_at ON public.evaluations(evaluated_at);

-- ============================================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchanges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. CREATE RLS POLICIES (Service Role bypasses these automatically)
-- ============================================================================

-- Sessions policies
DROP POLICY IF EXISTS "Allow service role full access to sessions" ON public.sessions;
CREATE POLICY "Allow service role full access to sessions"
  ON public.sessions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon access to sessions" ON public.sessions;
CREATE POLICY "Allow anon access to sessions"
  ON public.sessions FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Exchanges policies
DROP POLICY IF EXISTS "Allow service role full access to exchanges" ON public.exchanges;
CREATE POLICY "Allow service role full access to exchanges"
  ON public.exchanges FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon access to exchanges" ON public.exchanges;
CREATE POLICY "Allow anon access to exchanges"
  ON public.exchanges FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Evaluations policies
DROP POLICY IF EXISTS "Allow service role full access to evaluations" ON public.evaluations;
CREATE POLICY "Allow service role full access to evaluations"
  ON public.evaluations FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon access to evaluations" ON public.evaluations;
CREATE POLICY "Allow anon access to evaluations"
  ON public.evaluations FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 7. GRANT PERMISSIONS
-- ============================================================================

-- Grant all privileges to authenticated users and service role
GRANT ALL ON public.sessions TO authenticated, anon, service_role;
GRANT ALL ON public.exchanges TO authenticated, anon, service_role;
GRANT ALL ON public.evaluations TO authenticated, anon, service_role;

-- Grant sequence usage for auto-increment IDs
GRANT USAGE, SELECT ON SEQUENCE public.sessions_id_seq TO authenticated, anon, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.exchanges_id_seq TO authenticated, anon, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.evaluations_id_seq TO authenticated, anon, service_role;

-- ============================================================================
-- 8. VERIFICATION QUERIES
-- ============================================================================

-- Check that tables exist and are empty
SELECT 'sessions' as table_name, COUNT(*) as row_count FROM public.sessions
UNION ALL
SELECT 'exchanges' as table_name, COUNT(*) as row_count FROM public.exchanges
UNION ALL
SELECT 'evaluations' as table_name, COUNT(*) as row_count FROM public.evaluations;

-- Show table structure
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('sessions', 'exchanges', 'evaluations')
ORDER BY table_name, ordinal_position;

-- Show indexes
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('sessions', 'exchanges', 'evaluations')
ORDER BY tablename, indexname;

-- Show RLS policies
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

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 'SUCCESS: Tables created! Now restart your server with: npm run dev' as status;
