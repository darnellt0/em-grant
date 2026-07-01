# Retired: Python grants.gov scraper pipeline

**Status: retired (July 2026).** Kept for reference only — do not deploy.

This was the original pipeline: a Selenium scraper for grants.gov
(`grantsgov_scraper_prod.py`) that exported to Excel, uploaded to Google Sheets
(`bridge_upload.py`), and sent Gmail alerts (`email_alerts.py`).

## Why it was retired

1. grants.gov redesigned its search page into a client-rendered Angular app,
   so the scraper's CSS selectors (`.search-result-card` etc.) no longer match
   the served HTML — the scraper returns zero grants.
2. grants.gov offers a free official search API
   (`https://api.grants.gov/v1/api/search2`), which is far more reliable than
   scraping. The SaaS layer's `discover` edge function already uses the
   grants.gov API directly.

## Replacement

The SaaS app under `saas/` is the primary system: grants.gov API search,
Claude-powered filtering/assessment/pitch drafting, multi-tenant auth,
usage quotas, and Stripe billing.
