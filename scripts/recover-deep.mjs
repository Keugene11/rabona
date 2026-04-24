import { createClient } from '@supabase/supabase-js';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';

const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n').filter(l => l && !l.startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: profiles } = await s.from('profiles').select('id, email, full_name');
const profileIds = new Set(profiles.map(p => p.id));
const profileEmailById = Object.fromEntries(profiles.map(p => [p.id, p.email]));

// 1) Deep inspect the posts bucket orphans — list every file
console.log('=== POSTS BUCKET ORPHAN FOLDERS ===');
const orphanPostsFolders = ['17fe47e9-1af7-4f9b-8e76-1933399a515f', '3bb8b720-7e2a-4e57-8982-5af1531deb9a'];
mkdirSync('recovered', { recursive: true });

for (const folder of orphanPostsFolders) {
  console.log(`\n--- posts/${folder}/ ---`);
  const { data: files, error } = await s.storage.from('posts').list(folder, { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } });
  if (error) { console.log('  error:', error.message); continue; }
  console.log(`  ${files?.length || 0} files`);
  for (const f of files || []) {
    console.log(`    ${f.created_at?.slice(0, 19)}  ${f.name}  ${f.metadata?.size ?? ''}`);
  }

  // Download each file into recovered/posts-{folder}/
  const outDir = `recovered/posts-${folder}`;
  mkdirSync(outDir, { recursive: true });
  for (const f of files || []) {
    const { data: blob } = await s.storage.from('posts').download(`${folder}/${f.name}`);
    if (blob) {
      const buf = Buffer.from(await blob.arrayBuffer());
      writeFileSync(`${outDir}/${f.name}`, buf);
    }
  }
  console.log(`  → downloaded to ${outDir}/`);
}

// 2) Is either of those orphan UUIDs also an orphan in avatars? That's strong confirmation it was a real active user.
console.log('\n=== CHECKING IF POSTS-ORPHAN UUIDS ALSO HAVE AVATARS ===');
for (const folder of orphanPostsFolders) {
  const { data: avFiles } = await s.storage.from('avatars').list(folder, { limit: 10 });
  console.log(`  avatars/${folder}/ → ${avFiles?.length || 0} files`);
  if (avFiles?.length) {
    const outDir = `recovered/avatar-${folder}`;
    mkdirSync(outDir, { recursive: true });
    for (const f of avFiles) {
      const { data: blob } = await s.storage.from('avatars').download(`${folder}/${f.name}`);
      if (blob) writeFileSync(`${outDir}/${f.name}`, Buffer.from(await blob.arrayBuffer()));
    }
    console.log(`    → saved to ${outDir}/`);
  }
}

// 3) Full scan: every notification, extract ALL referenced IDs and find which are deleted users
console.log('\n=== ALL NOTIFICATIONS WITH DELETED-USER REFS ===');
const { data: allNotifs } = await s.from('notifications').select('*').order('created_at', { ascending: false });
const deletedUsers = new Map(); // userId → [notifs they're mentioned in]
for (const n of allNotifs || []) {
  for (const col of ['user_id', 'actor_id']) {
    if (n[col] && !profileIds.has(n[col])) {
      if (!deletedUsers.has(n[col])) deletedUsers.set(n[col], []);
      deletedUsers.get(n[col]).push({ col, notif: n });
    }
  }
}
console.log(`deleted users referenced in notifications: ${deletedUsers.size}`);
for (const [uid, list] of deletedUsers) {
  console.log(`\n  ${uid} → ${list.length} notification(s)`);
  const isOrphanPostsFolder = orphanPostsFolders.includes(uid);
  if (isOrphanPostsFolder) console.log('    ★ MATCHES an orphan posts-bucket folder — likely keugenelee11');
  for (const { col, notif } of list) {
    console.log(`    as ${col}: type=${notif.type}  content=${JSON.stringify(notif.content)}  created_at=${notif.created_at?.slice(0, 19)}`);
  }
}

// 4) Export every notification with non-null content — these contain actual text that survived
console.log('\n=== ALL NOTIFICATIONS WITH NON-NULL CONTENT ===');
const withContent = (allNotifs || []).filter(n => n.content);
console.log(`${withContent.length} notifications with text content:`);
for (const n of withContent) {
  console.log(`  ${n.created_at?.slice(0, 19)}  type=${n.type}  actor=${profileEmailById[n.actor_id] || n.actor_id}  user=${profileEmailById[n.user_id] || n.user_id}`);
  console.log(`    "${n.content}"`);
}

writeFileSync('recovered/notifications-snapshot.json', JSON.stringify(allNotifs, null, 2));
console.log('\nSaved full notifications snapshot to recovered/notifications-snapshot.json');
