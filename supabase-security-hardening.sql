-- Security Hardening Migration
-- Run this in your Supabase SQL Editor
-- This fixes critical RLS gaps identified in security audit

-- ============================================================
-- 1. FIX: Overly permissive notification update policy
--    OLD: any authenticated user can update ANY notification
--    NEW: users can only update their own notifications
-- ============================================================
DROP POLICY IF EXISTS "Users can update notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow nullifying post_id/comment_id on notifications when deleting posts
-- (needed by post/comment authors cleaning up before delete)
CREATE POLICY "Authors can nullify refs on notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);
-- NOTE: The above is still permissive for UPDATE. Supabase OR's multiple policies,
-- so we need a more targeted approach. Let's replace both with a single policy:
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authors can nullify refs on notifications" ON public.notifications;

-- Single update policy: users can update their own notifications (mark seen),
-- AND anyone can nullify post_id/comment_id (needed for cleanup before delete)
CREATE POLICY "Users can update notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (
    -- Either updating your own notification (e.g. marking as seen)
    auth.uid() = user_id
    -- Or only nullifying reference columns (post_id, comment_id)
    OR (user_id = user_id)
  );
-- Unfortunately Supabase RLS can't inspect which columns changed.
-- The safest practical approach: restrict to own notifications for seen/read,
-- and accept that nullification of post_id needs a broader policy.
-- We'll enforce this in application code instead. Revert to targeted policy:
DROP POLICY IF EXISTS "Users can update notifications" ON public.notifications;

-- Final approach: own notifications only. Post/comment cleanup will use service role.
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 2. FIX: Comments table RLS
--    Ensure only comment authors can delete/edit their own comments
-- ============================================================
ALTER TABLE IF EXISTS public.comments ENABLE ROW LEVEL SECURITY;

-- Read: all authenticated users can view comments
DROP POLICY IF EXISTS "Comments are viewable by authenticated users" ON public.comments;
CREATE POLICY "Comments are viewable by authenticated users" ON public.comments
  FOR SELECT TO authenticated USING (true);

-- Insert: must be the author
DROP POLICY IF EXISTS "Users can create comments" ON public.comments;
CREATE POLICY "Users can create comments" ON public.comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);

-- Update: only author can edit
DROP POLICY IF EXISTS "Authors can update own comments" ON public.comments;
CREATE POLICY "Authors can update own comments" ON public.comments
  FOR UPDATE TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

-- Delete: only author can delete
DROP POLICY IF EXISTS "Authors can delete own comments" ON public.comments;
CREATE POLICY "Authors can delete own comments" ON public.comments
  FOR DELETE TO authenticated USING (auth.uid() = author_id);

-- ============================================================
-- 3. FIX: Notifications table - restrict inserts
--    Only allow creating notifications where actor_id = current user
-- ============================================================
DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = actor_id);

-- Read: only your own notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Delete: own notifications OR notifications you created (for like cleanup)
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id OR auth.uid() = actor_id);

-- ============================================================
-- 4. FIX: Groups table RLS
-- ============================================================
ALTER TABLE IF EXISTS public.groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Groups are viewable by authenticated users" ON public.groups;
CREATE POLICY "Groups are viewable by authenticated users" ON public.groups
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can create groups" ON public.groups;
CREATE POLICY "Users can create groups" ON public.groups
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Group creators can update groups" ON public.groups;
CREATE POLICY "Group creators can update groups" ON public.groups
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Group creators can delete groups" ON public.groups;
CREATE POLICY "Group creators can delete groups" ON public.groups
  FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- ============================================================
-- 5. FIX: Group members table RLS
-- ============================================================
ALTER TABLE IF EXISTS public.group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Group members are viewable by authenticated users" ON public.group_members;
CREATE POLICY "Group members are viewable by authenticated users" ON public.group_members
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can join groups" ON public.group_members;
CREATE POLICY "Users can join groups" ON public.group_members
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can leave groups" ON public.group_members;
CREATE POLICY "Users can leave groups" ON public.group_members
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- 6. FIX: Group posts table RLS
-- ============================================================
ALTER TABLE IF EXISTS public.group_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Group posts are viewable by authenticated users" ON public.group_posts;
CREATE POLICY "Group posts are viewable by authenticated users" ON public.group_posts
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can create group posts" ON public.group_posts;
CREATE POLICY "Users can create group posts" ON public.group_posts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Authors can delete group posts" ON public.group_posts;
CREATE POLICY "Authors can delete group posts" ON public.group_posts
  FOR DELETE TO authenticated USING (auth.uid() = author_id);

-- ============================================================
-- 7. FIX: Likes tables RLS
-- ============================================================
ALTER TABLE IF EXISTS public.post_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Post likes are viewable by authenticated users" ON public.post_likes;
CREATE POLICY "Post likes are viewable by authenticated users" ON public.post_likes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can like posts" ON public.post_likes;
CREATE POLICY "Users can like posts" ON public.post_likes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can unlike posts" ON public.post_likes;
CREATE POLICY "Users can unlike posts" ON public.post_likes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER TABLE IF EXISTS public.comment_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Comment likes are viewable by authenticated users" ON public.comment_likes;
CREATE POLICY "Comment likes are viewable by authenticated users" ON public.comment_likes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can like comments" ON public.comment_likes;
CREATE POLICY "Users can like comments" ON public.comment_likes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can unlike comments" ON public.comment_likes;
CREATE POLICY "Users can unlike comments" ON public.comment_likes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- 8. FIX: Profile views table RLS
-- ============================================================
ALTER TABLE IF EXISTS public.profile_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profile views are viewable by profile owner" ON public.profile_views;
CREATE POLICY "Profile views are viewable by profile owner" ON public.profile_views
  FOR SELECT TO authenticated USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "Authenticated users can create profile views" ON public.profile_views;
CREATE POLICY "Authenticated users can create profile views" ON public.profile_views
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = viewer_id);

-- ============================================================
-- 9. FIX: Blocks table RLS
-- ============================================================
ALTER TABLE IF EXISTS public.blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own blocks" ON public.blocks;
CREATE POLICY "Users can view own blocks" ON public.blocks
  FOR SELECT TO authenticated USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);

DROP POLICY IF EXISTS "Users can create blocks" ON public.blocks;
CREATE POLICY "Users can create blocks" ON public.blocks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "Users can remove blocks" ON public.blocks;
CREATE POLICY "Users can remove blocks" ON public.blocks
  FOR DELETE TO authenticated USING (auth.uid() = blocker_id);

-- ============================================================
-- 10. FIX: Reports table RLS
-- ============================================================
ALTER TABLE IF EXISTS public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create reports" ON public.reports;
CREATE POLICY "Users can create reports" ON public.reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);

-- Users should not be able to read or delete reports (admin only)
DROP POLICY IF EXISTS "Users can view own reports" ON public.reports;
CREATE POLICY "Users can view own reports" ON public.reports
  FOR SELECT TO authenticated USING (auth.uid() = reporter_id);

-- ============================================================
-- 11. FIX: Wall posts - add update policy for authors only
-- ============================================================
DROP POLICY IF EXISTS "Authors can update own wall posts" ON public.wall_posts;
CREATE POLICY "Authors can update own wall posts" ON public.wall_posts
  FOR UPDATE TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

-- ============================================================
-- 12. FIX: Messages - users cannot delete other users' messages
-- ============================================================
DROP POLICY IF EXISTS "Users can delete own messages" ON public.messages;
CREATE POLICY "Users can delete own messages" ON public.messages
  FOR DELETE TO authenticated USING (auth.uid() = sender_id);
