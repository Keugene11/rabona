import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n').filter(l => l && !l.startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const token = readFileSync(join(homedir(), '.supabase', 'access-token'), 'utf8').trim();
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];

// 1) List every table in the public schema + every FK referencing profiles with its ON DELETE action
const listFKs = `
SELECT
  conrelid::regclass::text AS table_name,
  confrelid::regclass::text AS references,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE contype = 'f'
  AND (connamespace = 'public'::regnamespace)
ORDER BY 1, 2;
`;
const r1 = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: listFKs }),
});
const fks = await r1.json();
console.log('=== ALL FOREIGN KEYS IN public SCHEMA ===');
const nonCascading = [];
for (const fk of fks) {
  const isCascade = /ON DELETE CASCADE/i.test(fk.definition);
  const refsProfiles = /profiles/i.test(fk.references);
  console.log(`  ${fk.table_name} → ${fk.references}  ${isCascade ? '[CASCADE]' : '[!! NO CASCADE]'}`);
  if (refsProfiles && !isCascade) nonCascading.push(fk);
}

console.log('\n=== TABLES REFERENCING profiles WITHOUT CASCADE ===');
if (!nonCascading.length) console.log('  (none — everything referring to profiles cascaded on delete)');
else for (const fk of nonCascading) console.log(`  ${fk.table_name} (${fk.definition})`);

// 2) List all tables + count rows
const listTables = `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;`;
const r2 = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: listTables }),
});
const tables = (await r2.json()).map(r => r.tablename);
console.log('\n=== ALL PUBLIC TABLES ===');
for (const t of tables) {
  const { count } = await s.from(t).select('*', { count: 'exact', head: true });
  console.log(`  ${t}: ${count ?? 'n/a'} rows`);
}

// 3) Check Supabase logs for recent events (they retain ~1 day on free tier)
console.log('\n=== RECENT AUTH/DATABASE LOG EVENTS ===');
// The logs endpoint takes a BigQuery-like SQL query
const logsSql = `
select timestamp, event_message
from postgres_logs
where timestamp > timestamp_sub(current_timestamp(), interval 2 hour)
  and event_message like '%keugenelee11%'
order by timestamp desc
limit 50
`;
try {
  const r3 = await fetch(`https://api.supabase.com/v1/projects/${ref}/analytics/endpoints/logs.all?sql=${encodeURIComponent(logsSql)}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const txt = await r3.text();
  console.log(`  status: ${r3.status}`);
  console.log(`  ${txt.slice(0, 2000)}`);
} catch (e) { console.log('  (logs API unavailable)', e.message); }
