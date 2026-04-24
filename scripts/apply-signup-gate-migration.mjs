import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const token = readFileSync(join(homedir(), '.supabase', 'access-token'), 'utf8').trim();
const sql = readFileSync(new URL('../supabase-migration-signup-gate.sql', import.meta.url), 'utf8');

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
const ref = url.hostname.split('.')[0];

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
});

const text = await res.text();
console.log(`status: ${res.status}`);
console.log(text);
if (!res.ok) process.exit(1);
