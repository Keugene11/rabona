import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
const token = readFileSync(join(homedir(), '.supabase', 'access-token'), 'utf8').trim();
const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n').filter(l => l && !l.startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: 'PATCH',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ mailer_autoconfirm: false }),
});
console.log(`status: ${res.status}`);
console.log(await res.text());

// Verify
const verify = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  headers: { 'Authorization': `Bearer ${token}` },
});
const cfg = await verify.json();
console.log(`\nverified mailer_autoconfirm = ${cfg.mailer_autoconfirm}`);
