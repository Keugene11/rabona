-- Migration: Add university column to profiles and groups
-- Run this in your Supabase SQL Editor

-- Add university column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS university text DEFAULT 'rabona';
CREATE INDEX IF NOT EXISTS idx_profiles_university ON profiles(university);

-- Add university column to groups
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS university text DEFAULT 'rabona';
CREATE INDEX IF NOT EXISTS idx_groups_university ON groups(university);

-- Set university for all existing profiles
UPDATE public.profiles SET university = 'rabona' WHERE university IS NULL OR university = '';

-- Update the handle_new_user trigger to set default university
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, university)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'rabona'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
