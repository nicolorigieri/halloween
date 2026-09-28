create table if not exists public.contestants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  costume text not null check (char_length(costume) between 1 and 70),
  vote_count integer not null default 0 check (vote_count >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.votes (
  voter_id uuid primary key,
  contestant_id uuid not null references public.contestants(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.contest_settings (
  id boolean primary key default true check (id),
  voting_closed boolean not null default false
);

insert into public.contest_settings (id, voting_closed)
values (true, false)
on conflict (id) do nothing;

alter table public.contestants enable row level security;
alter table public.votes enable row level security;
alter table public.contest_settings enable row level security;

grant select on public.contestants to anon, authenticated;
grant select on public.contest_settings to anon, authenticated;
grant insert (name, costume) on public.contestants to anon, authenticated;
grant insert (voter_id, contestant_id) on public.votes to anon, authenticated;

drop policy if exists "Anyone can view contestants" on public.contestants;
create policy "Anyone can view contestants"
  on public.contestants for select
  to anon, authenticated
  using (true);

drop policy if exists "Anyone can register a contestant" on public.contestants;
create policy "Anyone can register a contestant"
  on public.contestants for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Anyone can vote once" on public.votes;
create policy "Anyone can vote once"
  on public.votes for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Anyone can view contest settings" on public.contest_settings;
create policy "Anyone can view contest settings"
  on public.contest_settings for select
  to anon, authenticated
  using (true);

create or replace function public.increment_contestant_vote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.contestants
  set vote_count = vote_count + 1
  where id = new.contestant_id;
  return new;
end;
$$;

drop trigger if exists votes_increment_contestant on public.votes;
create trigger votes_increment_contestant
  after insert on public.votes
  for each row execute function public.increment_contestant_vote();

create or replace function public.reject_votes_after_close()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select voting_closed from public.contest_settings where id = true) then
    raise exception 'Voting is closed';
  end if;
  return new;
end;
$$;

drop trigger if exists votes_reject_after_close on public.votes;
create trigger votes_reject_after_close
  before insert on public.votes
  for each row execute function public.reject_votes_after_close();

create or replace function public.has_voted(voter uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (select 1 from public.votes where voter_id = voter);
$$;

revoke all on function public.has_voted(uuid) from public;
grant execute on function public.has_voted(uuid) to anon, authenticated;

do $pub$
declare
  realtime_table text;
begin
  foreach realtime_table in array array['contestants', 'contest_settings'] loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = realtime_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', realtime_table);
    end if;
  end loop;
end;
$pub$;