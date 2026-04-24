// List auth.users rows that have never confirmed their email.
// These are the accounts most likely driving Supabase bounce warnings.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

let page = 1;
const all = [];
while (true) {
  const { data, error } = await s.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) { console.error(error); process.exit(1); }
  all.push(...data.users);
  if (data.users.length < 1000) break;
  page++;
}
const unconfirmed = all.filter(u => !u.email_confirmed_at && !u.confirmed_at);
console.log(`total users: ${all.length}, unconfirmed: ${unconfirmed.length}`);
for (const u of unconfirmed) {
  console.log(` ${u.created_at.slice(0, 19)}  ${u.email}  (id=${u.id})`);
}
