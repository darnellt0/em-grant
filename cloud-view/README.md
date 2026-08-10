# EM Grants — Cloud View (Phase A)

Read-only cloud mirror of the canonical Grant App (which runs on the OpenClaw
laptop and owns all writes + AI actions). See `../MIGRATION_SPEC.md` for the
full plan. **This repo is public — never commit `.env`.**

## Architecture

```
laptop SQLite (source of truth)
  └─ sync_grants_to_supabase.py  (laptop cron, hourly)
       └─ Supabase app_* tables  (em-grant project, RLS: service-role only)
            └─ grant-view-api    (Supabase Edge Function, X-View-Token + anon JWT)
                 └─ this SPA     (Cloudflare Pages "em-grants", behind Access)
```

- Same UI as the live app; write/AI buttons are disabled ("Read-only cloud view").
- Nav shows "data synced N min ago" from `app_meta.synced_at`.
- Laptop off ⇒ data freezes at last sync, view stays up.

## Deploy / update

1. `.env` (copy from `.env.example`): anon key from Supabase dashboard →
   em-grant → Settings → API Keys; view token must match `VIEW_TOKEN` in the
   `grant-view-api` edge function.
2. `powershell -File deploy.ps1` — builds and pushes to Cloudflare Pages.

## Keeping data fresh (laptop cron)

The sync script lives at `cloud-view/sync_grants_to_supabase.py` and must run
ON the laptop (it reads the local DB + the existing Supabase service creds at
`~/.openclaw/credentials/em-grant-supabase.env`). Install:

```
scp "cloud-view/sync_grants_to_supabase.py" evergreen@100.76.72.100:/home/evergreen/.openclaw/workspace/grant-app/
ssh evergreen@100.76.72.100 '(crontab -l; echo "17 * * * * /usr/bin/python3 /home/evergreen/.openclaw/workspace/grant-app/sync_grants_to_supabase.py >> /tmp/grant-cloud-sync.log 2>&1") | crontab -'
```

If the laptop schema gains a column, add it to `app_grants` in Supabase
(alter table) or the sync 400s with a PGRST204 "column not found" — the sync
error message names the column.

## Token rotation

Redeploy the `grant-view-api` edge function with a new `VIEW_TOKEN`, put the
same value in `.env`, run `deploy.ps1`. Rotate if the Pages site was ever
exposed without Access.

## DNS swap (end of Phase A)

When this view is trusted, point `grants.elevatedmovements.com` at Pages
(add it as a custom domain on the em-grants project and remove the tunnel
route). Until then the domain stays on the laptop tunnel.
