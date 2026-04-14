# EM Grant SaaS Layer (Option B)

This folder is the Supabase + Edge Functions + Next.js SaaS layer. Apps Script modules (`Module1..16`) remain intact.

## 1) Prerequisites

1. Node.js 18+
2. Supabase CLI
3. Docker Desktop (for local Supabase)
4. Stripe CLI (`stripe --version`)

## 2) Start Supabase Local

```bash
cd saas
supabase init
supabase start
```

## 3) Apply SQL (schema then RLS)

```bash
supabase db execute --local --file ./supabase/schema.sql
supabase db execute --local --file ./supabase/rls.sql
```

## 4) Auth Provider Setup

In Supabase Studio:

1. `Authentication -> Providers`
2. Enable Email Magic Link and Google OAuth
3. Add local redirect URL: `http://localhost:3000/dashboard/grants`

## 5) Environment Variables

Get local keys:

```bash
supabase status
```

### Web app: `/saas/apps/web/.env.local`

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local-anon-key>
```

### Edge functions: `/saas/supabase/functions/.env.local`

```bash
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<local-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<local-service-role-key>

STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_PRO=price_...
STRIPE_PRICE_ID_TEAM=price_...
STRIPE_PRICE_ID_TRIAL=price_...   # optional
STRIPE_SUCCESS_URL=http://localhost:3000/dashboard/settings/billing
STRIPE_CANCEL_URL=http://localhost:3000/dashboard/settings/billing
```

Hosted secrets:

```bash
supabase secrets set SUPABASE_URL=<project-url>
supabase secrets set SUPABASE_ANON_KEY=<anon-key>
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
supabase secrets set STRIPE_SECRET_KEY=<stripe-secret-key>
supabase secrets set STRIPE_WEBHOOK_SECRET=<stripe-webhook-secret>
supabase secrets set STRIPE_PRICE_ID_PRO=<price-id>
supabase secrets set STRIPE_PRICE_ID_TEAM=<price-id>
supabase secrets set STRIPE_PRICE_ID_TRIAL=<price-id>
supabase secrets set STRIPE_SUCCESS_URL=<success-url>
supabase secrets set STRIPE_CANCEL_URL=<cancel-url>
```

## 6) Run Web App

```bash
cd saas
npm install
npm run web:dev
```

Open:

1. `http://localhost:3000/login`
2. `http://localhost:3000/dashboard/grants`
3. `http://localhost:3000/dashboard/settings/billing`
4. `http://localhost:3000/dashboard/settings/usage`

## 7) Serve Edge Functions Locally

```bash
cd saas
supabase functions serve discover --env-file ./supabase/functions/.env.local
supabase functions serve assess --env-file ./supabase/functions/.env.local
supabase functions serve pitch --env-file ./supabase/functions/.env.local
supabase functions serve stripe_checkout --env-file ./supabase/functions/.env.local
supabase functions serve stripe_portal --env-file ./supabase/functions/.env.local
supabase functions serve stripe_webhook --env-file ./supabase/functions/.env.local
```

Deploy:

```bash
supabase functions deploy discover
supabase functions deploy assess
supabase functions deploy pitch
supabase functions deploy stripe_checkout
supabase functions deploy stripe_portal
supabase functions deploy stripe_webhook
```

## 8) Stripe Webhook Local Testing

Forward Stripe events to local edge webhook:

```bash
stripe listen --forward-to http://127.0.0.1:54321/functions/v1/stripe_webhook
```

Copy the printed webhook secret (`whsec_...`) into `STRIPE_WEBHOOK_SECRET`.

Trigger test events:

```bash
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger invoice.payment_failed
```

## 9) Checkout + Portal Test (curl)

Use a valid user JWT (`USER_ACCESS_TOKEN`) and org id (`ORG_ID`).

Create checkout:

```bash
curl -X POST "http://127.0.0.1:54321/functions/v1/stripe_checkout" \
  -H "Authorization: Bearer $USER_ACCESS_TOKEN" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"org_id":"<ORG_ID>","plan":"pro"}'
```

Open portal:

```bash
curl -X POST "http://127.0.0.1:54321/functions/v1/stripe_portal" \
  -H "Authorization: Bearer $USER_ACCESS_TOKEN" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"org_id":"<ORG_ID>"}'
```

## 10) Limit Enforcement Test

The edge functions call `public.reserve_usage` before expensive work.

Quick test flow:

1. Ensure org is on `free` plan in `org_subscriptions`.
2. Seed usage near limit in SQL editor:

```sql
select public.ensure_usage_row('<ORG_ID>'::uuid);

update public.org_usage_monthly
set discover_runs_count = 9,
    llm_cost_usd_total = 4.90
where org_id = '<ORG_ID>'::uuid
  and period_start = (
    select period_start
    from public.get_billing_period_for_org('<ORG_ID>'::uuid, now())
    limit 1
  );
```

3. Run `discover` repeatedly until it returns quota error.
4. Confirm response status and payload:
   - `403` + `{ "error":"not_entitled", ... }` for plan restrictions.
   - `403` + `message: "billing_inactive_treated_as_free"` for paid-only endpoints when billing is inactive.
   - `429` + `{ "error":"quota_exceeded", "metric", "limit", "used", "remaining" }` for quota limits.
5. Confirm rows updated:
   - `runs`
   - `llm_spend_logs`
   - `org_usage_monthly`

Example discover call:

```bash
curl -X POST "http://127.0.0.1:54321/functions/v1/discover" \
  -H "Authorization: Bearer $USER_ACCESS_TOKEN" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"org_id":"<ORG_ID>","query":"women of color leadership grants"}'
```

## 11) RLS Verification

1. Create org A and org B, each with different members.
2. Login as org A user and confirm only org A data appears in dashboard pages.
3. Query REST with org A token:

```bash
curl "http://127.0.0.1:54321/rest/v1/grants?select=id,org_id,grant_name" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $USER_A_TOKEN"
```

4. Repeat as org B user and verify org A rows are not returned.

## Notes

1. Frontend only uses anon key + user session token.
2. Stripe secret keys remain server/edge-only.
3. LLM integration remains stubbed, but run tracking, spend logging, and quota enforcement are active.
