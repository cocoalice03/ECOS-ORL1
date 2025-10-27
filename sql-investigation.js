/**
 * Direct SQL Investigation - Bypass RLS
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

console.log('🔍 DIRECT SQL INVESTIGATION (Bypassing RLS)');
console.log('=' .repeat(80));

async function runSQL(query, description) {
  console.log(`\n📊 ${description}`);
  console.log('─'.repeat(80));
  console.log(`SQL: ${query}`);
  console.log('');

  try {
    const { data, error } = await supabase.rpc('exec_sql', { query });

    if (error) {
      // Try alternative approach - direct query
      const { data: altData, error: altError } = await supabase.from('_sql').select(query);

      if (altError) {
        console.log(`❌ Error: ${error.message}`);
        return null;
      }

      console.log('✅ Result:', JSON.stringify(altData, null, 2));
      return altData;
    }

    console.log('✅ Result:', JSON.stringify(data, null, 2));
    return data;
  } catch (err) {
    console.log(`❌ Exception: ${err.message}`);
    return null;
  }
}

async function checkTablesDirectly() {
  // List all tables in public schema
  console.log('\n🗂️  CHECKING ALL TABLES IN PUBLIC SCHEMA');
  console.log('='.repeat(80));

  const tables = [
    'sessions',
    'exchanges',
    'evaluations',
    'ecos_sessions',
    'ecos_messages',
    'ecos_evaluations',
    'ecos_reports',
    'scenarios',
    'users',
    'training_sessions'
  ];

  for (const table of tables) {
    console.log(`\n📋 Checking: ${table}`);
    console.log('─'.repeat(40));

    try {
      // Try to count rows
      const { count, error: countError } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (countError) {
        console.log(`   ❌ Not accessible: ${countError.message}`);

        // Try to check if table exists in information_schema
        const { data: tableInfo, error: infoError } = await supabase
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_schema', 'public')
          .eq('table_name', table);

        if (!infoError && tableInfo && tableInfo.length > 0) {
          console.log(`   ℹ️  Table EXISTS in schema but RLS may be blocking access`);
        } else {
          console.log(`   ℹ️  Table does NOT exist in public schema`);
        }
      } else {
        console.log(`   ✅ Accessible - Row count: ${count}`);

        // If table has data, show a sample
        if (count > 0) {
          const { data: sample, error: sampleError } = await supabase
            .from(table)
            .select('*')
            .limit(1);

          if (!sampleError && sample && sample.length > 0) {
            console.log(`   📄 Sample columns: ${Object.keys(sample[0]).join(', ')}`);
          }
        }
      }
    } catch (err) {
      console.log(`   ❌ Exception: ${err.message}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Direct table check complete');
  console.log('='.repeat(80));
}

// Alternative approach: Check pg_catalog
async function checkPgCatalog() {
  console.log('\n\n🔍 CHECKING PostgreSQL CATALOG');
  console.log('='.repeat(80));

  try {
    // This might not work due to permissions, but worth trying
    const { data, error } = await supabase
      .from('pg_catalog.pg_tables')
      .select('tablename')
      .eq('schemaname', 'public');

    if (error) {
      console.log(`❌ Cannot access pg_catalog: ${error.message}`);
    } else if (data) {
      console.log(`\n✅ Found ${data.length} tables in public schema:`);
      data.forEach(t => console.log(`   - ${t.tablename}`));
    }
  } catch (err) {
    console.log(`❌ Exception: ${err.message}`);
  }

  console.log('\n' + '='.repeat(80));
}

async function investigate() {
  await checkTablesDirectly();
  await checkPgCatalog();
}

investigate().catch(err => {
  console.error('❌ Investigation failed:', err);
  process.exit(1);
});
