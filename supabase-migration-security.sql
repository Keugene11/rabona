-- Security hardening migration (2026-04-17)
-- Applied via `supabase db query --linked`
-- Addresses findings H3, H5, H6, H7, H8, H9, C3 (select leak), M2, M4, M9

-- ============================================
-- 0. CONVERSATIONS: add missing columns the client already writes/reads
-- These silently no-op'd until now because the columns didn't exist.
-- ============================================

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS last_message_content text,
  ADD COLUMN IF NOT EXISTS last_message_sender_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS user1_read_at timestamptz,
  ADD COLUMN IF NOT EXISTS user2_read_at timestamptz;

-- ============================================
-- 1. NOTIFICATIONS: lock down INSERT + add type/length CHECKs
-- Prevents fake "X accepted your friend request" / fake inbox messages
-- ============================================

DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users insert own notifications as actor" ON public.notifications;

CREATE POLICY "Users insert own notifications as actor" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = actor_id
    AND actor_id <> user_id
  );

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (
    type IN (
      'reply', 'comment', 'poke', 'like',
      'friend_request', 'friend_accept', 'message', 'group_join',
      'friend_comment', 'friend_like', 'friend_post'
    )
  );

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_content_length_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_content_length_check CHECK (
    content IS NULL OR length(content) <= 1000
  );

-- ============================================
-- 2. CONVERSATIONS: block client writes to last_message_* columns
-- Clients keep UPDATE on user1_read_at/user2_read_at only (via column-level GRANT)
-- last_message_* auto-populated by trigger on messages INSERT
-- ============================================

CREATE OR REPLACE FUNCTION public.set_conversation_last_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations SET
    last_message_at = NEW.created_at,
    last_message_content = NEW.content,
    last_message_sender_id = NEW.sender_id,
    user1_read_at = CASE WHEN user1_id = NEW.sender_id THEN NEW.created_at ELSE user1_read_at END,
    user2_read_at = CASE WHEN user2_id = NEW.sender_id THEN NEW.created_at ELSE user2_read_at END
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_conversation_last_message ON public.messages;
CREATE TRIGGER set_conversation_last_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.set_conversation_last_message();

-- Column-level privilege: clients can only update read-timestamp columns
REVOKE UPDATE ON public.conversations FROM authenticated;
GRANT UPDATE (user1_read_at, user2_read_at) ON public.conversations TO authenticated;

-- ============================================
-- 3. MESSAGES: length cap + enforce recipient's messages_from setting
-- Prevents post-unfriend spam
-- ============================================

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_content_length_check;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_content_length_check CHECK (
    length(content) BETWEEN 1 AND 4000
  );

DROP POLICY IF EXISTS "Users can send messages in their conversations" ON public.messages;
CREATE POLICY "Users can send messages in their conversations" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      JOIN public.profiles p ON p.id = CASE
        WHEN c.user1_id = auth.uid() THEN c.user2_id
        ELSE c.user1_id
      END
      WHERE c.id = messages.conversation_id
        AND (
          COALESCE(p.messages_from, 'everyone') = 'everyone'
          OR (
            p.messages_from = 'friends'
            AND EXISTS (
              SELECT 1 FROM public.friendships f
              WHERE f.status = 'accepted'
                AND ((f.requester_id = auth.uid() AND f.addressee_id = p.id)
                  OR (f.requester_id = p.id AND f.addressee_id = auth.uid()))
            )
          )
        )
    )
  );

-- ============================================
-- 4. GROUP MEMBERS: prevent self-promotion to admin and joining closed groups without approval
-- ============================================

DROP POLICY IF EXISTS "Users can join groups" ON public.group_members;
DROP POLICY IF EXISTS "Users can join open groups as member" ON public.group_members;
DROP POLICY IF EXISTS "Creators add themselves as admin" ON public.group_members;

CREATE POLICY "Users can join open groups as member" ON public.group_members
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND role = 'member'
    AND EXISTS (
      SELECT 1 FROM public.groups
      WHERE id = group_members.group_id AND group_type = 'open'
    )
  );

CREATE POLICY "Creators add themselves as admin" ON public.group_members
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND role = 'admin'
    AND EXISTS (
      SELECT 1 FROM public.groups
      WHERE id = group_members.group_id AND created_by = auth.uid()
    )
  );

-- Tighten admin UPDATE to have WITH CHECK too, preventing any non-admin from mutating rows
DROP POLICY IF EXISTS "Admins can update members" ON public.group_members;
CREATE POLICY "Admins can update members" ON public.group_members
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_members.group_id
        AND gm.user_id = auth.uid()
        AND gm.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_members.group_id
        AND gm.user_id = auth.uid()
        AND gm.role = 'admin'
    )
  );

-- ============================================
-- 5. MESSAGE LIKES: restrict SELECT to conversation participants
-- Prevents leaking DM reaction metadata to non-participants
-- ============================================

DROP POLICY IF EXISTS "Message likes viewable" ON public.message_likes;
CREATE POLICY "Message likes viewable to participants" ON public.message_likes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.conversations c ON c.id = m.conversation_id
      WHERE m.id = message_likes.message_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
    )
  );

-- ============================================
-- 6. PROFILE_VIEWS: add UPDATE policy so upserts work correctly
-- ============================================

DROP POLICY IF EXISTS "Users can update their views" ON public.profile_views;
CREATE POLICY "Users can update their views" ON public.profile_views
  FOR UPDATE TO authenticated
  USING (auth.uid() = viewer_id)
  WITH CHECK (auth.uid() = viewer_id);

-- ============================================
-- 7. BLOCK ENFORCEMENT: server-side blocking of pokes/friendships/conversations/messages
-- ============================================

CREATE OR REPLACE FUNCTION public.is_blocked_between(a uuid, b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocks
    WHERE (blocker_id = a AND blocked_id = b)
       OR (blocker_id = b AND blocked_id = a)
  );
$$;

DROP POLICY IF EXISTS "Users can create pokes" ON public.pokes;
CREATE POLICY "Users can create pokes" ON public.pokes
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = poker_id
    AND NOT public.is_blocked_between(poker_id, poked_id)
  );

DROP POLICY IF EXISTS "Users can send friend requests" ON public.friendships;
CREATE POLICY "Users can send friend requests" ON public.friendships
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = requester_id
    AND requester_id <> addressee_id
    AND NOT public.is_blocked_between(requester_id, addressee_id)
  );

DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations" ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.uid() = user1_id OR auth.uid() = user2_id)
    AND user1_id <> user2_id
    AND NOT public.is_blocked_between(user1_id, user2_id)
  );

-- Prevent wall posts from a blocked user
DROP POLICY IF EXISTS "Users can create wall posts" ON public.wall_posts;
CREATE POLICY "Users can create wall posts" ON public.wall_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND NOT public.is_blocked_between(author_id, wall_owner_id)
  );

-- ============================================
-- 8. CONTENT LENGTH CAPS
-- ============================================

-- Posts may have empty content if media_url is set, so only cap the max.
ALTER TABLE public.wall_posts
  DROP CONSTRAINT IF EXISTS wall_posts_content_length_check;
ALTER TABLE public.wall_posts
  ADD CONSTRAINT wall_posts_content_length_check CHECK (
    length(content) <= 4000
  );

ALTER TABLE public.group_posts
  DROP CONSTRAINT IF EXISTS group_posts_content_length_check;
ALTER TABLE public.group_posts
  ADD CONSTRAINT group_posts_content_length_check CHECK (
    length(content) <= 4000
  );

ALTER TABLE public.comments
  DROP CONSTRAINT IF EXISTS comments_content_length_check;
ALTER TABLE public.comments
  ADD CONSTRAINT comments_content_length_check CHECK (
    length(content) BETWEEN 1 AND 2000
  );

ALTER TABLE public.reports
  DROP CONSTRAINT IF EXISTS reports_details_length_check;
ALTER TABLE public.reports
  ADD CONSTRAINT reports_details_length_check CHECK (
    details IS NULL OR length(details) <= 2000
  );

ALTER TABLE public.reports
  DROP CONSTRAINT IF EXISTS reports_reason_length_check;
ALTER TABLE public.reports
  ADD CONSTRAINT reports_reason_length_check CHECK (
    length(reason) BETWEEN 1 AND 100
  );

-- ============================================
-- 9. Drop unused search_directory function (L7)
-- ============================================

DROP FUNCTION IF EXISTS public.search_directory(text, text, text, text, text, smallint);
