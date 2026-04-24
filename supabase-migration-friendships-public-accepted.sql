-- Let any authenticated user see accepted friendships so visiting someone
-- else's profile can render their friend list. Pending requests stay private
-- to the two parties.

DROP POLICY IF EXISTS "Users can view their friendships" ON public.friendships;

CREATE POLICY "View accepted friendships, own pending" ON public.friendships
  FOR SELECT TO authenticated USING (
    status = 'accepted'
    OR auth.uid() = requester_id
    OR auth.uid() = addressee_id
  );
