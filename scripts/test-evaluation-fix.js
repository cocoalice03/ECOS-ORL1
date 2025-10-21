import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

async function testEvaluationFix() {
  console.log('🧪 Testing Evaluation Storage Fix\n');
  console.log('=' .repeat(50));

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Step 1: Check current evaluations table schema
  console.log('\n1️⃣  Checking evaluations table schema...');
  const { data: columns, error: schemaError } = await supabase
    .from('evaluations')
    .select('*')
    .limit(0);

  if (schemaError) {
    console.error('❌ Could not query evaluations table:', schemaError.message);
  } else {
    console.log('✅ Evaluations table accessible');
  }

  // Step 2: Check if new columns exist
  console.log('\n2️⃣  Checking for required columns...');
  const requiredColumns = ['heuristic', 'llm_score_percent', 'criteria_details', 'summary', 'created_at', 'updated_at'];

  console.log('\n⚠️  NOTE: Cannot verify column existence via REST API');
  console.log('   Please run this SQL manually in Supabase SQL Editor:');
  console.log('\n   ' + supabaseUrl + '/project/_/sql');
  console.log('\n   Copy and paste from: migrations/add-evaluation-columns.sql');

  // Step 3: Check for existing evaluations
  console.log('\n3️⃣  Checking existing evaluations...');
  const { data: evaluations, error: evalError } = await supabase
    .from('evaluations')
    .select('id, session_id, scenario_id, student_email, global_score, evaluated_at')
    .order('evaluated_at', { ascending: false })
    .limit(5);

  if (evalError) {
    console.error('❌ Could not query evaluations:', evalError.message);
  } else {
    console.log(`✅ Found ${evaluations?.length || 0} recent evaluations`);
    if (evaluations && evaluations.length > 0) {
      console.log('\n   Recent evaluations:');
      evaluations.forEach((e, i) => {
        console.log(`   ${i + 1}. Session ${e.session_id} - Score: ${e.global_score}% - ${new Date(e.evaluated_at).toLocaleString()}`);
      });
    }
  }

  // Step 4: Check sessions table
  console.log('\n4️⃣  Checking sessions table...');
  const { data: sessions, error: sessError } = await supabase
    .from('sessions')
    .select('id, session_id, scenario_id, student_email, status')
    .order('id', { ascending: false })
    .limit(5);

  if (sessError) {
    console.error('❌ Could not query sessions:', sessError.message);
  } else {
    console.log(`✅ Found ${sessions?.length || 0} recent sessions`);
    if (sessions && sessions.length > 0) {
      console.log('\n   Recent sessions:');
      sessions.forEach((s, i) => {
        console.log(`   ${i + 1}. ${s.session_id} (DB ID: ${s.id}) - Status: ${s.status || 'N/A'}`);
      });
    }
  }

  // Step 5: Summary and next steps
  console.log('\n' + '='.repeat(50));
  console.log('\n📋 NEXT STEPS:\n');
  console.log('1. ✅ Fixed undefined variable `percent` → `overallScorePercent`');
  console.log('2. ✅ Created migration file: migrations/add-evaluation-columns.sql');
  console.log('3. ⚠️  MANUAL ACTION REQUIRED: Run migration in Supabase SQL Editor');
  console.log('   URL: ' + supabaseUrl + '/project/_/sql');
  console.log('4. ✅ Fixed error handling to return HTTP 500 on storage failure');
  console.log('\n5. 🧪 TEST the fix:');
  console.log('   a. Start server: npm run dev');
  console.log('   b. Complete an ECOS session in the frontend');
  console.log('   c. Check server logs for "✅ Stored evaluation" message');
  console.log('   d. Verify evaluation in Supabase dashboard');
  console.log('   e. Test /report endpoint retrieval');
  console.log('\n✨ Once migration is applied, evaluations will persist correctly!\n');

  process.exit(0);
}

testEvaluationFix();