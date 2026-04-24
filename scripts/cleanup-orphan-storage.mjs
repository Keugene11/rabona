// Deletes orphan files in storage buckets based on the most recent
// storage-report-*.json from backups/. ORPHAN = file in bucket whose path is
// not referenced by any current DB row. DEFAULT is DRY-RUN. Pass --apply to
// actually delete.
//
// Safety:
//   - refuses to run if no storage-report file is present
//   - refuses to run if the report is older than 60 minutes (stale; re-run
//     analyze-storage.mjs first)
//   - on --apply, still re-fetches the current referenced set and intersects
//     the orphan list to avoid deleting any file that has since been referenced
//   - deletes in small batches and logs each batch

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const apply = process.argv.includes('--apply');

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Locate most recent storage-report
const reports = readdirSync('backups').filter(f => f.startsWith('storage-report-')).sort();
if (!reports.length) { console.error('No storage-report-*.json in backups/. Run scripts/analyze-storage.mjs first.'); process.exit(1); }
const reportPath = join('backups', reports[reports.length - 1]);
const report = JSON.parse(readFileSync(reportPath, 'utf8'));
const ageMin = (Date.now() - new Date(report.timestamp).getTime()) / 60000;
if (ageMin > 60) { console.error(`Report is ${ageMin.toFixed(0)} min old. Re-run analyze-storage.mjs first.`); process.exit(1); }
console.log(`Using report: ${reportPath} (${ageMin.toFixed(1)} min old)`);

// Re-check referenced paths at delete time (defense against new uploads
// happening between analyze and cleanup)
function extractPath(bucket, url) {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return decodeURIComponent(url.slice(i + marker.length).split('?')[0]);
}
async function referencedPaths(table, col, bucket) {
  const out = new Set();
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await s.from(table).select(col).not(col, 'is', null).range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const row of data) { const p = extractPath(bucket, row[col]); if (p) out.add(p); }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}
const currentAvatars = await referencedPaths('profiles', 'avatar_url', 'avatars');
const currentPosts = new Set([
  ...await referencedPaths('wall_posts', 'media_url', 'posts'),
  ...await referencedPaths('comments', 'media_url', 'posts'),
  ...await referencedPaths('group_posts', 'media_url', 'posts'),
  ...await referencedPaths('messages', 'media_url', 'posts'),
  ...await referencedPaths('groups', 'image_url', 'posts'),
]);

async function cleanupBucket(bucketName, orphans, currentRefs) {
  const safe = orphans.filter(o => !currentRefs.has(o.path));
  const rescued = orphans.length - safe.length;
  if (rescued > 0) console.log(`[${bucketName}] rescued ${rescued} file(s) that became referenced since analysis`);

  const totalBytes = safe.reduce((a, b) => a + b.size, 0);
  console.log(`[${bucketName}] ${safe.length} orphans to delete (${(totalBytes / 1024 / 1024 / 1024).toFixed(2)} GB)`);
  if (!apply) { console.log(`  DRY RUN — no files removed. Sample:`); safe.slice(0, 5).forEach(o => console.log(`    ${o.path} (${(o.size/1024/1024).toFixed(1)} MB)`)); return; }

  const batchSize = 100;
  let done = 0, failed = 0;
  for (let i = 0; i < safe.length; i += batchSize) {
    const batch = safe.slice(i, i + batchSize);
    const paths = batch.map(o => o.path);
    const { data, error } = await s.storage.from(bucketName).remove(paths);
    if (error) { console.error(`  batch ${i}-${i+batch.length} FAILED: ${error.message}`); failed += batch.length; continue; }
    done += data?.length ?? batch.length;
    process.stdout.write(`  progress: ${done}/${safe.length}\r`);
  }
  console.log(`\n[${bucketName}] removed ${done}, failed ${failed}`);
}

console.log(`\n${apply ? 'APPLY MODE' : 'DRY RUN'}`);
await cleanupBucket('avatars', report.avatars.orphans, currentAvatars);
await cleanupBucket('posts', report.posts.orphans, currentPosts);
console.log('\nDone.');
