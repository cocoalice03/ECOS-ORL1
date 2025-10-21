import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

async function applyMigration() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  console.log('🔄 Connecting to Supabase...');
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Use Supabase SQL query API
    console.log('🚀 Applying migration via Supabase API...');

    const migrations = [
      'ALTER TABLE public.evaluations ADD COLUMN IF NOT EXISTS heuristic JSONB',
      'ALTER TABLE public.evaluations ADD COLUMN IF NOT EXISTS llm_score_percent INTEGER',
      'ALTER TABLE public.evaluations ADD COLUMN IF NOT EXISTS criteria_details JSONB',
      'ALTER TABLE public.evaluations ADD COLUMN IF NOT EXISTS summary TEXT',
      'ALTER TABLE public.evaluations ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()',
      'ALTER TABLE public.evaluations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()'
    ];

    for (const sql of migrations) {
      console.log(`  Executing: ${sql.substring(0, 80)}...`);
      const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
      if (error) {
        console.warn(`  ⚠️  Could not execute via RPC: ${error.message}`);
      }
    }

    console.log('\n🔍 Verifying columns exist...');

    // Try to select from evaluations table to verify columns
    const { data, error } = await supabase
      .from('evaluations')
      .select('id, heuristic, llm_score_percent, criteria_details, summary, created_at, updated_at')
      .limit(0);

    if (error) {
      console.error('❌ Verification failed:', error.message);
      console.log('\n⚠️  MANUAL MIGRATION REQUIRED ⚠️');
      console.log('Please run this SQL in Supabase SQL Editor:');
      console.log('\n--- START SQL ---');
      console.log(`
ALTER TABLE public.evaluations
  ADD COLUMN IF NOT EXISTS heuristic JSONB,
  ADD COLUMN IF NOT EXISTS llm_score_percent INTEGER,
  ADD COLUMN IF NOT EXISTS criteria_details JSONB,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_evaluations_session_id ON public.evaluations(session_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_student_email ON public.evaluations(student_email);
CREATE INDEX IF NOT EXISTS idx_evaluations_scenario_id ON public.evaluations(scenario_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_created_at ON public.evaluations(created_at);
      `);
      console.log('--- END SQL ---\n');
      console.log('Visit: ' + supabaseUrl + '/project/_/sql');
      process.exit(1);
    } else {
      console.log('✅ All columns verified successfully!');
      console.log('\n✨ Migration completed!');
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n⚠️  MANUAL MIGRATION REQUIRED ⚠️');
    console.log('Please run the SQL in: migrations/add-evaluation-columns.sql');
    console.log('Via Supabase SQL Editor: ' + supabaseUrl + '/project/_/sql');
    process.exit(1);
  }
}

applyMigration();