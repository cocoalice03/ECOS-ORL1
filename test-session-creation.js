/**
 * Test Session Creation Flow
 * Simulates creating a session and storing messages to identify issues
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

console.log('🧪 TESTING SESSION CREATION FLOW');
console.log('=' .repeat(80));

async function testSessionCreation() {
  const testEmail = 'test-student@example.com';
  const testScenarioId = 1;
  const testSessionId = `session_${testScenarioId}_${Date.now()}_test`;

  console.log('\n📝 Test Parameters:');
  console.log(`   Student Email: ${testEmail}`);
  console.log(`   Scenario ID: ${testScenarioId}`);
  console.log(`   Session ID: ${testSessionId}`);

  // Step 1: Ensure user exists
  console.log('\n\n1️⃣ ENSURING USER EXISTS');
  console.log('─'.repeat(80));

  try {
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', testEmail)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.log(`❌ Error checking user: ${checkError.message}`);
    } else if (existingUser) {
      console.log(`✅ User already exists: ID ${existingUser.id}, Email ${existingUser.email}`);
    } else {
      // Create user
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          email: testEmail,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.log(`❌ Failed to create user: ${createError.message}`);
      } else {
        console.log(`✅ Created new user: ID ${newUser.id}, Email ${newUser.email}`);
      }
    }
  } catch (err) {
    console.log(`❌ Exception: ${err.message}`);
  }

  // Step 2: Create session in 'sessions' table
  console.log('\n\n2️⃣ CREATING SESSION IN sessions TABLE');
  console.log('─'.repeat(80));

  let sessionDbId = null;

  try {
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        session_id: testSessionId,
        student_email: testEmail,
        scenario_id: testScenarioId,
        status: 'active',
        start_time: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (sessionError) {
      console.log(`❌ Failed to create session: ${sessionError.message}`);
      console.log(`   Code: ${sessionError.code}`);
      console.log(`   Details: ${JSON.stringify(sessionError.details)}`);
      console.log(`   Hint: ${sessionError.hint}`);
    } else {
      sessionDbId = session.id;
      console.log(`✅ Created session successfully!`);
      console.log(`   Database ID: ${session.id}`);
      console.log(`   Session ID: ${session.session_id}`);
      console.log(`   Student: ${session.student_email}`);
      console.log(`   Scenario: ${session.scenario_id}`);
      console.log(`   Status: ${session.status}`);
    }
  } catch (err) {
    console.log(`❌ Exception: ${err.message}`);
  }

  // Step 3: Store message in 'exchanges' table
  if (sessionDbId) {
    console.log('\n\n3️⃣ STORING MESSAGE IN exchanges TABLE');
    console.log('─'.repeat(80));

    try {
      const { data: exchange, error: exchangeError } = await supabase
        .from('exchanges')
        .insert({
          session_id: sessionDbId, // Use database integer ID
          role: 'user',
          question: 'Bonjour, comment puis-je aider cet enfant?',
          response: '',
          timestamp: new Date().toISOString()
        })
        .select()
        .single();

      if (exchangeError) {
        console.log(`❌ Failed to store message: ${exchangeError.message}`);
        console.log(`   Code: ${exchangeError.code}`);
        console.log(`   Details: ${JSON.stringify(exchangeError.details)}`);
      } else {
        console.log(`✅ Stored message successfully!`);
        console.log(`   Exchange ID: ${exchange.id}`);
        console.log(`   Session ID: ${exchange.session_id}`);
        console.log(`   Role: ${exchange.role}`);
        console.log(`   Question: ${exchange.question}`);
      }
    } catch (err) {
      console.log(`❌ Exception: ${err.message}`);
    }

    // Step 4: Retrieve messages back
    console.log('\n\n4️⃣ RETRIEVING MESSAGES FROM exchanges TABLE');
    console.log('─'.repeat(80));

    try {
      const { data: messages, error: retrieveError } = await supabase
        .from('exchanges')
        .select('*')
        .eq('session_id', sessionDbId)
        .order('timestamp', { ascending: true });

      if (retrieveError) {
        console.log(`❌ Failed to retrieve messages: ${retrieveError.message}`);
      } else {
        console.log(`✅ Retrieved ${messages.length} message(s)`);
        messages.forEach((msg, idx) => {
          console.log(`\n   Message ${idx + 1}:`);
          console.log(`      ID: ${msg.id}`);
          console.log(`      Role: ${msg.role}`);
          console.log(`      Question: ${msg.question}`);
          console.log(`      Timestamp: ${msg.timestamp}`);
        });
      }
    } catch (err) {
      console.log(`❌ Exception: ${err.message}`);
    }

    // Step 5: Create evaluation
    console.log('\n\n5️⃣ CREATING EVALUATION IN evaluations TABLE');
    console.log('─'.repeat(80));

    try {
      const { data: evaluation, error: evalError } = await supabase
        .from('evaluations')
        .insert({
          session_id: sessionDbId,
          scenario_id: testScenarioId,
          student_email: testEmail,
          scores: { communication: 85, diagnostic: 75 },
          global_score: 80,
          strengths: ['Bon diagnostic initial'],
          weaknesses: ['Manque de détails'],
          recommendations: ['Approfondir l\'examen'],
          evaluated_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (evalError) {
        console.log(`❌ Failed to create evaluation: ${evalError.message}`);
        console.log(`   Code: ${evalError.code}`);
        console.log(`   Details: ${JSON.stringify(evalError.details)}`);
      } else {
        console.log(`✅ Created evaluation successfully!`);
        console.log(`   Evaluation ID: ${evaluation.id}`);
        console.log(`   Global Score: ${evaluation.global_score}`);
      }
    } catch (err) {
      console.log(`❌ Exception: ${err.message}`);
    }
  }

  // Final summary
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));

  const { data: finalSessions } = await supabase.from('sessions').select('*');
  const { data: finalExchanges } = await supabase.from('exchanges').select('*');
  const { data: finalEvaluations } = await supabase.from('evaluations').select('*');

  console.log(`\n✅ Total sessions in database: ${finalSessions?.length || 0}`);
  console.log(`✅ Total exchanges in database: ${finalExchanges?.length || 0}`);
  console.log(`✅ Total evaluations in database: ${finalEvaluations?.length || 0}`);

  console.log('\n' + '='.repeat(80));
  console.log('✅ Test Complete');
  console.log('='.repeat(80));
}

testSessionCreation().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
