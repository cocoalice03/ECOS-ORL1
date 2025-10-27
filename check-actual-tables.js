/**
 * Check what tables actually exist in Supabase
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

console.log('🔍 CHECKING ACTUAL SUPABASE TABLES');
console.log('=' .repeat(80));

// Try different possible table names based on schema.ts
const possibleTables = [
  // Code schema names (from shared/schema.ts)
  'ecos_scenarios',
  'ecos_sessions',
  'ecos_evaluations',
  'ecos_reports',
  'ecos_messages',
  'training_sessions',
  'training_session_scenarios',
  'training_session_students',
  'exchanges',
  'daily_counters',
  'users',
  'scenarios',
  'sessions',
  'evaluations',
  // Possible alternative names
  'session',
  'exchange',
  'evaluation',
  'scenario',
  'message',
  'messages'
];

async function checkTable(tableName) {
  try {
    const { data, error, count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (error) {
      return { exists: false, error: error.message };
    }
    return { exists: true, count };
  } catch (err) {
    return { exists: false, error: err.message };
  }
}

async function checkAllTables() {
  const results = [];

  for (const tableName of possibleTables) {
    const result = await checkTable(tableName);
    if (result.exists) {
      console.log(`✅ ${tableName.padEnd(35)} - ${result.count !== null ? result.count + ' rows' : 'accessible'}`);
      results.push({ tableName, count: result.count });
    }
  }

  console.log('\n' + '─'.repeat(80));
  console.log('📊 EXISTING TABLES SUMMARY');
  console.log('─'.repeat(80));

  if (results.length === 0) {
    console.log('⚠️  No tables found! Database might be empty or inaccessible.');
  } else {
    console.log(`\n✅ Found ${results.length} accessible tables:`);
    results.forEach(r => {
      console.log(`   - ${r.tableName} (${r.count} rows)`);
    });
  }

  console.log('\n' + '='.repeat(80));
}

checkAllTables().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
