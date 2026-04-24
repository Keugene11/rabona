-- Adds a unique, space-free @username handle to profiles.
--
-- Rules:
--   3-20 chars, lowercase a-z + digits + underscore
--   Unique across all users
--   Auto-generated from full_name on signup and backfilled for existing users
--
-- Non-destructive: adds a column, populates it, then enforces constraints.

-- 1) Helper: generate a valid unique username from a free-form base string.
--    Strips to [a-z0-9], pads to 3 chars if too short, truncates to 20,
--    and appends numeric suffixes until unique.
create or replace function public.generate_username(base text)
returns text as $$
declare
  cleaned text;
  candidate text;
  suffix int := 1;
  truncated text;
begin
  cleaned := regexp_replace(lower(coalesce(base, '')), '[^a-z0-9]', '', 'g');
  if length(cleaned) < 3 then
    cleaned := 'user' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);
  end if;
  if length(cleaned) > 20 then
    cleaned := substring(cleaned from 1 for 20);
  end if;
  candidate := cleaned;
  while exists (select 1 from public.profiles where username = candidate) loop
    truncated := substring(cleaned from 1 for greatest(3, 20 - length(suffix::text)));
    candidate := truncated || suffix::text;
    suffix := suffix + 1;
  end loop;
  return candidate;
end;
$$ language plpgsql;

-- 2) Add the column (nullable during backfill).
alter table public.profiles add column if not exists username text;

-- 3) Backfill: for every profile without a username, derive one from full_name
--    (or email local-part as fallback).
do $$
declare
  r record;
  base_source text;
begin
  for r in select id, full_name, email from public.profiles where username is null loop
    base_source := case
      when length(coalesce(r.full_name, '')) >= 3 then r.full_name
      else split_part(coalesce(r.email, ''), '@', 1)
    end;
    update public.profiles
      set username = public.generate_username(base_source)
      where id = r.id;
  end loop;
end $$;

-- 4) Enforce format + uniqueness (case-insensitive via lowercase-only format).
alter table public.profiles
  drop constraint if exists profiles_username_format;
alter table public.profiles
  add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9_]{3,20}$');

create unique index if not exists profiles_username_unique
  on public.profiles (username)
  where username is not null;

-- 5) Mark NOT NULL now that every row has a value.
alter table public.profiles alter column username set not null;

-- 6) Update the signup trigger to auto-generate a username for new users.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  base_source text;
begin
  base_source := case
    when length(coalesce(new.raw_user_meta_data->>'full_name', '')) >= 3
      then new.raw_user_meta_data->>'full_name'
    else split_part(coalesce(new.email, ''), '@', 1)
  end;
  insert into public.profiles (id, email, full_name, username)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    public.generate_username(base_source)
  );
  return new;
end;
$$ language plpgsql security definer;
