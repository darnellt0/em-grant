#!/bin/bash
# deploy.sh — Full one-shot deploy to Supabase + Vercel
# Run after completing the 4 setup steps in DEPLOY.md

set -e

# ── Validate required env vars ─────────────────────────────────────────────────
required_vars=(
  SUPABASE_ACCESS_TOKEN
  SUPABASE_PROJECT_REF
  SUPABASE_DB_PASSWORD
  ANTHROPIC_API_KEY
)

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "ERROR: $var is not set. See DEPLOY.md for setup steps."
    exit 1
  fi
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "em-grant SaaS — Deployment"
echo "Project: $SUPABASE_PROJECT_REF"
echo "=========================================="
echo ""

# ── Step 1: Link Supabase project ─────────────────────────────────────────────
echo "1/5  Linking Supabase project..."
supabase link --project-ref "$SUPABASE_PROJECT_REF" --password "$SUPABASE_DB_PASSWORD"
echo "     Linked."

# ── Step 2: Push database schema ──────────────────────────────────────────────
echo "2/5  Pushing database schema..."
supabase db push --include-all
echo "     Schema pushed."

# ── Step 3: Set edge function secrets ─────────────────────────────────────────
echo "3/5  Setting edge function secrets..."

SUPABASE_URL="https://${SUPABASE_PROJECT_REF}.supabase.co"
SUPABASE_ANON_KEY=$(supabase status --output json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('anon_key',''))" 2>/dev/null || echo "")
SUPABASE_SERVICE_ROLE_KEY=$(supabase status --output json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('service_role_key',''))" 2>/dev/null || echo "")

# Fetch keys from Supabase API if not got from status
if [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "     Fetching project API keys..."
  KEYS_JSON=$(curl -s "https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/api-keys" \
    -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}")
  SUPABASE_ANON_KEY=$(echo "$KEYS_JSON" | python3 -c "import sys,json; keys=json.load(sys.stdin); print(next((k['api_key'] for k in keys if k['name']=='anon'), ''))" 2>/dev/null || echo "")
  SUPABASE_SERVICE_ROLE_KEY=$(echo "$KEYS_JSON" | python3 -c "import sys,json; keys=json.load(sys.stdin); print(next((k['api_key'] for k in keys if k['name']=='service_role'), ''))" 2>/dev/null || echo "")
fi

if [ -z "$SUPABASE_ANON_KEY" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "     ERROR: Could not retrieve Supabase API keys. Set them manually:"
  echo "       supabase secrets set SUPABASE_URL=https://${SUPABASE_PROJECT_REF}.supabase.co"
  echo "       supabase secrets set SUPABASE_ANON_KEY=<from dashboard>"
  echo "       supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<from dashboard>"
  exit 1
fi

supabase secrets set \
  SUPABASE_URL="$SUPABASE_URL" \
  SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
  SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY"

# Optional Stripe secrets (skip if not set)
if [ -n "$STRIPE_SECRET_KEY" ]; then
  supabase secrets set \
    STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY" \
    STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET:-placeholder}" \
    STRIPE_PRICE_ID_PRO="${STRIPE_PRICE_ID_PRO:-placeholder}" \
    STRIPE_PRICE_ID_TEAM="${STRIPE_PRICE_ID_TEAM:-placeholder}" \
    STRIPE_SUCCESS_URL="${STRIPE_SUCCESS_URL:-${SUPABASE_URL}}" \
    STRIPE_CANCEL_URL="${STRIPE_CANCEL_URL:-${SUPABASE_URL}}"
fi

echo "     Secrets set."

# ── Step 4: Deploy edge functions ──────────────────────────────────────────────
echo "4/5  Deploying edge functions..."
for fn in discover assess pitch; do
  echo "     Deploying $fn..."
  supabase functions deploy "$fn" --no-verify-jwt
done
echo "     Edge functions deployed."

# ── Step 5: Deploy web app to Vercel ──────────────────────────────────────────
echo "5/5  Deploying web app to Vercel..."

if ! command -v vercel &>/dev/null; then
  npm install -g vercel --quiet
fi

cd apps/web

cat > .env.production.local <<ENV
NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
ENV

vercel --prod --yes \
  --env NEXT_PUBLIC_SUPABASE_URL="${SUPABASE_URL}" \
  --env NEXT_PUBLIC_SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY}"

echo ""
echo "=========================================="
echo "Deployment complete."
echo "Supabase: ${SUPABASE_URL}"
echo "=========================================="
