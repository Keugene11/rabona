-- Server-side enforcement of privacy preferences:
--   #2 email + phone: masked in bulk; exposed per-profile via RPC subject to private_fields
--   #2 wall_posts: SELECT + INSERT respect wall_owner's wall_posts_from preference

-------------------------------------------------------
-- RPC: return email+phone for one profile, respecting private_fields.
-- private_fields is a CSV of tokens. Each sensitive field can be:
--   absent:           visible to all authenticated
--   "<field>":        hidden from everyone except self
--   "<field>:followers": visible only to self + accepted friends
-------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_profile_contact(p_profile_id uuid)
RETURNS TABLE(email text, phone text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH privacy AS (
    SELECT
      p.id,
      p.email AS p_email,
      p.phone AS p_phone,
      COALESCE(string_to_array(p.private_fields, ','), ARRAY[]::text[]) AS pf,
      EXISTS (
        SELECT 1 FROM public.friendships f
        WHERE f.status = 'accepted'
          AND ((f.requester_id = auth.uid() AND f.addressee_id = p.id)
               OR (f.addressee_id = auth.uid() AND f.requester_id = p.id))
      ) AS is_friend
    FROM public.profiles p
    WHERE p.id = p_profile_id
  )
  SELECT
    CASE
      WHEN id = auth.uid() THEN p_email
      WHEN 'email' = ANY(pf) THEN NULL
      WHEN 'email:followers' = ANY(pf) THEN CASE WHEN is_friend THEN p_email END
      ELSE p_email
    END,
    CASE
      WHEN id = auth.uid() THEN p_phone
      WHEN 'phone' = ANY(pf) THEN NULL
      WHEN 'phone:followers' = ANY(pf) THEN CASE WHEN is_friend THEN p_phone END
      ELSE p_phone
    END
  FROM privacy
$$;
GRANT EXECUTE ON FUNCTION public.get_profile_contact(uuid) TO authenticated;

-------------------------------------------------------
-- Block bulk column reads so enumeration via PostgREST is impossible.
-- The RPC above is the only supported way to retrieve email/phone.
-------------------------------------------------------
REVOKE SELECT (email) ON public.profiles FROM authenticated;
REVOKE SELECT (email) ON public.profiles FROM anon;
REVOKE SELECT (phone) ON public.profiles FROM authenticated;
REVOKE SELECT (phone) ON public.profiles FROM anon;

-------------------------------------------------------
-- wall_posts SELECT: the wall owner's wall_posts_from preference gates visibility.
-- 'everyone' (default) → visible to all authenticated
-- 'friends' → visible only to the owner, the author, and accepted friends of the owner
-------------------------------------------------------
DROP POLICY IF EXISTS "Wall posts are viewable by authenticated users" ON public.wall_posts;
CREATE POLICY "Wall posts visible per owner preference" ON public.wall_posts
  FOR SELECT TO authenticated USING (
    auth.uid() = wall_owner_id
    OR auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = wall_posts.wall_owner_id
        AND (p.wall_posts_from IS NULL OR p.wall_posts_from = 'everyone')
    )
    OR EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.status = 'accepted'
        AND ((f.requester_id = auth.uid() AND f.addressee_id = wall_posts.wall_owner_id)
             OR (f.addressee_id = auth.uid() AND f.requester_id = wall_posts.wall_owner_id))
    )
  );

-------------------------------------------------------
-- wall_posts INSERT: same gate applies — if owner has 'friends' only,
-- only the owner or their friends can post on the wall.
-- Preserves the existing email-confirmed check from prior migration.
-------------------------------------------------------
DROP POLICY IF EXISTS "Users can create wall posts" ON public.wall_posts;
CREATE POLICY "Users can create wall posts" ON public.wall_posts
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = author_id
    AND public.is_confirmed_user()
    AND (
      auth.uid() = wall_owner_id
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = wall_owner_id
          AND (p.wall_posts_from IS NULL OR p.wall_posts_from = 'everyone')
      )
      OR EXISTS (
        SELECT 1 FROM public.friendships f
        WHERE f.status = 'accepted'
          AND ((f.requester_id = auth.uid() AND f.addressee_id = wall_owner_id)
               OR (f.addressee_id = auth.uid() AND f.requester_id = wall_owner_id))
      )
    )
  );
