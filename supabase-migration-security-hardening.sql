-- Security hardening: fixes #6 (notifications spam), #7 (conversations RLS),
-- #8 (rate-limit triggers), #10 (email-confirmed gate),
-- plus the HIDDEN_EMAILS → hidden_from_directory cleanup.

-------------------------------------------------------
-- Directory-hidden flag (replaces email-based HIDDEN_EMAILS filter)
-------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hidden_from_directory boolean NOT NULL DEFAULT false;

UPDATE public.profiles
SET hidden_from_directory = true
WHERE email IN ('reviewer@rabona.app', 'keugenelee9@gmail.com');

-------------------------------------------------------
-- #10 helper: is the caller a confirmed user?
-- SECURITY DEFINER so it can read auth.users under RLS.
-------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_confirmed_user()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL
  )
$$;
GRANT EXECUTE ON FUNCTION public.is_confirmed_user() TO authenticated;

-------------------------------------------------------
-- #6 notifications INSERT: require a real relationship for "passive" notification types
-------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = actor_id
    AND (
      -- Self-notification
      user_id = auth.uid()
      -- Friend request: no friendship yet, allowed
      OR type = 'friend_request'
      -- Poke: bounded by rate-limit trigger below
      OR type = 'poke'
      -- Message notification: paired with conversations RLS
      OR type = 'message'
      -- All other types (likes, comments, mentions, group_join, friend_post, etc.)
      -- require an accepted friendship between actor and recipient
      OR EXISTS (
        SELECT 1 FROM public.friendships
        WHERE status = 'accepted'
          AND ((requester_id = auth.uid() AND addressee_id = user_id)
               OR (addressee_id = auth.uid() AND requester_id = user_id))
      )
    )
  );

-------------------------------------------------------
-- #7 conversations INSERT: enforce recipient's messages_from preference
-------------------------------------------------------
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations" ON public.conversations
  FOR INSERT TO authenticated WITH CHECK (
    (auth.uid() = user1_id OR auth.uid() = user2_id)
    AND public.is_confirmed_user()
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = CASE WHEN auth.uid() = user1_id THEN user2_id ELSE user1_id END
        AND p.messages_from = 'friends'
        AND NOT EXISTS (
          SELECT 1 FROM public.friendships f
          WHERE f.status = 'accepted'
            AND ((f.requester_id = auth.uid() AND f.addressee_id = p.id)
                 OR (f.addressee_id = auth.uid() AND f.requester_id = p.id))
        )
    )
  );

-------------------------------------------------------
-- #8 rate-limit triggers on abuse-prone tables
-------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_poke_rate() RETURNS trigger AS $$
BEGIN
  IF (SELECT count(*) FROM public.pokes
      WHERE poker_id = NEW.poker_id
        AND created_at > now() - interval '1 hour') >= 60 THEN
    RAISE EXCEPTION 'poke_rate_limited: 60 pokes per hour'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS pokes_rate_limit ON public.pokes;
CREATE TRIGGER pokes_rate_limit BEFORE INSERT ON public.pokes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_poke_rate();

CREATE OR REPLACE FUNCTION public.enforce_wall_post_rate() RETURNS trigger AS $$
BEGIN
  IF (SELECT count(*) FROM public.wall_posts
      WHERE author_id = NEW.author_id
        AND created_at > now() - interval '1 hour') >= 30 THEN
    RAISE EXCEPTION 'wall_post_rate_limited: 30 posts per hour'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS wall_posts_rate_limit ON public.wall_posts;
CREATE TRIGGER wall_posts_rate_limit BEFORE INSERT ON public.wall_posts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_wall_post_rate();

CREATE OR REPLACE FUNCTION public.enforce_friendship_rate() RETURNS trigger AS $$
BEGIN
  IF (SELECT count(*) FROM public.friendships
      WHERE requester_id = NEW.requester_id
        AND created_at > now() - interval '1 hour') >= 30 THEN
    RAISE EXCEPTION 'friendship_rate_limited: 30 friend requests per hour'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS friendships_rate_limit ON public.friendships;
CREATE TRIGGER friendships_rate_limit BEFORE INSERT ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.enforce_friendship_rate();

-------------------------------------------------------
-- #10 email-confirmed gate on user-action INSERTs
-- (Existing accounts are all confirmed due to mailer_autoconfirm being on —
-- no current user is locked out. Going forward, password-signup bots without
-- mailbox access stay unconfirmed and can't post/DM/friend/poke/comment.)
-------------------------------------------------------
DROP POLICY IF EXISTS "Users can create wall posts" ON public.wall_posts;
CREATE POLICY "Users can create wall posts" ON public.wall_posts
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = author_id AND public.is_confirmed_user()
  );

DROP POLICY IF EXISTS "Users can create comments" ON public.comments;
CREATE POLICY "Users can create comments" ON public.comments
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = author_id AND public.is_confirmed_user()
  );

DROP POLICY IF EXISTS "Users can send messages in their conversations" ON public.messages;
CREATE POLICY "Users can send messages in their conversations" ON public.messages
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = sender_id
    AND public.is_confirmed_user()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can send friend requests" ON public.friendships;
CREATE POLICY "Users can send friend requests" ON public.friendships
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = requester_id AND public.is_confirmed_user()
  );

DROP POLICY IF EXISTS "Users can create pokes" ON public.pokes;
CREATE POLICY "Users can create pokes" ON public.pokes
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = poker_id AND public.is_confirmed_user()
  );
