-- Migration 001: org_profiles
-- Adds per-org mission context used by discover/assess/pitch LLM calls.

create table if not exists public.org_profiles (
  org_id         uuid primary key references public.orgs(id) on delete cascade,
  org_name       text,
  mission        text,
  entity_type    text not null default 'nonprofit'
                   check (entity_type in ('nonprofit','llc','hybrid','other')),
  geography      text,
  focus_areas    text[],
  eligibility_notes text,
  search_keywords   text[],
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.org_profiles enable row level security;

drop policy if exists "profiles_select_member" on public.org_profiles;
create policy "profiles_select_member"
on public.org_profiles for select
using (public.is_org_member(org_id));

drop policy if exists "profiles_insert_owner_admin" on public.org_profiles;
create policy "profiles_insert_owner_admin"
on public.org_profiles for insert
with check (
  exists (
    select 1 from public.org_members m
    where m.org_id = org_id and m.user_id = auth.uid()
      and m.role in ('owner','admin')
  )
);

drop policy if exists "profiles_update_owner_admin" on public.org_profiles;
create policy "profiles_update_owner_admin"
on public.org_profiles for update
using (
  exists (
    select 1 from public.org_members m
    where m.org_id = org_id and m.user_id = auth.uid()
      and m.role in ('owner','admin')
  )
);

drop trigger if exists set_org_profiles_updated_at on public.org_profiles;
create trigger set_org_profiles_updated_at
before update on public.org_profiles
for each row execute function public.set_updated_at();
