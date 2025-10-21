import { readFileSync } from 'fs';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function applyMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔄 Connecting to Supabase database...');
    const client = await pool.connect();
    console.log('✅ Connected successfully');

    // Read migration file
    const migrationSQL = readFileSync('./migrations/add-evaluation-columns.sql', 'utf8');
    console.log('📄 Migration file loaded');

    // Execute migration
    console.log('🚀 Applying migration...');
    await client.query(migrationSQL);
    console.log('✅ Migration applied successfully!');

    // Verify columns were added
    console.log('\n🔍 Verifying new columns...');
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'evaluations'
      AND column_name IN ('heuristic', 'llm_score_percent', 'criteria_details', 'summary', 'created_at', 'updated_at')
      ORDER BY column_name;
    `);

    console.log('\n📋 New columns in evaluations table:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    client.release();
    await pool.end();

    console.log('\n✨ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Details:', error);
    await pool.end();
    process.exit(1);
  }
}

applyMigration();