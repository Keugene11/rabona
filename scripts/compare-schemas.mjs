import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const token = readFileSync(join(homedir(), '.supabase', 'access-token'), 'utf8').trim();

function loadEnv(path) {
  return Object.fromEntries(readFileSync(path, 'utf8').split('\n').filter(l => l && !l.startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
}
const rabonaEnv = loadEnv(new URL('../.env.local', import.meta.url));
const stonyEnv = loadEnv('C:/Users/Daniel/Projects/stonyloop/.env.local');

async function cols(ref, table) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `select column_name from information_schema.columns where table_schema='public' and table_name='${table}' order by column_name` }),
  });
  const j = JSON.parse(await res.text());
  return new Set(j.map(r => r.column_name));
}

const rabonaRef = new URL(rabonaEnv.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const stonyRef = new URL(stonyEnv.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];

for (const t of ['profiles', 'wall_posts', 'comments', 'messages', 'conversations', 'friendships', 'notifications', 'pokes', 'groups', 'group_posts', 'group_members', 'blocks', 'reports']) {
  const [rCols, sCols] = await Promise.all([cols(rabonaRef, t), cols(stonyRef, t)]);
  if (sCols.size === 0) continue;
  const missing = [...sCols].filter(c => !rCols.has(c));
  const extra = [...rCols].filter(c => !sCols.has(c));
  if (missing.length || extra.length || rCols.size === 0) {
    console.log(`\n=== ${t} ===`);
    if (rCols.size === 0) console.log('  MISSING TABLE in rabona');
    if (missing.length) console.log(`  missing in rabona: ${missing.join(', ')}`);
    if (extra.length)   console.log(`  extra in rabona:   ${extra.join(', ')}`);
  }
}
