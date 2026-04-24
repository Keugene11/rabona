import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const TABLES = [
  'profiles', 'wall_posts', 'comments', 'comment_likes', 'post_likes',
  'friendships', 'pokes', 'notifications', 'conversations', 'messages',
  'message_likes', 'groups', 'group_members', 'group_posts', 'blocks',
  'reports', 'profile_views', 'post_impressions',
  'auth_email_allowlist', 'auth_email_allowed_domains',
];

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
const outDir = join('backups', stamp);
mkdirSync(outDir, { recursive: true });

console.log(`Backing up to ${outDir}/`);
const summary = {};

for (const t of TABLES) {
  const rows = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await s.from(t).select('*').range(from, from + pageSize - 1);
    if (error) {
      console.log(`  ${t}: ERROR ${error.message}`);
      summary[t] = { error: error.message };
      break;
    }
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  writeFileSync(join(outDir, `${t}.json`), JSON.stringify(rows, null, 2));
  summary[t] = { rows: rows.length };
  console.log(`  ${t}: ${rows.length} rows`);
}

// Also snapshot storage bucket listings (not the files themselves — that's too much data on a small disk)
const { data: buckets } = await s.storage.listBuckets();
const storageIndex = {};
for (const b of buckets || []) {
  const { data: entries } = await s.storage.from(b.name).list('', { limit: 10000 });
  storageIndex[b.name] = entries || [];
}
writeFileSync(join(outDir, '_storage-index.json'), JSON.stringify(storageIndex, null, 2));

writeFileSync(join(outDir, '_summary.json'), JSON.stringify({ timestamp: new Date().toISOString(), tables: summary }, null, 2));
console.log(`\nDone. Summary at ${outDir}/_summary.json`);
