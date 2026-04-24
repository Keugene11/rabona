-- Open signup to anyone on the internet.
-- Replaces the domain/allowlist gate from supabase-migration-signup-gate-v3.sql
-- with an unconditional profile insert. University is auto-tagged when the
-- email domain matches a known school; otherwise it's left NULL.

create or replace function public.handle_new_user()
returns trigger as $$
declare
  email_domain text;
  base_source  text;
  uni_slug     text;
begin
  email_domain := lower(split_part(coalesce(new.email, ''), '@', 2));

  base_source := case
    when length(coalesce(new.raw_user_meta_data->>'full_name', '')) >= 3
      then new.raw_user_meta_data->>'full_name'
    else split_part(coalesce(new.email, ''), '@', 1)
  end;

  uni_slug := case
    when email_domain = 'harvard.edu'    then 'harvard'
    when email_domain = 'yale.edu'       then 'yale'
    when email_domain = 'princeton.edu'  then 'princeton'
    when email_domain = 'columbia.edu'   then 'columbia'
    when email_domain = 'upenn.edu'      then 'upenn'
    when email_domain = 'brown.edu'      then 'brown'
    when email_domain = 'dartmouth.edu'  then 'dartmouth'
    when email_domain = 'cornell.edu'    then 'cornell'
    when email_domain = 'stanford.edu'   then 'stanford'
    when email_domain = 'caltech.edu'    then 'caltech'
    when email_domain = 'stonybrook.edu' then 'stonybrook'
    else null
  end;

  insert into public.profiles (id, email, full_name, username, university)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    public.generate_username(base_source),
    uni_slug
  );
  return new;
end;
$$ language plpgsql security definer;
