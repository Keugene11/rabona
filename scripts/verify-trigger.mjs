import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
const token = readFileSync(join(homedir(), '.supabase', 'access-token'), 'utf8').trim();
const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n').filter(l => l && !l.startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: `select pg_get_functiondef(oid) as def from pg_proc where proname = 'handle_new_user' and pronamespace = 'public'::regnamespace` }),
});
const j = JSON.parse(await res.text());
const def = j[0]?.def || '(not found)';
const hasGate = /raise exception 'signup_email_not_approved/.test(def);
console.log(hasGate ? 'GATE STILL ACTIVE (bad)' : 'OPEN SIGNUP (good)');
console.log('---');
console.log(def.split('\n').slice(0, 30).join('\n'));
