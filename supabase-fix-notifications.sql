-- Fix notifications: prevent cascade deletes, add RLS for nullification
-- Run this in your Supabase SQL Editor

-- Step 1: Find and drop existing foreign key constraints on notifications
-- (constraint names may vary — these are the most common auto-generated names)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.notifications'::regclass
      AND contype = 'f'
      AND (conname LIKE '%comment_id%' OR conname LIKE '%post_id%')
  LOOP
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- Step 2: Re-add foreign keys with SET NULL instead of CASCADE
-- comment_id -> comments(id)
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_comment_id_fkey
  FOREIGN KEY (comment_id) REFERENCES public.comments(id) ON DELETE SET NULL;

-- NOTE: post_id is a polymorphic reference (wall_post or group_post), so it may not
-- have a FK constraint at all. If it does, the DO block above already dropped it.
-- We intentionally do NOT re-add a FK for post_id since it references multiple tables.

-- Step 3: Ensure RLS policy allows authenticated users to update notifications
-- (needed so the app can nullify post_id/comment_id before deleting posts/comments)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications' AND policyname = 'Users can update notifications'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can update notifications" ON public.notifications FOR UPDATE TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;
