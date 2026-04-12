-- Rabona Database Schema
-- Run this in your Supabase SQL Editor

-- Profiles table (extends auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  avatar_url text,
  class_year smallint,
  major text default '',
  second_major text default '',
  minor text default '',
  residence_hall text default '',
  courses text default '',
  gender text default '',
  relationship_status text default '',
  interests text default '',
  about_me text default '',
  political_views text default '',
  favorite_quotes text default '',
  notif_friend_requests boolean default true,
  notif_pokes boolean default true,
  notif_wall_posts boolean default true,
  notif_likes boolean default true,
  notif_comments boolean default true,
  university text default 'cornell',
  messages_from text default 'everyone',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_profiles_university on profiles(university);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Friendships
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references profiles(id) on delete cascade,
  addressee_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(requester_id, addressee_id)
);

create index idx_friendships_addressee on friendships(addressee_id) where status = 'pending';
create index idx_friendships_status on friendships(status);

-- Wall posts
create table public.wall_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles(id) on delete cascade,
  wall_owner_id uuid not null references profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);

create index idx_wall_posts_wall_owner on wall_posts(wall_owner_id, created_at desc);
create index idx_wall_posts_author on wall_posts(author_id, created_at desc);

-- Pokes
create table public.pokes (
  id uuid primary key default gen_random_uuid(),
  poker_id uuid not null references profiles(id) on delete cascade,
  poked_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  seen boolean default false,
  unique(poker_id, poked_id)
);

create index idx_pokes_poked on pokes(poked_id) where seen = false;

-- Conversations
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user1_id uuid not null references profiles(id) on delete cascade,
  user2_id uuid not null references profiles(id) on delete cascade,
  last_message_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(user1_id, user2_id)
);

-- Messages
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);

create index idx_messages_conversation on messages(conversation_id, created_at desc);

-- Directory search indexes
create index idx_profiles_residence_hall on profiles(residence_hall);
create index idx_profiles_major on profiles(major);
create index idx_profiles_class_year on profiles(class_year);
create index idx_profiles_gender on profiles(gender);

-- RLS Policies

alter table profiles enable row level security;
alter table friendships enable row level security;
alter table wall_posts enable row level security;
alter table pokes enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;

-- Profiles: anyone authenticated can read, only owner can update
create policy "Profiles are viewable by authenticated users" on profiles
  for select to authenticated using (true);

create policy "Users can update own profile" on profiles
  for update to authenticated using (auth.uid() = id);

-- Friendships: participants can view their own
create policy "Users can view their friendships" on friendships
  for select to authenticated using (
    auth.uid() = requester_id or auth.uid() = addressee_id
  );

create policy "Users can send friend requests" on friendships
  for insert to authenticated with check (auth.uid() = requester_id);

create policy "Addressee can update friendship status" on friendships
  for update to authenticated using (auth.uid() = addressee_id);

create policy "Either party can delete friendship" on friendships
  for delete to authenticated using (
    auth.uid() = requester_id or auth.uid() = addressee_id
  );

-- Wall posts: authenticated can read, friends/self can write
create policy "Wall posts are viewable by authenticated users" on wall_posts
  for select to authenticated using (true);

create policy "Users can create wall posts" on wall_posts
  for insert to authenticated with check (auth.uid() = author_id);

create policy "Authors and wall owners can delete posts" on wall_posts
  for delete to authenticated using (
    auth.uid() = author_id or auth.uid() = wall_owner_id
  );

-- Pokes: participants can view
create policy "Users can view their pokes" on pokes
  for select to authenticated using (
    auth.uid() = poker_id or auth.uid() = poked_id
  );

create policy "Users can create pokes" on pokes
  for insert to authenticated with check (auth.uid() = poker_id);

create policy "Poked user can update poke" on pokes
  for update to authenticated using (auth.uid() = poked_id);

create policy "Either party can delete poke" on pokes
  for delete to authenticated using (
    auth.uid() = poker_id or auth.uid() = poked_id
  );

-- Conversations: participants only
create policy "Users can view their conversations" on conversations
  for select to authenticated using (
    auth.uid() = user1_id or auth.uid() = user2_id
  );

create policy "Users can create conversations" on conversations
  for insert to authenticated with check (
    auth.uid() = user1_id or auth.uid() = user2_id
  );

create policy "Users can update their conversations" on conversations
  for update to authenticated using (
    auth.uid() = user1_id or auth.uid() = user2_id
  );

-- Messages: conversation participants only
create policy "Users can view messages in their conversations" on messages
  for select to authenticated using (
    exists (
      select 1 from conversations c
      where c.id = conversation_id
      and (c.user1_id = auth.uid() or c.user2_id = auth.uid())
    )
  );

create policy "Users can send messages in their conversations" on messages
  for insert to authenticated with check (
    auth.uid() = sender_id and exists (
      select 1 from conversations c
      where c.id = conversation_id
      and (c.user1_id = auth.uid() or c.user2_id = auth.uid())
    )
  );

-- Directory search function
create or replace function search_directory(
  p_name text default null,
  p_residence_hall text default null,
  p_course text default null,
  p_gender text default null,
  p_major text default null,
  p_class_year smallint default null
) returns setof profiles as $$
  select * from profiles
  where (p_name is null or full_name ilike '%' || p_name || '%')
    and (p_residence_hall is null or residence_hall = p_residence_hall)
    and (p_course is null or courses ilike '%' || p_course || '%')
    and (p_gender is null or gender = p_gender)
    and (p_major is null or major = p_major or second_major = p_major)
    and (p_class_year is null or class_year = p_class_year)
  order by full_name
  limit 50;
$$ language sql stable;

-- Storage bucket for avatars
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);

create policy "Avatar images are publicly accessible" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "Users can upload their own avatar" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update their own avatar" on storage.objects
  for update to authenticated using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own avatar" on storage.objects
  for delete to authenticated using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Enable realtime for messages and pokes
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table pokes;
alter publication supabase_realtime add table conversations;
