import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
const token = readFileSync(join(homedir(), '.supabase', 'access-token'), 'utf8').trim();
const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n').filter(l => l && !l.startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const sql = `
select
  (select count(*) from public.profiles) as total_profiles,
  (select count(*) from public.profiles where username is null) as null_usernames,
  (select count(distinct username) from public.profiles) as distinct_usernames,
  (select count(*) from public.profiles where username !~ '^[a-z0-9_]{3,20}$') as invalid_format;
`;
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
});
console.log(`status: ${res.status}`);
console.log(await res.text());

const sample = `select id, full_name, username from public.profiles order by created_at desc limit 10;`;
const res2 = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sample }),
});
console.log(await res2.text());
