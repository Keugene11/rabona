-- Migration: Add university column to profiles and groups
-- Run this in your Supabase SQL Editor

-- Add university column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS university text DEFAULT 'stonybrook';
CREATE INDEX IF NOT EXISTS idx_profiles_university ON profiles(university);

-- Add university column to groups
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS university text DEFAULT 'stonybrook';
CREATE INDEX IF NOT EXISTS idx_groups_university ON groups(university);

-- Set university for existing profiles based on email domain
UPDATE public.profiles SET university = 'harvard' WHERE email LIKE '%@harvard.edu';
UPDATE public.profiles SET university = 'yale' WHERE email LIKE '%@yale.edu';
UPDATE public.profiles SET university = 'princeton' WHERE email LIKE '%@princeton.edu';
UPDATE public.profiles SET university = 'columbia' WHERE email LIKE '%@columbia.edu';
UPDATE public.profiles SET university = 'upenn' WHERE email LIKE '%@upenn.edu';
UPDATE public.profiles SET university = 'brown' WHERE email LIKE '%@brown.edu';
UPDATE public.profiles SET university = 'dartmouth' WHERE email LIKE '%@dartmouth.edu';
UPDATE public.profiles SET university = 'cornell' WHERE email LIKE '%@cornell.edu';
UPDATE public.profiles SET university = 'stanford' WHERE email LIKE '%@stanford.edu';
UPDATE public.profiles SET university = 'caltech' WHERE email LIKE '%@caltech.edu';
UPDATE public.profiles SET university = 'stonybrook' WHERE email LIKE '%@stonybrook.edu';

-- Update the handle_new_user trigger to detect university from email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, university)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    CASE
      WHEN new.email LIKE '%@harvard.edu' THEN 'harvard'
      WHEN new.email LIKE '%@yale.edu' THEN 'yale'
      WHEN new.email LIKE '%@princeton.edu' THEN 'princeton'
      WHEN new.email LIKE '%@columbia.edu' THEN 'columbia'
      WHEN new.email LIKE '%@upenn.edu' THEN 'upenn'
      WHEN new.email LIKE '%@brown.edu' THEN 'brown'
      WHEN new.email LIKE '%@dartmouth.edu' THEN 'dartmouth'
      WHEN new.email LIKE '%@cornell.edu' THEN 'cornell'
      WHEN new.email LIKE '%@stanford.edu' THEN 'stanford'
      WHEN new.email LIKE '%@caltech.edu' THEN 'caltech'
      WHEN new.email LIKE '%@stonybrook.edu' THEN 'stonybrook'
      ELSE 'stonybrook'
    END
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
