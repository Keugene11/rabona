import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
console.log(`Accounts created since ${since}\n`);

const { data: profiles, error } = await supabase
  .from('profiles')
  .select('id, email, full_name, class_year, major, residence_hall, about_me, onboarding_complete, created_at')
  .gte('created_at', since)
  .order('created_at', { ascending: true });

if (error) { console.error(error); process.exit(1); }

const counts = async (table, column, id) => {
  const { count } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq(column, id);
  return count ?? 0;
};

console.log(`Found ${profiles.length} profiles.\n`);
for (const p of profiles) {
  const [posts, comments, msgs, friendsA, friendsB] = await Promise.all([
    counts('posts', 'user_id', p.id),
    counts('comments', 'user_id', p.id),
    counts('messages', 'sender_id', p.id),
    counts('friendships', 'user_id', p.id),
    counts('friendships', 'friend_id', p.id),
  ]);
  const empty = !p.class_year && !p.major && !p.residence_hall && !p.about_me;
  console.log(
    [
      p.created_at.slice(11, 19),
      p.id,
      (p.email || '').padEnd(32),
      (p.full_name || '(no name)').padEnd(24),
      `onb:${p.onboarding_complete ? 'Y' : 'N'}`,
      `empty:${empty ? 'Y' : 'N'}`,
      `posts:${posts}`,
      `cmts:${comments}`,
      `msgs:${msgs}`,
      `friends:${friendsA + friendsB}`,
    ].join(' | ')
  );
}
