/**
 * Supabase Database Investigation Script
 *
 * This script directly queries the Supabase database to analyze:
 * - Table schemas and row counts
 * - Recent records from critical tables
 * - Foreign key relationships
 * - Data integrity issues
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

console.log('🔍 SUPABASE DATABASE INVESTIGATION');
console.log('=' .repeat(80));
console.log(`📡 Connected to: ${SUPABASE_URL}`);
console.log('=' .repeat(80));

/**
 * Query table row count
 */
async function getTableCount(tableName) {
  try {
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (error) {
      return { error: error.message };
    }
    return { count };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Get recent records from a table
 */
async function getRecentRecords(tableName, limit = 5, orderBy = 'created_at') {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .order(orderBy, { ascending: false })
      .limit(limit);

    if (error) {
      return { error: error.message };
    }
    return { data };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Get table schema information
 */
async function getTableSchema(tableName) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);

    if (error) {
      return { error: error.message };
    }

    if (data && data.length > 0) {
      const columns = Object.keys(data[0]);
      return { columns };
    }

    return { columns: [] };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Main investigation function
 */
async function investigateDatabase() {
  const tables = [
    { name: 'users', orderBy: 'created_at' },
    { name: 'scenarios', orderBy: 'created_at' },
    { name: 'sessions', orderBy: 'created_at' },
    { name: 'exchanges', orderBy: 'timestamp' },
    { name: 'evaluations', orderBy: 'evaluated_at' },
    { name: 'training_sessions', orderBy: 'created_at' },
    { name: 'training_session_students', orderBy: 'assigned_at' },
  ];

  console.log('\n📊 TABLE ANALYSIS\n');

  for (const table of tables) {
    console.log('─'.repeat(80));
    console.log(`\n📋 TABLE: ${table.name.toUpperCase()}`);
    console.log('─'.repeat(80));

    // Get row count
    const countResult = await getTableCount(table.name);
    if (countResult.error) {
      console.log(`❌ Error getting count: ${countResult.error}`);
      console.log('⚠️  Table might not exist or is inaccessible\n');
      continue;
    }

    console.log(`📈 Total rows: ${countResult.count}`);

    // Get schema
    const schemaResult = await getTableSchema(table.name);
    if (schemaResult.error) {
      console.log(`❌ Error getting schema: ${schemaResult.error}`);
    } else if (schemaResult.columns) {
      console.log(`📝 Columns (${schemaResult.columns.length}): ${schemaResult.columns.join(', ')}`);
    }

    // Get recent records
    if (countResult.count > 0) {
      const recordsResult = await getRecentRecords(table.name, 3, table.orderBy);
      if (recordsResult.error) {
        console.log(`❌ Error getting records: ${recordsResult.error}`);
      } else if (recordsResult.data && recordsResult.data.length > 0) {
        console.log(`\n📄 Recent Records (showing ${recordsResult.data.length}):`);
        recordsResult.data.forEach((record, index) => {
          console.log(`\n  Record ${index + 1}:`);

          // Display key fields based on table type
          if (table.name === 'sessions') {
            console.log(`    - ID: ${record.id}`);
            console.log(`    - Session ID: ${record.session_id}`);
            console.log(`    - Student: ${record.student_email}`);
            console.log(`    - Scenario ID: ${record.scenario_id}`);
            console.log(`    - Status: ${record.status}`);
            console.log(`    - Created: ${record.created_at}`);
          } else if (table.name === 'exchanges') {
            console.log(`    - ID: ${record.id}`);
            console.log(`    - Session ID: ${record.session_id}`);
            console.log(`    - Role: ${record.role}`);
            console.log(`    - Question: ${record.question ? record.question.substring(0, 60) + '...' : 'N/A'}`);
            console.log(`    - Response: ${record.response ? record.response.substring(0, 60) + '...' : 'N/A'}`);
            console.log(`    - Timestamp: ${record.timestamp}`);
          } else if (table.name === 'evaluations') {
            console.log(`    - ID: ${record.id}`);
            console.log(`    - Session ID: ${record.session_id}`);
            console.log(`    - Student: ${record.student_email}`);
            console.log(`    - Global Score: ${record.global_score}`);
            console.log(`    - Evaluated: ${record.evaluated_at}`);
          } else if (table.name === 'scenarios') {
            console.log(`    - ID: ${record.id}`);
            console.log(`    - Title: ${record.title}`);
            console.log(`    - Created by: ${record.created_by}`);
            console.log(`    - Created: ${record.created_at}`);
          } else if (table.name === 'users') {
            console.log(`    - ID: ${record.id}`);
            console.log(`    - Email: ${record.email}`);
            console.log(`    - Role: ${record.role || 'Not set'}`);
            console.log(`    - Created: ${record.created_at}`);
          } else {
            // Generic display for other tables
            Object.entries(record).forEach(([key, value]) => {
              if (typeof value === 'string' && value.length > 100) {
                console.log(`    - ${key}: ${value.substring(0, 100)}...`);
              } else if (typeof value === 'object') {
                console.log(`    - ${key}: [Object]`);
              } else {
                console.log(`    - ${key}: ${value}`);
              }
            });
          }
        });
      }
    } else {
      console.log('⚠️  No records found in this table');
    }

    console.log('');
  }

  // Additional analysis: Check for orphaned records
  console.log('\n🔗 FOREIGN KEY RELATIONSHIP ANALYSIS\n');
  console.log('─'.repeat(80));

  // Check sessions without scenarios
  const { data: sessionsWithoutScenarios, error: sessionsError } = await supabase
    .from('sessions')
    .select('id, session_id, scenario_id')
    .is('scenario_id', null);

  if (!sessionsError) {
    console.log(`\n📊 Sessions without scenario_id: ${sessionsWithoutScenarios?.length || 0}`);
    if (sessionsWithoutScenarios && sessionsWithoutScenarios.length > 0) {
      sessionsWithoutScenarios.slice(0, 3).forEach(s => {
        console.log(`   - Session ${s.session_id} (DB ID: ${s.id})`);
      });
    }
  }

  // Check exchanges without sessions
  const { data: exchangesWithoutSessions, error: exchangesError } = await supabase
    .from('exchanges')
    .select('id, session_id')
    .is('session_id', null);

  if (!exchangesError) {
    console.log(`\n📊 Exchanges without session_id: ${exchangesWithoutSessions?.length || 0}`);
  }

  // Check evaluations without sessions
  const { data: evaluationsWithoutSessions, error: evaluationsError } = await supabase
    .from('evaluations')
    .select('id, session_id')
    .is('session_id', null);

  if (!evaluationsError) {
    console.log(`\n📊 Evaluations without session_id: ${evaluationsWithoutSessions?.length || 0}`);
  }

  console.log('\n' + '─'.repeat(80));

  // Summary
  console.log('\n📋 SUMMARY\n');
  console.log('─'.repeat(80));

  const userCount = await getTableCount('users');
  const scenarioCount = await getTableCount('scenarios');
  const sessionCount = await getTableCount('sessions');
  const exchangeCount = await getTableCount('exchanges');
  const evaluationCount = await getTableCount('evaluations');

  console.log(`Users: ${userCount.count !== undefined ? userCount.count : 'ERROR'}`);
  console.log(`Scenarios: ${scenarioCount.count !== undefined ? scenarioCount.count : 'ERROR'}`);
  console.log(`Sessions: ${sessionCount.count !== undefined ? sessionCount.count : 'ERROR'}`);
  console.log(`Exchanges (Messages): ${exchangeCount.count !== undefined ? exchangeCount.count : 'ERROR'}`);
  console.log(`Evaluations: ${evaluationCount.count !== undefined ? evaluationCount.count : 'ERROR'}`);

  console.log('\n' + '='.repeat(80));
  console.log('✅ Investigation complete!');
  console.log('='.repeat(80));
}

// Run investigation
investigateDatabase().catch(err => {
  console.error('❌ Investigation failed:', err);
  process.exit(1);
});
