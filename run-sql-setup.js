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

async function executeSQLFile() {
  try {
    console.log('\n📄 Reading SQL file...');
    const sqlFilePath = join(__dirname, 'setup-database-tables.sql');
    const sqlContent = readFileSync(sqlFilePath, 'utf-8');

    // Split the SQL into individual statements (simple split by semicolon)
    // This is a simplified approach - for production you'd want a proper SQL parser
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('SELECT'));

    console.log(`\n📊 Found ${statements.length} SQL statements to execute\n`);
    console.log('=' .repeat(80));

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip comment-only lines and SELECT queries (verification queries)
      if (!statement || statement.startsWith('--')) {
        continue;
      }

      // Extract a short description of what this statement does
      const firstLine = statement.split('\n')[0].substring(0, 60);
      const statementNum = `[${i + 1}/${statements.length}]`;

      try {
        console.log(`${statementNum} Executing: ${firstLine}...`);

        const { data, error } = await supabase.rpc('exec_sql', {
          sql: statement + ';'
        }).catch(async (err) => {
          // If RPC doesn't exist, try direct query
          return await supabase.from('_').select('*').limit(0).then(() => {
            // Fallback: use PostgREST's ability to execute raw SQL is limited
            // We'll need to use a different approach
            throw new Error('Cannot execute arbitrary SQL via Supabase REST API');
          });
        });

        if (error) {
          console.log(`   ⚠️  Warning: ${error.message}`);
          if (error.code !== '42P07') { // Ignore "already exists" errors
            errorCount++;
          }
        } else {
          console.log(`   ✅ Success`);
          successCount++;
        }
      } catch (err) {
        console.log(`   ❌ Error: ${err.message}`);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`\n📊 Execution Summary:`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📝 Total: ${statements.length}`);

    if (errorCount === 0) {
      console.log(`\n✅ All SQL statements executed successfully!`);
    } else {
      console.log(`\n⚠️  Some statements failed. This might be okay if tables already exist.`);
      console.log(`   Check the Supabase dashboard to verify table structure.`);
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error('\n💡 Alternative: Copy the SQL from setup-database-tables.sql');
    console.error('   and run it directly in the Supabase SQL Editor at:');
    console.error(`   ${supabaseUrl.replace('//', '//supabase.com/dashboard/project/')}/editor`);
    process.exit(1);
  }
}

console.log('🚀 Starting SQL execution...\n');
executeSQLFile().then(() => {
  console.log('\n✅ Done!');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Unexpected error:', err);
  process.exit(1);
});
