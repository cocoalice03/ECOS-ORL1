/**
 * Verify Database State
 * Quickly check if all required tables exist and are accessible
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

console.log('🔍 VERIFYING DATABASE STATE\n');
console.log('=' .repeat(60));
console.log(`Database: ${SUPABASE_URL}`);
console.log('=' .repeat(60));

async function verifyTable(tableName) {
  try {
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (error) {
      return {
        exists: false,
        accessible: false,
        error: error.message,
        count: null
      };
    }

    return {
      exists: true,
      accessible: true,
      count,
      error: null
    };
  } catch (err) {
    return {
      exists: false,
      accessible: false,
      error: err.message,
      count: null
    };
  }
}

async function verifyDatabase() {
  const requiredTables = [
    { name: 'users', critical: true },
    { name: 'scenarios', critical: true },
    { name: 'sessions', critical: true },
    { name: 'exchanges', critical: true },
    { name: 'evaluations', critical: true },
  ];

  const optionalTables = [
    'ecos_sessions',
    'ecos_messages',
    'ecos_evaluations',
    'training_sessions',
  ];

  console.log('\n📋 REQUIRED TABLES\n');
  let allRequired = true;

  for (const table of requiredTables) {
    const result = await verifyTable(table.name);

    const status = result.accessible
      ? `✅ OK (${result.count} rows)`
      : `❌ MISSING or INACCESSIBLE`;

    console.log(`${table.name.padEnd(20)} ${status}`);

    if (!result.accessible && table.critical) {
      allRequired = false;
      console.log(`   Error: ${result.error}`);
    }
  }

  console.log('\n📋 OPTIONAL TABLES\n');

  for (const tableName of optionalTables) {
    const result = await verifyTable(tableName);

    const status = result.accessible
      ? `✅ OK (${result.count} rows)`
      : `⚠️  Not found`;

    console.log(`${tableName.padEnd(20)} ${status}`);
  }

  console.log('\n' + '=' .repeat(60));
  console.log('📊 SUMMARY');
  console.log('=' .repeat(60));

  if (allRequired) {
    console.log('\n✅ ALL REQUIRED TABLES ARE ACCESSIBLE');
    console.log('✅ Database is properly configured');
    console.log('\nNext steps:');
    console.log('  1. Restart your server: npm run dev');
    console.log('  2. Test ECOS session creation');
    console.log('  3. Verify data persists after restart');
  } else {
    console.log('\n❌ CRITICAL TABLES ARE MISSING');
    console.log('❌ Database is NOT properly configured');
    console.log('\nAction required:');
    console.log('  1. Run CREATE_MISSING_TABLES.sql in Supabase SQL Editor');
    console.log('  2. URL: https://supabase.com/dashboard/project/fglqynwvvgunchrycuxh/sql');
    console.log('  3. Then run this script again to verify');
  }

  console.log('\n' + '=' .repeat(60));
}

verifyDatabase().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
