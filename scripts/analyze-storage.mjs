import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const fmt = n => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

// Fetch all storage.objects via SQL-like RPC. We don't have a generic RPC here,
// so instead we iterate known top-level folders (userId-prefixed) for each bucket.
// Simpler approach: call storage REST /object/list with recursive via search.
async function listAllObjects(bucket) {
  const all = [];
  let offset = 0;
  const limit = 1000;
  // List top-level entries (could be files or folder "placeholders")
  async function listAt(prefix) {
    let off = 0;
    const out = [];
    while (true) {
      const { data, error } = await s.storage.from(bucket).list(prefix, { limit, offset: off, sortBy: { column: 'name', order: 'asc' } });
      if (error) throw error;
      if (!data || data.length === 0) break;
      out.push(...data);
      if (data.length < limit) break;
      off += limit;
    }
    return out;
  }
  async function walk(prefix) {
    const entries = await listAt(prefix);
    for (const e of entries) {
      const path = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.id === null || e.metadata === null) {
        // Folder (Supabase Storage marks folders with null id/metadata)
        await walk(path);
      } else {
        all.push({
          path,
          size: Number(e.metadata?.size ?? 0),
          mime: e.metadata?.mimetype ?? '',
          created_at: e.created_at,
          updated_at: e.updated_at,
        });
      }
    }
  }
  await walk('');
  return all;
}

// Extract the storage path portion from a public URL.
// Supabase public URL format: <url>/storage/v1/object/public/<bucket>/<path>
function extractPath(bucket, url) {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return decodeURIComponent(url.slice(i + marker.length).split('?')[0]);
}

console.log('Listing storage objects...');
const avatarsObjects = await listAllObjects('avatars');
console.log(`  avatars: ${avatarsObjects.length} files, ${fmt(avatarsObjects.reduce((a, b) => a + b.size, 0))}`);
const postsObjects = await listAllObjects('posts');
console.log(`  posts:   ${postsObjects.length} files, ${fmt(postsObjects.reduce((a, b) => a + b.size, 0))}`);

console.log('\nCollecting referenced paths from DB...');

const referenced = { avatars: new Set(), posts: new Set() };

async function collect(table, col, bucket) {
  let from = 0;
  const pageSize = 1000;
  let count = 0;
  while (true) {
    const { data, error } = await s.from(table).select(`${col}`).not(col, 'is', null).range(from, from + pageSize - 1);
    if (error) { console.log(`  ${table}.${col}: ERROR ${error.message}`); return; }
    if (!data || data.length === 0) break;
    for (const row of data) {
      const p = extractPath(bucket, row[col]);
      if (p) { referenced[bucket].add(p); count++; }
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  console.log(`  ${table}.${col} → ${bucket}: ${count} paths`);
}

await collect('profiles', 'avatar_url', 'avatars');
await collect('wall_posts', 'media_url', 'posts');
await collect('comments', 'media_url', 'posts');
await collect('group_posts', 'media_url', 'posts');
await collect('messages', 'media_url', 'posts');
await collect('groups', 'image_url', 'posts');

function analyze(bucket, objs) {
  const ref = referenced[bucket];
  const orphans = objs.filter(o => !ref.has(o.path));
  const reachable = objs.filter(o => ref.has(o.path));
  const totalSize = objs.reduce((a, b) => a + b.size, 0);
  const orphanSize = orphans.reduce((a, b) => a + b.size, 0);
  return { bucket, totalFiles: objs.length, totalSize, reachableFiles: reachable.length, orphanFiles: orphans.length, orphanSize, orphans };
}

const report = {
  timestamp: new Date().toISOString(),
  avatars: analyze('avatars', avatarsObjects),
  posts: analyze('posts', postsObjects),
};

console.log('\n=== REPORT ===');
for (const b of ['avatars', 'posts']) {
  const r = report[b];
  console.log(`\n[${b}]`);
  console.log(`  total:      ${r.totalFiles} files, ${fmt(r.totalSize)}`);
  console.log(`  reachable:  ${r.reachableFiles} files`);
  console.log(`  ORPHANED:   ${r.orphanFiles} files, ${fmt(r.orphanSize)}`);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
mkdirSync('backups', { recursive: true });
const outPath = join('backups', `storage-report-${stamp}.json`);
// Trim orphans listing to just the fields we need
const writeable = {
  ...report,
  avatars: { ...report.avatars, orphans: report.avatars.orphans.map(o => ({ path: o.path, size: o.size, updated_at: o.updated_at })) },
  posts: { ...report.posts, orphans: report.posts.orphans.map(o => ({ path: o.path, size: o.size, updated_at: o.updated_at })) },
};
writeFileSync(outPath, JSON.stringify(writeable, null, 2));
console.log(`\nFull report (incl. orphan paths) written to: ${outPath}`);
