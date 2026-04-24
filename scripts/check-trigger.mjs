import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
const token = readFileSync(join(homedir(), '.supabase', 'access-token'), 'utf8').trim();
const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n').filter(l => l && !l.startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];

async function q(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  return res.json();
}

console.log('=== handle_new_user source ===');
const fn = await q(`SELECT pg_get_functiondef(oid) AS src FROM pg_proc WHERE proname='handle_new_user' AND pronamespace='public'::regnamespace`);
console.log(fn[0]?.src || '(not found)');

console.log('\n=== triggers on auth.users ===');
const trigs = await q(`SELECT tgname, tgenabled, pg_get_triggerdef(oid) AS def FROM pg_trigger WHERE tgrelid='auth.users'::regclass AND NOT tgisinternal`);
for (const r of trigs) console.log(r.tgname, '| enabled=', r.tgenabled, '\n  ', r.def);

console.log('\n=== allowed domains ===');
console.log(await q(`SELECT * FROM public.auth_email_allowed_domains`));

console.log('\n=== allowlist for evan ===');
console.log(await q(`SELECT * FROM public.auth_email_allowlist WHERE lower(email) LIKE '%evha1magma%' OR lower(email) LIKE '%evan%'`));
