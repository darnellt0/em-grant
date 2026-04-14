import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@16.12.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_SUCCESS_URL = Deno.env.get("STRIPE_SUCCESS_URL")!;

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
  return { admin };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json(200, { ok: true });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const body = await req.json();
    const orgId = String(body.org_id ?? "").trim();
    if (!orgId) return json(400, { error: "org_id is required" });

    const { admin } = await requireUserAndOrgMember(req.headers.get("Authorization"), orgId);
    const { data: sub, error: subErr } = await admin
      .from("org_subscriptions")
      .select("stripe_customer_id")
      .eq("org_id", orgId)
      .maybeSingle();
    if (subErr) throw new Error(subErr.message);
    if (!sub?.stripe_customer_id) {
      return json(400, { error: "No Stripe customer attached to this org" });
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id as string,
      return_url: STRIPE_SUCCESS_URL,
    });

    return json(200, { url: portal.url });
  } catch (error) {
    return json(500, {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
