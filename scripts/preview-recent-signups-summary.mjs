import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
const { data: profiles } = await supabase
  .from('profiles')
  .select('id, email, full_name, onboarding_complete, created_at')
  .gte('created_at', since);

console.log(`Total signups in last 2h: ${profiles.length}\n`);

let withActivity = [];
let withProfile = [];
for (const p of profiles) {
  const [{ count: posts }, { count: comments }, { count: msgs }, { count: fA }, { count: fB }, { count: pokes }] = await Promise.all([
    supabase.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', p.id),
    supabase.from('comments').select('*', { count: 'exact', head: true }).eq('user_id', p.id),
    supabase.from('messages').select('*', { count: 'exact', head: true }).eq('sender_id', p.id),
    supabase.from('friendships').select('*', { count: 'exact', head: true }).eq('user_id', p.id),
    supabase.from('friendships').select('*', { count: 'exact', head: true }).eq('friend_id', p.id),
    supabase.from('pokes').select('*', { count: 'exact', head: true }).eq('poker_id', p.id),
  ]);
  const activity = (posts || 0) + (comments || 0) + (msgs || 0) + (fA || 0) + (fB || 0) + (pokes || 0);
  if (activity > 0) withActivity.push({ ...p, posts, comments, msgs, friends: fA + fB, pokes });
  if (p.full_name || p.onboarding_complete) withProfile.push(p);
}

console.log(`Signups with ANY activity (posts/comments/msgs/friends/pokes): ${withActivity.length}`);
console.log(`Signups with a name or completed onboarding: ${withProfile.length}\n`);

if (withActivity.length) {
  console.log('--- accounts with activity (these may be real) ---');
  for (const a of withActivity) console.log(a);
}
if (withProfile.length) {
  console.log('\n--- accounts with profile data (these may be real) ---');
  for (const a of withProfile) console.log(a);
}

// Email domain breakdown
const domains = {};
for (const p of profiles) {
  const d = (p.email || '').split('@')[1] || '(none)';
  domains[d] = (domains[d] || 0) + 1;
}
console.log('\n--- email domains ---');
for (const [d, c] of Object.entries(domains).sort((a, b) => b[1] - a[1])) console.log(`  ${d}: ${c}`);
