-- ============================================================
-- Onboarding + team invites
--
-- 1) Role-check helper (security definer, avoids RLS recursion)
-- 2) Fix cross-org RLS policies: the previous versions compared
--    `m.org_id = org_id` inside an EXISTS over org_members m, which
--    Postgres resolves to `m.org_id = m.org_id` (always true) — any
--    owner/admin of ANY org passed the check for EVERY org.
-- 3) create_org_with_owner(): first-time onboarding. The RLS insert
--    policy on org_members requires an existing owner/admin, so the
--    first membership row can only be created by a definer function.
-- 4) org_invites table + policies + accept_org_invite()
-- 5) Helper RPCs for the UI (pending invites, member emails)
-- ============================================================

-- 1) Role-check helper
create or replace function public.has_org_role(_org_id uuid, _roles text[])
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.org_members m
    where m.org_id = _org_id
      and m.user_id = auth.uid()
      and m.role = any(_roles)
  );
$$;

revoke all on function public.has_org_role(uuid, text[]) from public;
grant execute on function public.has_org_role(uuid, text[]) to authenticated;

-- 2) Re-create the tautological policies with a real org check
drop policy if exists "members_insert_owner_admin" on public.org_members;
create policy "members_insert_owner_admin"
on public.org_members for insert
with check (public.has_org_role(org_id, array['owner','admin']));

drop policy if exists "members_delete_owner_admin" on public.org_members;
create policy "members_delete_owner_admin"
on public.org_members for delete
using (public.has_org_role(org_id, array['owner','admin']));

drop policy if exists "profiles_insert_owner_admin" on public.org_profiles;
create policy "profiles_insert_owner_admin"
on public.org_profiles for insert
with check (public.has_org_role(org_id, array['owner','admin']));

drop policy if exists "profiles_update_owner_admin" on public.org_profiles;
create policy "profiles_update_owner_admin"
on public.org_profiles for update
using (public.has_org_role(org_id, array['owner','admin']));

drop policy if exists "grants_delete_owner_admin" on public.grants;
create policy "grants_delete_owner_admin"
on public.grants for delete
using (public.has_org_role(org_id, array['owner','admin']));

-- 3) First-time onboarding: create an org and its owner atomically
create or replace function public.create_org_with_owner(_name text, _slug text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_slug text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if _name is null or length(trim(_name)) = 0 then
    raise exception 'org_name_required';
  end if;

  v_slug := coalesce(nullif(trim(_slug), ''),
    regexp_replace(lower(trim(_name)), '[^a-z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  if length(v_slug) = 0 then
    v_slug := 'org';
  end if;
  if exists (select 1 from public.orgs where slug = v_slug) then
    v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 8);
  end if;

  insert into public.orgs (name, slug, created_by)
  values (trim(_name), v_slug, auth.uid())
  returning id into v_org_id;

  insert into public.org_members (org_id, user_id, role)
  values (v_org_id, auth.uid(), 'owner');

  return v_org_id;
end;
$$;

revoke all on function public.create_org_with_owner(text, text) from public;
grant execute on function public.create_org_with_owner(text, text) to authenticated;

-- 4) Invites
create table if not exists public.org_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin','member')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null
);

create unique index if not exists idx_org_invites_pending_unique
  on public.org_invites (org_id, lower(email)) where accepted_at is null;
create index if not exists idx_org_invites_email on public.org_invites (lower(email));

alter table public.org_invites enable row level security;

drop policy if exists "invites_select_member" on public.org_invites;
create policy "invites_select_member"
on public.org_invites for select
using (public.is_org_member(org_id));

drop policy if exists "invites_select_invitee" on public.org_invites;
create policy "invites_select_invitee"
on public.org_invites for select
using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists "invites_insert_owner_admin" on public.org_invites;
create policy "invites_insert_owner_admin"
on public.org_invites for insert
with check (
  public.has_org_role(org_id, array['owner','admin'])
  and invited_by = auth.uid()
);

drop policy if exists "invites_delete_owner_admin" on public.org_invites;
create policy "invites_delete_owner_admin"
on public.org_invites for delete
using (public.has_org_role(org_id, array['owner','admin']));

create or replace function public.accept_org_invite(_invite_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.org_invites%rowtype;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  select * into v_invite
  from public.org_invites
  where id = _invite_id and accepted_at is null
  for update;

  if not found then
    raise exception 'invite_not_found_or_already_used';
  end if;

  if lower(v_invite.email) <> v_email then
    raise exception 'invite_email_mismatch';
  end if;

  insert into public.org_members (org_id, user_id, role)
  values (v_invite.org_id, auth.uid(), v_invite.role)
  on conflict (org_id, user_id) do nothing;

  update public.org_invites
  set accepted_at = now(), accepted_by = auth.uid()
  where id = _invite_id;

  return v_invite.org_id;
end;
$$;

revoke all on function public.accept_org_invite(uuid) from public;
grant execute on function public.accept_org_invite(uuid) to authenticated;

-- 5) UI helper RPCs

-- Pending invites for the signed-in user (joins org name, which the
-- invitee cannot read directly because they are not a member yet)
create or replace function public.get_my_pending_invites()
returns table (invite_id uuid, org_id uuid, org_name text, role text, created_at timestamptz)
language sql stable
security definer
set search_path = public
as $$
  select i.id, i.org_id, o.name, i.role, i.created_at
  from public.org_invites i
  join public.orgs o on o.id = i.org_id
  where i.accepted_at is null
    and lower(i.email) = lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

revoke all on function public.get_my_pending_invites() from public;
grant execute on function public.get_my_pending_invites() to authenticated;

-- Member list with emails (auth.users is not readable from the client)
create or replace function public.get_org_member_emails(_org_id uuid)
returns table (user_id uuid, email text, role text, created_at timestamptz)
language sql stable
security definer
set search_path = public
as $$
  select m.user_id, u.email::text, m.role, m.created_at
  from public.org_members m
  join auth.users u on u.id = m.user_id
  where m.org_id = _org_id
    and public.is_org_member(_org_id);
$$;

revoke all on function public.get_org_member_emails(uuid) from public;
grant execute on function public.get_org_member_emails(uuid) to authenticated;
