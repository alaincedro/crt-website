-- CRT admin dashboard: database setup for Supabase.
-- Run once: Supabase → SQL Editor → New query → paste all of this → Run.
-- Safe to run again; it only creates what is missing and resets the access rules.

-- ---------------------------------------------------------------- tables
create table if not exists public.team (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  name       text not null default '' check (char_length(name) <= 80),
  role       text not null default 'staff' check (role in ('admin','staff')),
  created_at timestamptz not null default now()
);

create table if not exists public.leads (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  name        text not null check (char_length(name) between 1 and 120),
  contact     text not null check (char_length(contact) between 1 and 160),
  service     text check (char_length(service) <= 120),
  offer       text check (char_length(offer) <= 120),
  event_date  text check (char_length(event_date) <= 120),
  details     text check (char_length(details) <= 2000),
  page        text check (char_length(page) <= 200),
  source      text check (char_length(source) <= 200),
  status      text not null default 'new' check (status in ('new','replied','quoted','booked','lost')),
  value_rwf   bigint check (value_rwf >= 0),
  notes       text check (char_length(notes) <= 5000),
  assigned_to uuid references public.team(user_id) on delete set null
);
create index if not exists leads_created_at_idx on public.leads (created_at desc);

create table if not exists public.site_content (
  key        text primary key check (key in ('prices','packages','case_studies','testimonials')),
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

-- keep updated_at current
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists leads_touch on public.leads;
create trigger leads_touch before update on public.leads for each row execute function public.touch_updated_at();
drop trigger if exists content_touch on public.site_content;
create trigger content_touch before update on public.site_content for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- who is who
create or replace function public.is_team() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team where user_id = auth.uid())
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team where user_id = auth.uid() and role = 'admin')
$$;

-- ---------------------------------------------------------------- access rules
alter table public.team enable row level security;
alter table public.leads enable row level security;
alter table public.site_content enable row level security;

-- Website visitors (anon) may only ADD an enquiry, and only these columns.
revoke all on public.leads from anon;
grant insert (name, contact, service, offer, event_date, details, page, source) on public.leads to anon;
grant select, insert, update, delete on public.leads to authenticated;

drop policy if exists "visitors add enquiries" on public.leads;
create policy "visitors add enquiries" on public.leads for insert to anon with check (true);
drop policy if exists "team reads leads" on public.leads;
create policy "team reads leads" on public.leads for select to authenticated using (public.is_team());
drop policy if exists "team adds leads" on public.leads;
create policy "team adds leads" on public.leads for insert to authenticated with check (public.is_team());
drop policy if exists "team updates leads" on public.leads;
create policy "team updates leads" on public.leads for update to authenticated using (public.is_team()) with check (public.is_team());
drop policy if exists "admins delete leads" on public.leads;
create policy "admins delete leads" on public.leads for delete to authenticated using (public.is_admin());

-- Team list: members can see it; only admins change it.
revoke all on public.team from anon;
grant select, update, delete on public.team to authenticated;
drop policy if exists "team reads team" on public.team;
create policy "team reads team" on public.team for select to authenticated using (public.is_team());
drop policy if exists "admins update team" on public.team;
create policy "admins update team" on public.team for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins remove team" on public.team;
create policy "admins remove team" on public.team for delete to authenticated using (public.is_admin() and user_id <> auth.uid());

-- Prices, packages and case studies: everyone can read (the website shows them); only admins change them.
revoke all on public.site_content from anon;
grant select on public.site_content to anon;
grant select, insert, update on public.site_content to authenticated;
drop policy if exists "anyone reads content" on public.site_content;
create policy "anyone reads content" on public.site_content for select to anon, authenticated using (true);
drop policy if exists "admins add content" on public.site_content;
create policy "admins add content" on public.site_content for insert to authenticated with check (public.is_admin());
drop policy if exists "admins change content" on public.site_content;
create policy "admins change content" on public.site_content for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- photo and video storage
insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', true, 52428800)
on conflict (id) do update set public = true, file_size_limit = 52428800;

drop policy if exists "admins upload media" on storage.objects;
create policy "admins upload media" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_admin());
drop policy if exists "admins replace media" on storage.objects;
create policy "admins replace media" on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.is_admin());
drop policy if exists "admins delete media" on storage.objects;
create policy "admins delete media" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.is_admin());

-- ---------------------------------------------------------------- starting content (today's prices)
insert into public.site_content (key, value) values
('prices', '{"basic":1000000,"standard":1500000,"premium":2000000,"livestream":200000,"event_bundle":350000,"content_session":400000,"brand_kit":300000,"monthly":450000,"website":600000}'),
('packages', '{
  "Basic":["1 photographer","Up to 6 hours of coverage","300+ edited photos","Private online gallery","Planning call before the day"],
  "Standard":["1 photographer + 1 videographer","Up to 8 hours of coverage","400+ edited photos","3–5 minute highlight film","Private online gallery","Livestream add-on available"],
  "Premium":["2 photographers + 1 videographer","Full-day coverage (up to 12 hours)","600+ edited photos","5–8 minute highlight film + 1-minute teaser","Pre-wedding photo session","Drone shots where allowed"],
  "VIP":["Everything in Premium","Multi-day coverage (e.g. gusaba + wedding)","Full-length ceremony film","Printed photo album","Crew and schedule planned around your day"]
}'),
('case_studies', '{}'),
('testimonials', '[]')
on conflict (key) do nothing;

-- ---------------------------------------------------------------- first admin
-- 1. Authentication → Users → Add user → Create new user: your email + a password,
--    tick "Auto Confirm User".
-- 2. Change the name and email below, remove the two dashes at the start of each line, and run it:
-- insert into public.team (user_id, name, role)
-- select id, 'Alain Cedrick', 'admin' from auth.users where email = 'alain@crt.rw'
-- on conflict (user_id) do update set role = 'admin';

-- ---------------------------------------------------------------- auto-admin (added 8 Nov 2026)
-- Makes the login for alain@crt.rw an admin as soon as it is created.
create or replace function public.auto_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if lower(new.email) = 'alain@crt.rw' then
    insert into public.team (user_id, name, role) values (new.id, 'Alain Cedrick', 'admin')
    on conflict (user_id) do update set role = 'admin';
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_created_admin on auth.users;
create trigger on_auth_user_created_admin after insert on auth.users
  for each row execute function public.auto_admin();
