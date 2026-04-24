// Inspect a single auth.users row + any linked profile/content.
// Usage: node scripts/inspect-user.mjs <email-or-id>
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const arg = process.argv[2];
if (!arg) { console.error('usage: node scripts/inspect-user.mjs <email-or-id>'); process.exit(1); }

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

let user;
if (arg.includes('@')) {
  let page = 1;
  while (true) {
    const { data, error } = await s.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) { console.error(error); process.exit(1); }
    const match = data.users.find(u => (u.email || '').toLowerCase() === arg.toLowerCase());
    if (match) { user = match; break; }
    if (data.users.length < 1000) break;
    page++;
  }
} else {
  const { data, error } = await s.auth.admin.getUserById(arg);
  if (error) { console.error(error); process.exit(1); }
  user = data.user;
}
if (!user) { console.error('user not found'); process.exit(1); }

console.log('auth.users:');
console.log(JSON.stringify({
  id: user.id, email: user.email, phone: user.phone,
  created_at: user.created_at, last_sign_in_at: user.last_sign_in_at,
  email_confirmed_at: user.email_confirmed_at, confirmed_at: user.confirmed_at,
  providers: (user.app_metadata || {}).providers,
  app_metadata: user.app_metadata, user_metadata: user.user_metadata,
  identities: (user.identities || []).map(i => ({ provider: i.provider, created_at: i.created_at })),
}, null, 2));

const { data: profile } = await s.from('profiles').select('*').eq('id', user.id).maybeSingle();
console.log('\nprofile:', profile ? JSON.stringify(profile, null, 2) : '(none)');

const counts = async (table, col) => {
  const { count } = await s.from(table).select('*', { count: 'exact', head: true }).eq(col, user.id);
  return count ?? 0;
};
const [wp, cm, ml, fr1, fr2] = await Promise.all([
  counts('wall_posts', 'author_id'),
  counts('comments', 'user_id'),
  counts('messages', 'sender_id'),
  counts('friendships', 'requester_id'),
  counts('friendships', 'addressee_id'),
]);
console.log('\ncontent:', { wall_posts: wp, comments: cm, messages: ml, friendships: fr1 + fr2 });
