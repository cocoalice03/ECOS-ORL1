/**
 * Detailed Supabase Investigation
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

console.log('🔍 DETAILED SUPABASE DATABASE INVESTIGATION');
console.log('=' .repeat(80));
console.log(`📡 Database: ${SUPABASE_URL}`);
console.log('=' .repeat(80));

async function investigateTable(tableName, primaryOrderColumn = 'created_at') {
  console.log(`\n📋 TABLE: ${tableName.toUpperCase()}`);
  console.log('─'.repeat(80));

  try {
    // Get all records to count them properly
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .order(primaryOrderColumn, { ascending: false })
      .limit(1000);

    if (error) {
      console.log(`❌ Error: ${error.message}`);
      return;
    }

    const count = data ? data.length : 0;
    console.log(`📊 Row count: ${count}`);

    if (count > 0) {
      // Get column names
      const columns = Object.keys(data[0]);
      console.log(`📝 Columns (${columns.length}): ${columns.join(', ')}`);

      // Show first 3 records
      console.log(`\n📄 Recent Records (showing up to 3):`);
      data.slice(0, 3).forEach((record, idx) => {
        console.log(`\n  Record ${idx + 1}:`);
        Object.entries(record).forEach(([key, value]) => {
          if (value === null || value === undefined) {
            console.log(`    ${key}: null`);
          } else if (typeof value === 'object') {
            console.log(`    ${key}: ${JSON.stringify(value).substring(0, 80)}...`);
          } else if (typeof value === 'string' && value.length > 100) {
            console.log(`    ${key}: ${value.substring(0, 100)}...`);
          } else {
            console.log(`    ${key}: ${value}`);
          }
        });
      });
    } else {
      console.log('⚠️  Table is empty');
    }

    return count;
  } catch (err) {
    console.log(`❌ Unexpected error: ${err.message}`);
    return 0;
  }
}

async function runInvestigation() {
  const criticalTables = [
    { name: 'users', order: 'created_at' },
    { name: 'scenarios', order: 'created_at' },
    { name: 'sessions', order: 'created_at' },
    { name: 'exchanges', order: 'timestamp' },
    { name: 'evaluations', order: 'created_at' },
    { name: 'ecos_sessions', order: 'start_time' },
    { name: 'ecos_messages', order: 'timestamp' },
    { name: 'ecos_evaluations', order: 'id' },
    { name: 'training_sessions', order: 'created_at' },
  ];

  const counts = {};

  for (const table of criticalTables) {
    counts[table.name] = await investigateTable(table.name, table.order);
  }

  // Summary
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 DATABASE SUMMARY');
  console.log('='.repeat(80));

  console.log('\n🗂️  Core Tables:');
  console.log(`   Users:                ${counts['users'] || 0} rows`);
  console.log(`   Scenarios:            ${counts['scenarios'] || 0} rows`);

  console.log('\n📝 Session & Message Tables:');
  console.log(`   sessions:             ${counts['sessions'] || 0} rows`);
  console.log(`   exchanges:            ${counts['exchanges'] || 0} rows`);
  console.log(`   evaluations:          ${counts['evaluations'] || 0} rows`);

  console.log('\n📚 ECOS Tables (from schema.ts):');
  console.log(`   ecos_sessions:        ${counts['ecos_sessions'] || 0} rows`);
  console.log(`   ecos_messages:        ${counts['ecos_messages'] || 0} rows`);
  console.log(`   ecos_evaluations:     ${counts['ecos_evaluations'] || 0} rows`);

  console.log('\n🎓 Training Tables:');
  console.log(`   training_sessions:    ${counts['training_sessions'] || 0} rows`);

  // Analysis
  console.log('\n\n' + '='.repeat(80));
  console.log('🔍 ANALYSIS & FINDINGS');
  console.log('='.repeat(80));

  const issues = [];
  const warnings = [];

  if ((counts['sessions'] || 0) === 0 && (counts['ecos_sessions'] || 0) === 0) {
    issues.push('❌ CRITICAL: No ECOS sessions found in either sessions or ecos_sessions table');
  }

  if ((counts['exchanges'] || 0) === 0 && (counts['ecos_messages'] || 0) === 0) {
    issues.push('❌ CRITICAL: No messages/exchanges found in database');
  }

  if ((counts['evaluations'] || 0) === 0 && (counts['ecos_evaluations'] || 0) === 0) {
    warnings.push('⚠️  WARNING: No evaluations stored in database');
  }

  if (counts['scenarios'] === 1) {
    warnings.push('⚠️  Only 1 scenario exists - limited training content');
  }

  if ((counts['sessions'] || 0) > 0 && (counts['ecos_sessions'] || 0) > 0) {
    warnings.push('⚠️  Data exists in BOTH sessions AND ecos_sessions - schema confusion');
  }

  if (issues.length > 0) {
    console.log('\n🚨 CRITICAL ISSUES:');
    issues.forEach(issue => console.log(`   ${issue}`));
  }

  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    warnings.forEach(warning => console.log(`   ${warning}`));
  }

  if (issues.length === 0 && warnings.length === 0) {
    console.log('\n✅ No critical issues detected');
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Investigation Complete');
  console.log('='.repeat(80));
}

runInvestigation().catch(err => {
  console.error('❌ Investigation failed:', err);
  process.exit(1);
});
