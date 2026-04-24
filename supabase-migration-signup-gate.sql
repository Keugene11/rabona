-- Migration: enforce email gate at the DB trigger level.
-- Why: the API-route check is bypassable — callers can hit Supabase auth endpoints
-- directly and the handle_new_user trigger created profiles unconditionally.
-- This migration moves the gate into the trigger so bypass routes cannot create accounts.

-- Allowlist tables (trigger is SECURITY DEFINER so it reads these bypassing RLS).
CREATE TABLE IF NOT EXISTS public.auth_email_allowed_domains (
  domain text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.auth_email_allowlist (
  email text PRIMARY KEY,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.auth_email_allowed_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_email_allowlist ENABLE ROW LEVEL SECURITY;
-- No policies defined → anon/authenticated clients cannot read or write.
-- Only the service role (and SECURITY DEFINER functions) can access.

INSERT INTO public.auth_email_allowed_domains (domain) VALUES
  ('stonybrook.edu')
ON CONFLICT (domain) DO NOTHING;

INSERT INTO public.auth_email_allowlist (email, note) VALUES
  ('keugenelee11@gmail.com', 'owner'),
  ('keugenelee9@gmail.com',  'owner'),
  ('reviewer@rabona.app', 'app-store reviewer'),
  ('willzhou109@gmail.com',  'dev')
ON CONFLICT (email) DO NOTHING;

-- Replace the trigger to enforce the gate BEFORE inserting the profile.
-- RAISE EXCEPTION rolls back the auth.users insert (same transaction), so
-- a blocked signup leaves no orphan rows in auth.users or profiles.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  email_domain text;
BEGIN
  email_domain := lower(split_part(new.email, '@', 2));

  IF email_domain = ''
     OR (
       NOT EXISTS (SELECT 1 FROM public.auth_email_allowed_domains WHERE domain = email_domain)
       AND NOT EXISTS (SELECT 1 FROM public.auth_email_allowlist WHERE lower(email) = lower(new.email))
     )
  THEN
    RAISE EXCEPTION 'signup_email_not_approved: %', new.email
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, university)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    CASE
      WHEN email_domain = 'harvard.edu'    THEN 'harvard'
      WHEN email_domain = 'yale.edu'       THEN 'yale'
      WHEN email_domain = 'princeton.edu'  THEN 'princeton'
      WHEN email_domain = 'columbia.edu'   THEN 'columbia'
      WHEN email_domain = 'upenn.edu'      THEN 'upenn'
      WHEN email_domain = 'brown.edu'      THEN 'brown'
      WHEN email_domain = 'dartmouth.edu'  THEN 'dartmouth'
      WHEN email_domain = 'cornell.edu'    THEN 'cornell'
      WHEN email_domain = 'stanford.edu'   THEN 'stanford'
      WHEN email_domain = 'caltech.edu'    THEN 'caltech'
      WHEN email_domain = 'stonybrook.edu' THEN 'stonybrook'
      ELSE 'stonybrook'
    END
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
