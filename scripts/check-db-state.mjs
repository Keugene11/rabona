import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
const token = readFileSync(join(homedir(), '.supabase', 'access-token'), 'utf8').trim();
const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n').filter(l => l && !l.startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];

async function q(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  return { status: res.status, body: await res.text() };
}

console.log('functions:');
console.log((await q(`select proname from pg_proc where pronamespace = 'public'::regnamespace and proname in ('generate_username','handle_new_user') order by proname;`)).body);

console.log('\nprofiles columns:');
console.log((await q(`select column_name from information_schema.columns where table_schema='public' and table_name='profiles' order by ordinal_position;`)).body);

console.log('\nallowlist tables exist:');
console.log((await q(`select tablename from pg_tables where schemaname='public' and tablename in ('auth_email_allowlist','auth_email_allowed_domains');`)).body);
