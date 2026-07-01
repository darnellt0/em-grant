# EM Grant — grant discovery & application platform

Grant discovery, assessment, and pitch drafting for Elevated Movements.

## What's in this repo

| Path | Status | Description |
|---|---|---|
| `saas/` | **Primary — active** | Next.js + Supabase + Stripe web app. Grants.gov API search filtered and scored by Claude, org profiles, team invites, usage quotas, billing. See `saas/README.md`. |
| `Module1..16_*.js`, `checkCost.js` | Legacy (superseded) | Google Apps Script grant tracker that lives in a Google Sheet. Superseded by the SaaS app; kept for reference. Deployed via `clasp` (`.clasp.json`). |
| `legacy/python-scraper/` | Retired | Original Selenium scraper for grants.gov. Broken by the grants.gov redesign; replaced by the API-based `discover` edge function. |

## Production

The live backend is the Supabase project **em-grant** (`idebrliatulbriuitmuy`).
Note that the live edge functions and database migrations may be ahead of this
repo (they have also been developed with other tooling) — check what is
deployed before overwriting `discover`, `assess`, or `pitch`.
