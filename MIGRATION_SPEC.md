# Grant Dashboard: Moving Off the Laptop — Migration Spec

*Written 2026-08-09. Context: the canonical Grant App runs on the OpenClaw laptop
(`/home/evergreen/.openclaw/workspace/grant-app`) and was published that day at
https://grants.elevatedmovements.com via Cloudflare Tunnel `em-grants` + Access.
This spec is the "rebuild decision" the EM Hub README guardrail refers to.*

## What "on the laptop" actually means

Three couplings, not one:

1. **Serving** — FastAPI (`grant-app.service`, uvicorn :5000) serving its built
   React/Vite SPA and `/api/*`. Source of truth is **local SQLite**
   `backend/grants.db` (~1,092 grants with statuses, scores, notes).
2. **Feeding** — 9 cron jobs on the laptop: scrapers (grants.gov daily 3:00,
   SBIR, CA portal Tue, corporate/web Wed, AI discovery Sun), Dorothy's 4:40 AM
   assessment pass, pipeline v2 4:45 (writes Supabase + auto-drafts),
   deadline/draft alerts to Telegram.
3. **Thinking** — the deep one: the dashboard's AI endpoints (assess,
   generate-pitch, components, email templates) do NOT call an LLM API. They
   `subprocess` out to **OpenClaw agents** (`openclaw agent --agent dorothy` /
   `nickfury`) using `OPENCLAW_GATEWAY_TOKEN`. Dorothy's judgment and memory
   live in the laptop's agent runtime.

## What's already cloud-side

Supabase project **em-grant** (`idebrliatulbriuitmuy`) is not just a mirror —
it's a designed multi-tenant SaaS schema (orgs, members, subscriptions,
stripe_events, feature_flags, org-docs storage, voice profiles) with live data:
`grants_raw` ~1,017 (scraper firehose), `org_grant_engagements` ~874 (scoring),
`discovery_runs_v2` ~221, `application_questions` ~275. The scrapers already
mirror into it (`supabase_firehose.py`, non-fatal), and pipeline v2 already
writes assessments there. `saas/apps/web` in this repo is an early Next.js
scaffold of the intended cloud app (barely started; localhost Supabase only).

## Phase A — cloud read view (~1 session)  ← STARTED 2026-08-09

Static frontend (the existing Vite SPA, adapted) on Cloudflare Pages, behind
the same Access gate, reading Supabase. Read-only: dashboard, pipeline, grant
detail, lessons. Write/AI actions disabled with a "use the live app" notice.

Mechanics chosen:
- **Read model**: dedicated `app_*` mirror tables in Supabase matching the
  SQLite shapes (NOT the SaaS schema — reshaping into engagements is Phase B).
  RLS on, no anon policies.
- **API**: Supabase Edge Function `grant-view-api` (service role stays inside
  Supabase; no secrets handled locally) with a minted view token baked only
  into the Access-gated bundle + function. This repo is PUBLIC — the token
  lives in a gitignored `.env`, never committed.
- **Snapshot + sync**: initial load from the hourly `openclaw-backup` copy of
  `grants.db`; `sync_grants_to_supabase.py` (this repo) installed as a laptop
  cron keeps it fresh. Laptop off = data freezes with a visible "as of" stamp,
  but the view stays up.
- **DNS**: grants.elevatedmovements.com keeps pointing at the tunnel until the
  cloud view reaches parity; then swapping is a one-line DNS change.

## Phase B — writes + retiring SQLite (~1–2 sessions)

- Status changes / notes / application edits write to Supabase (RLS, org_id).
- Scrapers flip from "mirror to Supabase" to "Supabase primary"; SQLite
  becomes cache or is dropped. Reconcile status vocabulary between the local
  `grants` table and `org_grant_engagements` (pipeline v2 already writes the
  latter — collision semantics must be decided here, not in Phase A).
- Auth: keep Cloudflare Access unless/until outside users matter, then
  Supabase Auth (the orgs/subscriptions schema anticipates this).

## Phase C — the AI features (the hard 20%)

Options, in order of preference:
- **(a) Job queue** — cloud app inserts a job row; a small laptop worker runs
  the OpenClaw agent and writes results back. Laptop off ⇒ generation queues
  instead of breaking. Dorothy keeps her memory. Recommended.
- **(b) Direct Anthropic API** in an edge function — fully cloud, but loses
  Dorothy's agent context unless ported.
- **(c) Move the OpenClaw runtime to a cloud VM** — heaviest lift.

Scrapers can stay on the laptop harmlessly once Supabase is primary (a dark
laptop delays discovery by a day; most scrape weekly anyway).

## Decision log

- 2026-08-09: Tunnel deploy shipped (grants.elevatedmovements.com live,
  Access-gated). Phase A started same day. Phases B/C: decide after Phase A's
  parity report shows how far the SQLite↔Supabase gap really goes.
