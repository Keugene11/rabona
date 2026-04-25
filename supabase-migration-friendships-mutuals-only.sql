-- Friendships visibility: own + mutuals only.
-- Replaces the previous "all accepted friendships are public" policy.
--
-- After this migration:
--   * You always see your own friendships (any status), as before.
--   * For accepted friendships you are NOT a party to, you can see the row only if
--     you are friends with BOTH parties (i.e. the friendship is between two of your mutuals).
--   * Pending friendships remain private to the requester and addressee.

DROP POLICY IF EXISTS "View accepted friendships, own pending" ON public.friendships;
DROP POLICY IF EXISTS "View own friendships and mutuals"      ON public.friendships;

-- Helper: SECURITY DEFINER avoids RLS recursion when the policy queries this same table.
CREATE OR REPLACE FUNCTION public.is_mutual_with(target_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.friendships
    WHERE status = 'accepted'
      AND (
        (requester_id = auth.uid() AND addressee_id = target_id)
        OR (addressee_id = auth.uid() AND requester_id = target_id)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_mutual_with(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_mutual_with(uuid) TO authenticated;

CREATE POLICY "View own friendships and mutuals" ON public.friendships
  FOR SELECT TO authenticated USING (
    auth.uid() = requester_id
    OR auth.uid() = addressee_id
    OR (
      status = 'accepted'
      AND public.is_mutual_with(requester_id)
      AND public.is_mutual_with(addressee_id)
    )
  );

-- Speeds up the reverse direction lookup inside is_mutual_with.
-- The unique(requester_id, addressee_id) constraint already covers the forward direction.
CREATE INDEX IF NOT EXISTS idx_friendships_addressee_requester
  ON public.friendships (addressee_id, requester_id)
  WHERE status = 'accepted';
