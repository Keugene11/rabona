import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const token = readFileSync(join(homedir(), '.supabase', 'access-token'), 'utf8').trim();
const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n').filter(l => l && !l.startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];

async function get(path) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}${path}`, { headers: { 'Authorization': `Bearer ${token}` } });
  return { status: res.status, body: await res.text() };
}

console.log('--- project info ---');
const proj = await get('');
console.log(proj.status, proj.body.slice(0, 500));

console.log('\n--- backups ---');
const backups = await get('/database/backups');
console.log(backups.status, backups.body.slice(0, 1500));

console.log('\n--- PITR status ---');
const pitr = await get('/database/pitr');
console.log(pitr.status, pitr.body.slice(0, 500));
