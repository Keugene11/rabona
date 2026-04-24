import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n').filter(l => l && !l.startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// 1) List storage buckets
console.log('=== STORAGE BUCKETS ===');
const { data: buckets, error: bErr } = await s.storage.listBuckets();
if (bErr) console.log('error:', bErr);
else for (const b of buckets) console.log(`  ${b.name} (public=${b.public})`);

// 2) For each bucket, list top-level entries (usually user-id folders)
for (const b of buckets || []) {
  console.log(`\n--- bucket "${b.name}" top-level ---`);
  const { data: entries, error } = await s.storage.from(b.name).list('', { limit: 500, sortBy: { column: 'created_at', order: 'desc' } });
  if (error) { console.log('  error:', error.message); continue; }
  console.log(`  ${entries?.length || 0} entries`);
  for (const e of (entries || []).slice(0, 20)) console.log(`    ${e.created_at ? e.created_at.slice(0, 19) : '(folder?)'} ${e.name} ${e.metadata?.size ?? ''}`);
}

// 3) Check for an orphaned-reference signal: get current profile ids, see if any storage paths contain UUIDs not in profiles
const { data: profiles } = await s.from('profiles').select('id');
const profileIds = new Set((profiles || []).map(p => p.id));
console.log(`\n=== ORPHAN DETECTION — current profiles: ${profileIds.size} ===`);

for (const b of buckets || []) {
  const { data: entries } = await s.storage.from(b.name).list('', { limit: 1000 });
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const orphans = (entries || []).filter(e => uuidRe.test(e.name) && !profileIds.has(e.name));
  if (orphans.length) {
    console.log(`\n  bucket "${b.name}" orphan user folders (${orphans.length}):`);
    for (const o of orphans.slice(0, 50)) console.log(`    ${o.name}`);
  }
}

// 4) Check notifications table — structure + any rows that reference a now-missing user
console.log('\n=== NOTIFICATIONS TABLE ===');
const { data: notifSample, error: nErr } = await s.from('notifications').select('*').limit(1);
if (nErr) console.log('error:', nErr.message);
else if (notifSample?.length) console.log('columns:', Object.keys(notifSample[0]));
else console.log('notifications table empty or inaccessible');

const { count: notifCount } = await s.from('notifications').select('*', { count: 'exact', head: true });
console.log(`total notification rows: ${notifCount ?? 'unknown'}`);

// 5) Try to find notifications whose actor_id or subject references a non-existing profile (possible orphans)
const { data: notifs } = await s.from('notifications').select('*').limit(200).order('created_at', { ascending: false });
if (notifs?.length) {
  const knownCols = Object.keys(notifs[0]);
  console.log('sample notification:', notifs[0]);
  const idCols = knownCols.filter(k => /_id$/.test(k) && k !== 'id');
  const suspectRows = [];
  for (const n of notifs) {
    for (const col of idCols) {
      if (n[col] && !profileIds.has(n[col])) {
        suspectRows.push({ col, value: n[col], notif: n });
        break;
      }
    }
  }
  console.log(`\nnotifications referencing a now-deleted user id: ${suspectRows.length}`);
  for (const r of suspectRows.slice(0, 10)) console.log('  ', r.col, '=', r.value, '→', r.notif);
}
