-- Restore public visibility of accepted friendships and add a
-- friends-of-friends RPC for the directory.
--
-- Reverts the "mutuals only" rule from
-- supabase-migration-friendships-mutuals-only.sql so visitors can see
-- the full friend list on someone else's profile.

DROP POLICY IF EXISTS "View own friendships and mutuals"      ON public.friendships;
DROP POLICY IF EXISTS "View accepted friendships, own pending" ON public.friendships;

CREATE POLICY "View accepted friendships, own pending" ON public.friendships
  FOR SELECT TO authenticated USING (
    status = 'accepted'
    OR auth.uid() = requester_id
    OR auth.uid() = addressee_id
  );

-- Helper from the mutuals-only migration is no longer referenced.
DROP FUNCTION IF EXISTS public.is_mutual_with(uuid);

-- Friends of friends: people who are friends with at least one of my
-- friends, excluding me, my existing friends, anyone I've blocked or
-- who has blocked me, and profiles hidden from the directory.
-- Returns the same column set the client uses for profile rows, plus
-- a mutual_count so the UI can show "N mutual friends".
CREATE OR REPLACE FUNCTION public.friends_of_friends()
RETURNS TABLE (
  id uuid,
  full_name text,
  username text,
  avatar_url text,
  about_me text,
  hidden_from_directory boolean,
  last_seen timestamptz,
  created_at timestamptz,
  mutual_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH my_friends AS (
    SELECT CASE WHEN requester_id = auth.uid() THEN addressee_id ELSE requester_id END AS friend_id
    FROM public.friendships
    WHERE status = 'accepted'
      AND (requester_id = auth.uid() OR addressee_id = auth.uid())
  ),
  fof AS (
    SELECT
      CASE WHEN f.requester_id = mf.friend_id THEN f.addressee_id ELSE f.requester_id END AS person_id,
      mf.friend_id
    FROM public.friendships f
    JOIN my_friends mf
      ON f.requester_id = mf.friend_id OR f.addressee_id = mf.friend_id
    WHERE f.status = 'accepted'
  )
  SELECT
    p.id,
    p.full_name,
    p.username,
    p.avatar_url,
    p.about_me,
    p.hidden_from_directory,
    p.last_seen,
    p.created_at,
    COUNT(DISTINCT fof.friend_id)::int AS mutual_count
  FROM fof
  JOIN public.profiles p ON p.id = fof.person_id
  WHERE fof.person_id <> auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM my_friends mf2 WHERE mf2.friend_id = fof.person_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p.id)
         OR (b.blocker_id = p.id AND b.blocked_id = auth.uid())
    )
    AND COALESCE(p.hidden_from_directory, false) = false
  GROUP BY p.id, p.full_name, p.username, p.avatar_url, p.about_me,
           p.hidden_from_directory, p.last_seen, p.created_at
  ORDER BY mutual_count DESC, p.full_name ASC
  LIMIT 100;
$$;

REVOKE ALL ON FUNCTION public.friends_of_friends() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.friends_of_friends() TO authenticated;
