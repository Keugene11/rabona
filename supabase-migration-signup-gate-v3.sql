-- Restore the signup email gate that was clobbered when the username
-- migration replaced handle_new_user() without carrying the check forward.
-- Merges: domain/allowlist gating (v2) + username auto-generation (username migration).

create or replace function public.handle_new_user()
returns trigger as $$
declare
  email_domain text;
  base_source  text;
begin
  email_domain := lower(split_part(coalesce(new.email, ''), '@', 2));

  if email_domain = ''
     or (
       not exists (select 1 from public.auth_email_allowed_domains where domain = email_domain)
       and not exists (select 1 from public.auth_email_allowlist where lower(email) = lower(new.email))
     )
  then
    raise exception 'signup_email_not_approved: %', new.email
      using errcode = '22023';
  end if;

  base_source := case
    when length(coalesce(new.raw_user_meta_data->>'full_name', '')) >= 3
      then new.raw_user_meta_data->>'full_name'
    else split_part(coalesce(new.email, ''), '@', 1)
  end;

  insert into public.profiles (id, email, full_name, username, university)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    public.generate_username(base_source),
    case
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
      else 'stonybrook'
    end
  );
  return new;
end;
$$ language plpgsql security definer;
