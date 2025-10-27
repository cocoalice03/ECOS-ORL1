import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkExchanges() {
  console.log('\n📊 CHECKING ALL EXCHANGES IN DATABASE\n');
  console.log('=' .repeat(80));

  // Get all sessions
  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .select('id, session_id, student_email, created_at')
    .order('created_at', { ascending: false });

  if (sessionsError) {
    console.error('❌ Error fetching sessions:', sessionsError);
    return;
  }

  console.log(`\n✅ Found ${sessions.length} sessions:\n`);

  for (const session of sessions) {
    console.log(`Session ID: ${session.session_id}`);
    console.log(`  DB ID: ${session.id}`);
    console.log(`  Student: ${session.student_email}`);
    console.log(`  Created: ${session.created_at}`);

    // Get exchanges for this session
    const { data: exchanges, error: exchangesError } = await supabase
      .from('exchanges')
      .select('id, role, question, response, timestamp, created_at')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true });

    if (exchangesError) {
      console.error(`  ❌ Error fetching exchanges:`, exchangesError);
    } else {
      console.log(`  📝 Exchanges: ${exchanges.length}`);

      if (exchanges.length > 0) {
        exchanges.forEach((ex, idx) => {
          console.log(`    ${idx + 1}. [${ex.role}] ${ex.question || ex.response || '(empty)'}`);
          console.log(`       Timestamp: ${ex.timestamp || ex.created_at}`);
        });
      }
    }
    console.log('');
  }

  console.log('=' .repeat(80));

  // Also check total exchanges
  const { data: allExchanges, error: allError } = await supabase
    .from('exchanges')
    .select('id, session_id, role');

  if (!allError) {
    console.log(`\n📊 Total exchanges across all sessions: ${allExchanges.length}\n`);

    // Group by session_id
    const bySession = allExchanges.reduce((acc, ex) => {
      acc[ex.session_id] = (acc[ex.session_id] || 0) + 1;
      return acc;
    }, {});

    console.log('Exchanges per session (by DB ID):');
    Object.entries(bySession).forEach(([sessionId, count]) => {
      console.log(`  Session ${sessionId}: ${count} exchanges`);
    });
  }
}

checkExchanges().then(() => {
  console.log('\n✅ Done!');
  process.exit(0);
}).catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
