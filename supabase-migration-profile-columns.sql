-- Backfill profile columns that production stonyloop had but rabona's DB was missing.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_complete boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS wall_posts_from text;

-- Optional: backfill sensible defaults. NULL means 'everyone' per the privacy-enforcement RLS.
UPDATE public.profiles SET wall_posts_from = 'everyone' WHERE wall_posts_from IS NULL;
