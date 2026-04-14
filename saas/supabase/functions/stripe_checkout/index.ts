import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@16.12.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_PRICE_ID_PRO = Deno.env.get("STRIPE_PRICE_ID_PRO")!;
const STRIPE_PRICE_ID_TEAM = Deno.env.get("STRIPE_PRICE_ID_TEAM")!;
const STRIPE_PRICE_ID_TRIAL = Deno.env.get("STRIPE_PRICE_ID_TRIAL");
const STRIPE_SUCCESS_URL = Deno.env.get("STRIPE_SUCCESS_URL")!;
const STRIPE_CANCEL_URL = Deno.env.get("STRIPE_CANCEL_URL")!;

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

function json(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

async function requireUserAndOrgMember(authHeader: string | null, orgId: string) {
  if (!authHeader) throw new Error("Missing Authorization header");

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: userData, error: userErr } = await authClient.auth.getUser();
  if (userErr || !userData.user) throw new Error("Unauthorized user");

  const { data: membership, error: membershipErr } = await admin
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (membershipErr || !membership) throw new Error("User is not an org member");
  return { admin, user: userData.user };
}

function resolvePlanInput(plan: string): "pro" | "team" | "trial" {
  if (plan === "pro" || plan === "team" || plan === "trial") return plan;
  throw new Error("plan must be one of: pro, team, trial");
}

function resolveStripePrice(plan: "pro" | "team" | "trial"): { priceId: string; trialDays?: number } {
  if (plan === "pro") return { priceId: STRIPE_PRICE_ID_PRO };
  if (plan === "team") return { priceId: STRIPE_PRICE_ID_TEAM };

  if (STRIPE_PRICE_ID_TRIAL) {
    return { priceId: STRIPE_PRICE_ID_TRIAL };
  }
  return { priceId: STRIPE_PRICE_ID_PRO, trialDays: 14 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json(200, { ok: true });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const body = await req.json();
    const orgId = String(body.org_id ?? "").trim();
    const requestedPlan = resolvePlanInput(String(body.plan ?? "").trim());
    if (!orgId) return json(400, { error: "org_id is required" });

    const { admin, user } = await requireUserAndOrgMember(req.headers.get("Authorization"), orgId);
    const { priceId, trialDays } = resolveStripePrice(requestedPlan);

    const { data: existingSub } = await admin
      .from("org_subscriptions")
      .select("stripe_customer_id")
      .eq("org_id", orgId)
      .maybeSingle();

    let stripeCustomerId = existingSub?.stripe_customer_id as string | null | undefined;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { org_id: orgId },
      });
      stripeCustomerId = customer.id;

      await admin
        .from("org_subscriptions")
        .upsert(
          {
            org_id: orgId,
            stripe_customer_id: stripeCustomerId,
            plan: "free",
            status: "active",
          },
          { onConflict: "org_id" },
        );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      success_url: STRIPE_SUCCESS_URL,
      cancel_url: STRIPE_CANCEL_URL,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        org_id: orgId,
        requested_plan: requestedPlan,
      },
      subscription_data: {
        metadata: {
          org_id: orgId,
          requested_plan: requestedPlan,
        },
        ...(trialDays ? { trial_period_days: trialDays } : {}),
      },
    });

    return json(200, { url: session.url });
  } catch (error) {
    return json(500, {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
