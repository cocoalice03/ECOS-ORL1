import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('🚀 Running ecos_admins migration...');
  console.log('');

  // Step 1: Insert admin email
  console.log('📝 Step 1: Inserting admin email into ecos_admins table...');
  const { data: insertData, error: insertError } = await supabase
    .from('ecos_admins')
    .insert({ email: 'cherubindavid@gmail.com', role: 'ADMIN' })
    .select();

  if (insertError) {
    if (insertError.code === '23505') {
      console.log('ℹ️  Admin email already exists (skipping)');
    } else {
      console.error('❌ Error inserting admin:', insertError.message);
    }
  } else {
    console.log('✅ Admin email inserted successfully');
  }

  // Verify admin exists
  console.log('');
  console.log('🔍 Verifying admin email...');
  const { data: verifyData, error: verifyError } = await supabase
    .from('ecos_admins')
    .select('*')
    .eq('email', 'cherubindavid@gmail.com');

  if (verifyError) {
    console.error('❌ Error verifying admin:', verifyError.message);
  } else {
    console.log('✅ Admin verified:', verifyData);
  }

  // Step 2: Drop unused tables using RPC
  console.log('');
  console.log('🗑️  Step 2: Dropping unused ecos_* tables...');

  const tablesToDrop = [
    'ecos_symptome',
    'ecos_rubrique_communication',
    'ecos_prise_en_charge',
    'ecos_patient_profil',
    'ecos_item_aptitude',
    'ecos_iconographie',
    'ecos_document',
    'ecos_consigne',
    'ecos_scenario',
    'profiles'
  ];

  console.log('⚠️  The following tables will be dropped:');
  tablesToDrop.forEach(table => console.log(`   - ${table}`));
  console.log('');
  console.log('⚠️  Note: Table drops must be executed via SQL Editor in Supabase Dashboard');
  console.log('⚠️  PostgREST API does not support DROP TABLE operations');
  console.log('');
  console.log('📋 SQL to execute in Supabase SQL Editor:');
  console.log('');
  console.log('-- Drop all unused ecos_* tables');
  tablesToDrop.forEach(table => {
    console.log(`DROP TABLE IF EXISTS public.${table} CASCADE;`);
  });

  // Step 3: List remaining tables
  console.log('');
  console.log('📊 Step 3: Listing current tables...');
  const { data: tables, error: tablesError } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .order('table_name');

  if (tablesError) {
    console.error('❌ Error listing tables:', tablesError.message);
  } else {
    console.log('✅ Current tables in public schema:');
    tables.forEach(({ table_name }) => console.log(`   - ${table_name}`));
  }

  console.log('');
  console.log('✅ Migration script completed!');
  console.log('');
  console.log('📝 Next steps:');
  console.log('1. Copy the DROP TABLE commands above');
  console.log('2. Open Supabase Dashboard > SQL Editor');
  console.log('3. Paste and execute the SQL commands');
  console.log('4. Verify tables are dropped using this script again');
}

runMigration().catch(console.error);
