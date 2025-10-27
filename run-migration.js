import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  process.exit(1);
}

console.log('🔧 Connecting to Supabase...');
console.log(`   URL: ${supabaseUrl}`);

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  try {
    console.log('\n📄 Adding timestamp column to exchanges table...\n');

    // Check if column exists first
    console.log('1️⃣ Checking current table structure...');

    const { data: columns, error: checkError } = await supabase
      .from('exchanges')
      .select('*')
      .limit(0);

    if (checkError) {
      console.log('   ⚠️  Warning:', checkError.message);
    } else {
      console.log('   ✅ exchanges table is accessible');
    }

    // Try to add the column using a direct SQL approach
    // Since Supabase REST API is limited, we'll guide manual execution
    console.log('\n2️⃣ Column addition required...\n');

    const sqlFilePath = join(__dirname, 'add-timestamp-column.sql');
    const sqlContent = readFileSync(sqlFilePath, 'utf-8');

    console.log('📝 Migration SQL:');
    console.log('=' .repeat(80));
    console.log(sqlContent);
    console.log('=' .repeat(80));

    console.log('\n⚠️  NOTE: Supabase REST API cannot execute DDL commands (ALTER TABLE)');
    console.log('\n📋 Please execute this migration manually:');
    console.log('\n   1. Open Supabase SQL Editor:');
    console.log(`      ${supabaseUrl.replace('https://', 'https://supabase.com/dashboard/project/')}/sql/new`);
    console.log('\n   2. Copy the SQL above');
    console.log('\n   3. Paste and run it in the SQL Editor');
    console.log('\n   4. Verify with: SELECT * FROM information_schema.columns WHERE table_name = \'exchanges\' AND column_name = \'timestamp\';');

    // Try to verify the column after manual execution
    console.log('\n🔍 Attempting to verify column (may fail if not added yet)...');

    try {
      const { data: testData, error: testError } = await supabase
        .from('exchanges')
        .select('id, timestamp')
        .limit(1);

      if (testError && testError.message.includes('timestamp')) {
        console.log('   ❌ Column not found - manual migration needed');
      } else {
        console.log('   ✅ timestamp column appears to be present!');
      }
    } catch (err) {
      console.log('   ⚠️  Verification error:', err.message);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

console.log('🚀 Starting migration check...\n');
runMigration().then(() => {
  console.log('\n✅ Migration check complete!');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Unexpected error:', err);
  process.exit(1);
});
