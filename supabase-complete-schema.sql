-- Complete additional tables for Rabona

CREATE TABLE public.blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  image_url text,
  group_type text NOT NULL DEFAULT 'open',
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  university text DEFAULT 'rabona'
);
CREATE INDEX idx_groups_university ON groups(university);

CREATE TABLE public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz DEFAULT now(),
  UNIQUE(group_id, user_id)
);

CREATE TABLE public.group_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  media_url text
);

CREATE TABLE public.post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_type text NOT NULL,
  post_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(post_type, post_id, user_id)
);

CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_type text NOT NULL,
  post_id uuid NOT NULL,
  parent_id uuid REFERENCES comments(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  media_url text
);

CREATE TABLE public.comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  post_type text,
  post_id uuid,
  comment_id uuid,
  seen boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  content text
);
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);

CREATE TABLE public.post_impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_type text NOT NULL,
  post_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(post_type, post_id, user_id)
);

CREATE TABLE public.profile_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.message_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id)
);

CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason text NOT NULL,
  details text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- RLS on new tables
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_impressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Blocks viewable by blocker" ON blocks FOR SELECT TO authenticated USING (auth.uid() = blocker_id);
CREATE POLICY "Users can block" ON blocks FOR INSERT TO authenticated WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "Users can unblock" ON blocks FOR DELETE TO authenticated USING (auth.uid() = blocker_id);

CREATE POLICY "Groups viewable by all" ON groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create groups" ON groups FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creator can update group" ON groups FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Creator can delete group" ON groups FOR DELETE TO authenticated USING (auth.uid() = created_by);

CREATE POLICY "Group members viewable" ON group_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can join groups" ON group_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave groups" ON group_members FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can update members" ON group_members FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid() AND gm.role = 'admin')
);

CREATE POLICY "Group posts viewable" ON group_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Members can post" ON group_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors can delete posts" ON group_posts FOR DELETE TO authenticated USING (auth.uid() = author_id);

CREATE POLICY "Likes viewable" ON post_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can like" ON post_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike" ON post_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Comments viewable" ON comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can comment" ON comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors can delete comments" ON comments FOR DELETE TO authenticated USING (auth.uid() = author_id);

CREATE POLICY "Comment likes viewable" ON comment_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can like comments" ON comment_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike comments" ON comment_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users see own notifications" ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "System can create notifications" ON notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notifications" ON notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Impressions viewable" ON post_impressions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create impressions" ON post_impressions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Profile views viewable by owner" ON profile_views FOR SELECT TO authenticated USING (auth.uid() = profile_id);
CREATE POLICY "Users can create views" ON profile_views FOR INSERT TO authenticated WITH CHECK (auth.uid() = viewer_id);

CREATE POLICY "Message likes viewable" ON message_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can like messages" ON message_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike messages" ON message_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Reports insertable" ON reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);

-- Storage bucket for posts (images/videos)
INSERT INTO storage.buckets (id, name, public) VALUES ('posts', 'posts', true) ON CONFLICT DO NOTHING;

CREATE POLICY "Post media publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'posts');
CREATE POLICY "Users can upload post media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'posts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete own post media" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'posts' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Add missing columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hometown text DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS high_school text DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birthday date;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone text DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS websites text DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS looking_for text DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS interested_in text DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fraternity_sorority text DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS clubs text DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS favorite_music text DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS favorite_movies text DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS private_fields text DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen timestamptz;

-- Realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE group_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE post_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE comments;
