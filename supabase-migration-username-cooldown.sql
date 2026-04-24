-- Enforces a 30-day cooldown between username changes.
-- Tracks the last change via profiles.username_changed_at and blocks
-- further changes inside the window via a BEFORE UPDATE trigger.

alter table public.profiles add column if not exists username_changed_at timestamptz;

create or replace function public.enforce_username_cooldown()
returns trigger as $$
begin
  if new.username is distinct from old.username then
    if old.username_changed_at is not null
       and now() - old.username_changed_at < interval '30 days' then
      raise exception 'username_cooldown: You can change your username again on %',
        to_char(old.username_changed_at + interval '30 days', 'YYYY-MM-DD')
        using errcode = '22023';
    end if;
    new.username_changed_at := now();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists enforce_username_cooldown on public.profiles;
create trigger enforce_username_cooldown
  before update of username on public.profiles
  for each row execute function public.enforce_username_cooldown();
