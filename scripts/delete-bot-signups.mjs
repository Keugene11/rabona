// DANGER: deletes users via service-role admin API.
// Safety:
//   1) Requires --confirm flag to actually delete.
//   2) Skips any email listed in public.protected_owner_emails (enforced by DB trigger too).
//   3) Refuses to delete accounts with any content: wall_posts, comments, messages,
//      friendships, pokes, comment_likes, post_likes, group_members, group_posts.
//   4) Uses correct table/column names (previous revision had wrong names, which made
//      the safety net silently return zero).
//
// Usage:
//   node scripts/delete-bot-signups.mjs                 # dry run
//   node scripts/delete-bot-signups.mjs --confirm       # actually delete
//   node scripts/delete-bot-signups.mjs --hours=6       # adjust window (default 3)

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const CONFIRM = argv.includes('--confirm');
const hoursArg = argv.find(a => a.startsWith('--hours='));
const HOURS = hoursArg ? Number(hoursArg.split('=')[1]) : 3;

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const since = new Date(Date.now() - HOURS * 60 * 60 * 1000).toISOString();

const { data: protectedRows } = await s.from('protected_owner_emails').select('email');
const protectedSet = new Set((protectedRows || []).map(r => r.email.toLowerCase()));
console.log(`Protected emails (will be skipped): ${[...protectedSet].join(', ') || '(none)'}`);

const { data: profiles, error } = await s.from('profiles')
  .select('id, email, full_name, onboarding_complete, created_at')
  .gte('created_at', since)
  .order('created_at', { ascending: true });
if (error) { console.error('fetch failed:', error); process.exit(1); }

console.log(`\nCandidate signups since ${since}: ${profiles.length}`);
if (!CONFIRM) console.log('(dry run — pass --confirm to actually delete)');

let wouldDelete = 0, skipped = 0, failed = 0;
const skippedRows = [];

for (const p of profiles) {
  if (protectedSet.has((p.email || '').toLowerCase())) {
    skipped++;
    skippedRows.push({ reason: 'protected', email: p.email });
    continue;
  }

  const [wp, cm, ml, fr1, fr2, pk, cl, pl, gm, gp] = await Promise.all([
    s.from('wall_posts').select('*', { count: 'exact', head: true }).eq('author_id', p.id),
    s.from('comments').select('*', { count: 'exact', head: true }).eq('user_id', p.id),
    s.from('messages').select('*', { count: 'exact', head: true }).eq('sender_id', p.id),
    s.from('friendships').select('*', { count: 'exact', head: true }).eq('requester_id', p.id),
    s.from('friendships').select('*', { count: 'exact', head: true }).eq('addressee_id', p.id),
    s.from('pokes').select('*', { count: 'exact', head: true }).eq('poker_id', p.id),
    s.from('comment_likes').select('*', { count: 'exact', head: true }).eq('user_id', p.id),
    s.from('post_likes').select('*', { count: 'exact', head: true }).eq('user_id', p.id),
    s.from('group_members').select('*', { count: 'exact', head: true }).eq('user_id', p.id),
    s.from('group_posts').select('*', { count: 'exact', head: true }).eq('author_id', p.id),
  ]);
  const total = (wp.count || 0) + (cm.count || 0) + (ml.count || 0) + (fr1.count || 0) + (fr2.count || 0)
              + (pk.count || 0) + (cl.count || 0) + (pl.count || 0) + (gm.count || 0) + (gp.count || 0);
  const hasContent = total > 0;
  const hasProfile = (p.full_name && p.full_name.trim() !== '') || p.onboarding_complete;

  if (hasContent || hasProfile) {
    skipped++;
    skippedRows.push({ reason: hasContent ? 'has content' : 'has profile', email: p.email, contentTotal: total });
    continue;
  }

  wouldDelete++;
  if (CONFIRM) {
    const { error: delErr } = await s.auth.admin.deleteUser(p.id);
    if (delErr) { failed++; console.log(`FAIL ${p.email} — ${delErr.message}`); }
    else if (wouldDelete % 50 === 0) console.log(`... deleted ${wouldDelete}`);
  }
}

console.log(`\n${CONFIRM ? 'Done.' : 'Dry-run summary.'}  ${CONFIRM ? 'deleted' : 'would delete'}=${wouldDelete}  skipped=${skipped}  failed=${failed}`);
if (skippedRows.length) {
  console.log('\nSkipped rows:');
  for (const r of skippedRows) console.log(' ', r);
}
