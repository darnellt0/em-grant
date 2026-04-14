alter table public.orgs enable row level security;
alter table public.org_members enable row level security;
alter table public.grants enable row level security;
alter table public.runs enable row level security;
alter table public.run_items enable row level security;
alter table public.llm_spend_logs enable row level security;
alter table public.grant_embeddings enable row level security;
alter table public.org_subscriptions enable row level security;
alter table public.org_usage_monthly enable row level security;
alter table public.feature_flags enable row level security;
alter table public.stripe_events enable row level security;

-- Helper: check membership
create or replace function public.is_org_member(_org_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.org_members m
    where m.org_id = _org_id and m.user_id = auth.uid()
  );
$$;

-- ORGS: members can read org; only owners/admins update
drop policy if exists "orgs_select_member" on public.orgs;
create policy "orgs_select_member"
on public.orgs for select
using (public.is_org_member(id));

drop policy if exists "orgs_insert_self" on public.orgs;
create policy "orgs_insert_self"
on public.orgs for insert
with check (created_by = auth.uid());

drop policy if exists "orgs_update_owner_admin" on public.orgs;
create policy "orgs_update_owner_admin"
on public.orgs for update
using (
  exists (
    select 1 from public.org_members m
    where m.org_id = id and m.user_id = auth.uid() and m.role in ('owner','admin')
  )
);

-- MEMBERS: members can read; only owner/admin manage
drop policy if exists "members_select_member" on public.org_members;
create policy "members_select_member"
on public.org_members for select
using (public.is_org_member(org_id));

drop policy if exists "members_insert_owner_admin" on public.org_members;
create policy "members_insert_owner_admin"
on public.org_members for insert
with check (
  exists (
    select 1 from public.org_members m
    where m.org_id = org_id and m.user_id = auth.uid() and m.role in ('owner','admin')
  )
);

drop policy if exists "members_delete_owner_admin" on public.org_members;
create policy "members_delete_owner_admin"
on public.org_members for delete
using (
  exists (
    select 1 from public.org_members m
    where m.org_id = org_id and m.user_id = auth.uid() and m.role in ('owner','admin')
  )
);

-- SUBSCRIPTIONS: members can read
drop policy if exists "subs_select_member" on public.org_subscriptions;
create policy "subs_select_member"
on public.org_subscriptions for select
using (public.is_org_member(org_id));

-- GRANTS: org members can CRUD
drop policy if exists "grants_select_member" on public.grants;
create policy "grants_select_member"
on public.grants for select
using (public.is_org_member(org_id));

drop policy if exists "grants_insert_member" on public.grants;
create policy "grants_insert_member"
on public.grants for insert
with check (public.is_org_member(org_id));

drop policy if exists "grants_update_member" on public.grants;
create policy "grants_update_member"
on public.grants for update
using (public.is_org_member(org_id));

drop policy if exists "grants_delete_owner_admin" on public.grants;
create policy "grants_delete_owner_admin"
on public.grants for delete
using (
  exists (
    select 1 from public.org_members m
    where m.org_id = org_id and m.user_id = auth.uid() and m.role in ('owner','admin')
  )
);

-- RUNS: org members can read; creator inserts; member can update within org
drop policy if exists "runs_select_member" on public.runs;
create policy "runs_select_member"
on public.runs for select
using (public.is_org_member(org_id));

drop policy if exists "runs_insert_member" on public.runs;
create policy "runs_insert_member"
on public.runs for insert
with check (public.is_org_member(org_id) and created_by = auth.uid());

drop policy if exists "runs_update_member" on public.runs;
create policy "runs_update_member"
on public.runs for update
using (public.is_org_member(org_id));

-- RUN ITEMS: org members can read/write via runs/grants link
drop policy if exists "run_items_select_member" on public.run_items;
create policy "run_items_select_member"
on public.run_items for select
using (
  exists (
    select 1
    from public.runs r
    where r.id = run_id and public.is_org_member(r.org_id)
  )
);

drop policy if exists "run_items_insert_member" on public.run_items;
create policy "run_items_insert_member"
on public.run_items for insert
with check (
  exists (
    select 1
    from public.runs r
    where r.id = run_id and public.is_org_member(r.org_id)
  )
);

-- SPEND LOGS: org members can read; edge function service role writes
drop policy if exists "spend_select_member" on public.llm_spend_logs;
create policy "spend_select_member"
on public.llm_spend_logs for select
using (public.is_org_member(org_id));

-- EMBEDDINGS: org members can read; writes controlled by API
drop policy if exists "embeddings_select_member" on public.grant_embeddings;
create policy "embeddings_select_member"
on public.grant_embeddings for select
using (public.is_org_member(org_id));

-- USAGE: org members can read; service role writes
drop policy if exists "usage_select_member" on public.org_usage_monthly;
create policy "usage_select_member"
on public.org_usage_monthly for select
using (public.is_org_member(org_id));

-- FEATURE FLAGS: org members can read; service role writes
drop policy if exists "feature_flags_select_member" on public.feature_flags;
create policy "feature_flags_select_member"
on public.feature_flags for select
using (public.is_org_member(org_id));
