-- Enable extensions
create extension if not exists pgcrypto;
create extension if not exists vector;

-- =========
-- ORGS + MEMBERSHIP
-- =========

create table if not exists public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create table if not exists public.org_members (
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index if not exists idx_org_members_user on public.org_members(user_id);

-- =========
-- GRANTS (CORE RECORD)
-- =========

create table if not exists public.grants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,

  grant_name text not null,
  sponsor_org text,
  amount_text text,
  amount_min numeric,
  amount_max numeric,

  deadline_date date,
  deadline_text text,

  focus_area text,
  eligibility_summary text,
  application_link text,
  geographic_scope text,
  funder_type text,

  status text not null default 'open'
    check (status in ('open','watch','applied','won','lost','closed','archived')),

  notes text,

  -- Derived scoring / dual-track
  priority_score int,
  business_match_pct int,
  woc_focus_rating int,
  leadership_dev_alignment int,
  community_impact_score int,

  llc_priority_score int,
  foundation_priority_score int,
  overall_strategic_value int,

  -- Provenance
  discovery_source text,
  source_reliability_score int,

  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_grants_org on public.grants(org_id);
create index if not exists idx_grants_deadline on public.grants(org_id, deadline_date);
create index if not exists idx_grants_status on public.grants(org_id, status);

-- =========
-- RUNS (DISCOVER/ASSESS/PITCH JOBS)
-- =========

create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,

  run_type text not null check (run_type in ('discover','assess','pitch')),
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed')),
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error text,

  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_runs_org on public.runs(org_id, created_at desc);
create index if not exists idx_runs_type on public.runs(org_id, run_type, created_at desc);

-- =========
-- RUN ITEMS (which grants were touched by a run)
-- =========

create table if not exists public.run_items (
  run_id uuid not null references public.runs(id) on delete cascade,
  grant_id uuid not null references public.grants(id) on delete cascade,
  action text,
  meta jsonb not null default '{}'::jsonb,
  primary key (run_id, grant_id)
);

create index if not exists idx_run_items_grant on public.run_items(grant_id);

-- =========
-- LLM SPEND LOGS
-- =========

create table if not exists public.llm_spend_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  run_id uuid references public.runs(id) on delete set null,

  provider text not null,
  model text not null,
  prompt_tokens int,
  completion_tokens int,
  total_tokens int,
  cost_usd numeric(10,4),

  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_spend_org on public.llm_spend_logs(org_id, created_at desc);

-- =========
-- EMBEDDINGS (OPTIONAL: semantic search)
-- =========

create table if not exists public.grant_embeddings (
  grant_id uuid primary key references public.grants(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  content text not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create index if not exists idx_embeddings_org on public.grant_embeddings(org_id);

-- =========
-- SUBSCRIPTIONS / BILLING
-- =========

create table if not exists public.org_subscriptions (
  org_id uuid primary key references public.orgs(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text not null default 'free' check (plan in ('free','trial','pro','team')),
  status text not null default 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

-- =========
-- MONTHLY USAGE COUNTERS
-- =========

create table if not exists public.org_usage_monthly (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,

  discover_runs_count int not null default 0,
  assess_runs_count int not null default 0,
  pitch_runs_count int not null default 0,
  candidates_inserted_count int not null default 0,
  llm_cost_usd_total numeric(12,4) not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (org_id, period_start)
);

create index if not exists idx_org_usage_monthly_org_period
  on public.org_usage_monthly(org_id, period_start desc);

create index if not exists idx_org_usage_monthly_org
  on public.org_usage_monthly(org_id);

-- =========
-- FEATURE FLAGS
-- =========

create table if not exists public.feature_flags (
  org_id uuid not null references public.orgs(id) on delete cascade,
  key text not null,
  enabled boolean not null default false,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id, key)
);

create index if not exists idx_feature_flags_org on public.feature_flags(org_id);

-- =========
-- STRIPE EVENT IDEMPOTENCY
-- =========

create table if not exists public.stripe_events (
  stripe_event_id text primary key,
  received_at timestamptz not null default now(),
  type text,
  payload jsonb not null default '{}'::jsonb,
  processed boolean not null default false
);

create index if not exists idx_stripe_events_received_at on public.stripe_events(received_at desc);

-- =========
-- MEMBERSHIP HELPER
-- =========

create or replace function public.is_org_member(_org_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.org_members m
    where m.org_id = _org_id and m.user_id = auth.uid()
  );
$$;

-- =========
-- PLAN / PERIOD HELPERS
-- =========

create or replace function public.get_plan_limits(_plan text)
returns table (
  monthly_discover_runs int,
  monthly_assess_runs int,
  monthly_pitch_runs int,
  monthly_candidates_inserted int,
  monthly_llm_cost_usd numeric
)
language sql stable as $$
  select
    case _plan
      when 'free' then 10
      when 'trial' then 50
      when 'pro' then 500
      when 'team' then 2000
      else 10
    end as monthly_discover_runs,
    case _plan
      when 'free' then 0
      when 'trial' then 30
      when 'pro' then 300
      when 'team' then 1200
      else 0
    end as monthly_assess_runs,
    case _plan
      when 'free' then 0
      when 'trial' then 20
      when 'pro' then 200
      when 'team' then 800
      else 0
    end as monthly_pitch_runs,
    case _plan
      when 'free' then 100
      when 'trial' then 500
      when 'pro' then 5000
      when 'team' then 20000
      else 100
    end as monthly_candidates_inserted,
    case _plan
      when 'free' then 5.00
      when 'trial' then 25.00
      when 'pro' then 250.00
      when 'team' then 1000.00
      else 5.00
    end::numeric as monthly_llm_cost_usd;
$$;

create or replace function public.get_billing_period_for_org(_org_id uuid, _at timestamptz default now())
returns table (
  period_start timestamptz,
  period_end timestamptz,
  effective_plan text,
  effective_status text
)
language plpgsql stable as $$
declare
  sub_row public.org_subscriptions%rowtype;
  month_start timestamptz;
  month_end timestamptz;
begin
  month_start := date_trunc('month', _at at time zone 'UTC') at time zone 'UTC';
  month_end := (date_trunc('month', _at at time zone 'UTC') + interval '1 month') at time zone 'UTC';

  select * into sub_row
  from public.org_subscriptions s
  where s.org_id = _org_id;

  if not found then
    return query select month_start, month_end, 'free'::text, 'free_fallback'::text;
    return;
  end if;

  if sub_row.status = 'active'
     and (sub_row.current_period_end is null or sub_row.current_period_end > _at)
     and (sub_row.current_period_start is null or sub_row.current_period_start <= _at) then
    return query
      select
        coalesce(sub_row.current_period_start, month_start),
        coalesce(sub_row.current_period_end, month_end),
        sub_row.plan,
        'active'::text;
    return;
  end if;

  return query select month_start, month_end, 'free'::text, 'free_fallback'::text;
end;
$$;

create or replace function public.ensure_usage_row(_org_id uuid)
returns public.org_usage_monthly
language plpgsql
security definer
as $$
declare
  p record;
  u public.org_usage_monthly;
begin
  select * into p from public.get_billing_period_for_org(_org_id, now());

  insert into public.org_usage_monthly (org_id, period_start, period_end)
  values (_org_id, p.period_start, p.period_end)
  on conflict (org_id, period_start)
  do update set period_end = excluded.period_end
  returning * into u;

  return u;
end;
$$;

revoke all on function public.ensure_usage_row(uuid) from public;
grant execute on function public.ensure_usage_row(uuid) to service_role;

create or replace function public.reserve_usage(
  _org_id uuid,
  _run_type text,
  _candidates_delta int default 0,
  _cost_delta numeric default 0
)
returns table (
  allowed boolean,
  error_code text,
  metric text,
  plan text,
  billing_status text,
  limit_value numeric,
  used_value numeric,
  remaining_value numeric,
  period_start timestamptz,
  period_end timestamptz,
  discover_runs_count int,
  assess_runs_count int,
  pitch_runs_count int,
  candidates_inserted_count int,
  llm_cost_usd_total numeric
)
language plpgsql
security definer
as $$
declare
  p record;
  l record;
  u public.org_usage_monthly%rowtype;
  next_discover int;
  next_assess int;
  next_pitch int;
  next_candidates int;
  next_cost numeric;
begin
  if _run_type not in ('discover', 'assess', 'pitch') then
    raise exception 'invalid run_type %', _run_type;
  end if;

  select * into p from public.get_billing_period_for_org(_org_id, now());
  select * into l from public.get_plan_limits(p.effective_plan);

  insert into public.org_usage_monthly (org_id, period_start, period_end)
  values (_org_id, p.period_start, p.period_end)
  on conflict (org_id, period_start)
  do update set period_end = excluded.period_end;

  select * into u
  from public.org_usage_monthly
  where org_id = _org_id and period_start = p.period_start
  for update;

  next_discover := u.discover_runs_count + case when _run_type = 'discover' then 1 else 0 end;
  next_assess := u.assess_runs_count + case when _run_type = 'assess' then 1 else 0 end;
  next_pitch := u.pitch_runs_count + case when _run_type = 'pitch' then 1 else 0 end;
  next_candidates := u.candidates_inserted_count + greatest(coalesce(_candidates_delta, 0), 0);
  next_cost := u.llm_cost_usd_total + greatest(coalesce(_cost_delta, 0), 0);

  if _run_type = 'assess' and p.effective_plan not in ('trial', 'pro', 'team') then
    return query
      select false, 'not_entitled', 'assess', p.effective_plan, p.effective_status,
             0::numeric, u.assess_runs_count::numeric, 0::numeric,
             p.period_start, p.period_end,
             u.discover_runs_count, u.assess_runs_count, u.pitch_runs_count, u.candidates_inserted_count, u.llm_cost_usd_total;
    return;
  end if;

  if _run_type = 'pitch' and p.effective_plan not in ('trial', 'pro', 'team') then
    return query
      select false, 'not_entitled', 'pitch', p.effective_plan, p.effective_status,
             0::numeric, u.pitch_runs_count::numeric, 0::numeric,
             p.period_start, p.period_end,
             u.discover_runs_count, u.assess_runs_count, u.pitch_runs_count, u.candidates_inserted_count, u.llm_cost_usd_total;
    return;
  end if;

  if next_discover > l.monthly_discover_runs then
    return query
      select false, 'quota_exceeded', 'discover_runs_count', p.effective_plan, p.effective_status,
             l.monthly_discover_runs::numeric, u.discover_runs_count::numeric,
             greatest(l.monthly_discover_runs - u.discover_runs_count, 0)::numeric,
             p.period_start, p.period_end,
             u.discover_runs_count, u.assess_runs_count, u.pitch_runs_count, u.candidates_inserted_count, u.llm_cost_usd_total;
    return;
  end if;

  if next_assess > l.monthly_assess_runs then
    return query
      select false, 'quota_exceeded', 'assess_runs_count', p.effective_plan, p.effective_status,
             l.monthly_assess_runs::numeric, u.assess_runs_count::numeric,
             greatest(l.monthly_assess_runs - u.assess_runs_count, 0)::numeric,
             p.period_start, p.period_end,
             u.discover_runs_count, u.assess_runs_count, u.pitch_runs_count, u.candidates_inserted_count, u.llm_cost_usd_total;
    return;
  end if;

  if next_pitch > l.monthly_pitch_runs then
    return query
      select false, 'quota_exceeded', 'pitch_runs_count', p.effective_plan, p.effective_status,
             l.monthly_pitch_runs::numeric, u.pitch_runs_count::numeric,
             greatest(l.monthly_pitch_runs - u.pitch_runs_count, 0)::numeric,
             p.period_start, p.period_end,
             u.discover_runs_count, u.assess_runs_count, u.pitch_runs_count, u.candidates_inserted_count, u.llm_cost_usd_total;
    return;
  end if;

  if next_candidates > l.monthly_candidates_inserted then
    return query
      select false, 'quota_exceeded', 'candidates_inserted_count', p.effective_plan, p.effective_status,
             l.monthly_candidates_inserted::numeric, u.candidates_inserted_count::numeric,
             greatest(l.monthly_candidates_inserted - u.candidates_inserted_count, 0)::numeric,
             p.period_start, p.period_end,
             u.discover_runs_count, u.assess_runs_count, u.pitch_runs_count, u.candidates_inserted_count, u.llm_cost_usd_total;
    return;
  end if;

  if next_cost > l.monthly_llm_cost_usd then
    return query
      select false, 'quota_exceeded', 'llm_cost_usd_total', p.effective_plan, p.effective_status,
             l.monthly_llm_cost_usd::numeric, u.llm_cost_usd_total::numeric,
             greatest(l.monthly_llm_cost_usd - u.llm_cost_usd_total, 0)::numeric,
             p.period_start, p.period_end,
             u.discover_runs_count, u.assess_runs_count, u.pitch_runs_count, u.candidates_inserted_count, u.llm_cost_usd_total;
    return;
  end if;

  update public.org_usage_monthly
  set
    discover_runs_count = next_discover,
    assess_runs_count = next_assess,
    pitch_runs_count = next_pitch,
    candidates_inserted_count = next_candidates,
    llm_cost_usd_total = next_cost
  where id = u.id
  returning * into u;

  return query
    select true, null::text, null::text, p.effective_plan, p.effective_status,
           null::numeric, null::numeric, null::numeric,
           p.period_start, p.period_end,
           u.discover_runs_count, u.assess_runs_count, u.pitch_runs_count, u.candidates_inserted_count, u.llm_cost_usd_total;
end;
$$;

revoke all on function public.reserve_usage(uuid, text, int, numeric) from public;
grant execute on function public.reserve_usage(uuid, text, int, numeric) to service_role;

create or replace function public.apply_usage_delta(
  _org_id uuid,
  _candidates_delta int default 0,
  _cost_delta numeric default 0
)
returns public.org_usage_monthly
language plpgsql
security definer
as $$
declare
  p record;
  u public.org_usage_monthly;
begin
  select * into p from public.get_billing_period_for_org(_org_id, now());

  insert into public.org_usage_monthly (org_id, period_start, period_end)
  values (_org_id, p.period_start, p.period_end)
  on conflict (org_id, period_start)
  do update set period_end = excluded.period_end;

  update public.org_usage_monthly
  set
    candidates_inserted_count = greatest(0, candidates_inserted_count + coalesce(_candidates_delta, 0)),
    llm_cost_usd_total = greatest(0, llm_cost_usd_total + coalesce(_cost_delta, 0))
  where org_id = _org_id and period_start = p.period_start
  returning * into u;

  return u;
end;
$$;

revoke all on function public.apply_usage_delta(uuid, int, numeric) from public;
grant execute on function public.apply_usage_delta(uuid, int, numeric) to service_role;

-- =========
-- UPDATED_AT TRIGGER
-- =========

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_grants_updated_at on public.grants;
create trigger set_grants_updated_at
before update on public.grants
for each row execute function public.set_updated_at();

drop trigger if exists set_org_subscriptions_updated_at on public.org_subscriptions;
create trigger set_org_subscriptions_updated_at
before update on public.org_subscriptions
for each row execute function public.set_updated_at();

drop trigger if exists set_org_usage_monthly_updated_at on public.org_usage_monthly;
create trigger set_org_usage_monthly_updated_at
before update on public.org_usage_monthly
for each row execute function public.set_updated_at();

drop trigger if exists set_feature_flags_updated_at on public.feature_flags;
create trigger set_feature_flags_updated_at
before update on public.feature_flags
for each row execute function public.set_updated_at();
