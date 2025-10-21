-- Migration: Add missing columns to evaluations table
-- Date: 2025-09-29
-- Purpose: Fix evaluation storage by adding columns that code expects

-- Add missing columns to evaluations table
ALTER TABLE public.evaluations
  ADD COLUMN IF NOT EXISTS heuristic JSONB,
  ADD COLUMN IF NOT EXISTS llm_score_percent INTEGER,
  ADD COLUMN IF NOT EXISTS criteria_details JSONB,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_evaluations_session_id ON public.evaluations(session_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_student_email ON public.evaluations(student_email);
CREATE INDEX IF NOT EXISTS idx_evaluations_scenario_id ON public.evaluations(scenario_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_created_at ON public.evaluations(created_at);

-- Add comments for documentation
COMMENT ON COLUMN public.evaluations.heuristic IS 'Heuristic evaluation data (fallback scoring)';
COMMENT ON COLUMN public.evaluations.llm_score_percent IS 'LLM-generated score percentage';
COMMENT ON COLUMN public.evaluations.criteria_details IS 'Detailed evaluation criteria and scores';
COMMENT ON COLUMN public.evaluations.summary IS 'Summary of the evaluation';
COMMENT ON COLUMN public.evaluations.created_at IS 'Timestamp when evaluation was created';
COMMENT ON COLUMN public.evaluations.updated_at IS 'Timestamp when evaluation was last updated';