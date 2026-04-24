-- Owner-protection: refuse to delete auth.users rows for protected owner emails.
-- Prevents accidental cascade-deletion of owner accounts by buggy code,
-- misconfigured env vars, or ill-considered admin operations.

CREATE TABLE IF NOT EXISTS public.protected_owner_emails (
  email text PRIMARY KEY,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.protected_owner_emails ENABLE ROW LEVEL SECURITY;
-- No policies: only service-role and SECURITY DEFINER functions can access.

INSERT INTO public.protected_owner_emails (email, reason) VALUES
  ('keugenelee11@gmail.com', 'project owner'),
  ('keugenelee9@gmail.com',  'project owner')
ON CONFLICT (email) DO NOTHING;

CREATE OR REPLACE FUNCTION public.protect_owner_account()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.protected_owner_emails WHERE lower(email) = lower(OLD.email)) THEN
    RAISE EXCEPTION 'refusing to delete protected owner account: %', OLD.email
      USING ERRCODE = '22023';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS protect_owner_on_auth_delete ON auth.users;
CREATE TRIGGER protect_owner_on_auth_delete
  BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.protect_owner_account();
