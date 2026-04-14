import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@16.12.0";
import {
  buildSubscriptionUpsertPayload,
  planFromPriceId,
  toIsoFromUnixSeconds,
} from "../../../packages/api/src/services/stripe.ts";
import {
  ensureUsageRowForOrg,
  hasStripeEventBeenProcessed,
  markStripeEventProcessed,
  storeStripeEvent,
  upsertOrgSubscription,
} from "../../../packages/api/src/services/subscriptions.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const STRIPE_PRICE_ID_PRO = Deno.env.get("STRIPE_PRICE_ID_PRO")!;
const STRIPE_PRICE_ID_TEAM = Deno.env.get("STRIPE_PRICE_ID_TEAM")!;
const STRIPE_PRICE_ID_TRIAL = Deno.env.get("STRIPE_PRICE_ID_TRIAL");

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function json(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

function getPriceMap() {
  return {
    pro: STRIPE_PRICE_ID_PRO,
    team: STRIPE_PRICE_ID_TEAM,
    trial: STRIPE_PRICE_ID_TRIAL ?? undefined,
  };
}

async function orgIdFromCustomerId(customerId?: string | null): Promise<string | null> {
  if (!customerId) return null;

  const { data, error } = await admin
    .from("org_subscriptions")
    .select("org_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (error) throw new Error(`Lookup org by customer failed: ${error.message}`);
  return (data?.org_id as string | undefined) ?? null;
}

async function orgIdFromSubscription(sub: Stripe.Subscription): Promise<string | null> {
  const direct = sub.metadata?.org_id;
  if (direct) return direct;

  if (typeof sub.customer === "string") {
    const fromDb = await orgIdFromCustomerId(sub.customer);
    if (fromDb) return fromDb;
  } else if (sub.customer && "metadata" in sub.customer) {
    const metaOrg = sub.customer.metadata?.org_id;
    if (metaOrg) return metaOrg;
    const fromDb = await orgIdFromCustomerId(sub.customer.id);
    if (fromDb) return fromDb;
  }

  return null;
}

async function upsertFromSubscription(sub: Stripe.Subscription, fallbackOrgId?: string | null) {
  const orgId = fallbackOrgId ?? (await orgIdFromSubscription(sub));
  if (!orgId) throw new Error("Unable to resolve org_id for Stripe subscription event");

  const priceId = sub.items.data[0]?.price?.id;
  const plan = planFromPriceId(priceId, getPriceMap());
  const payload = buildSubscriptionUpsertPayload({
    orgId,
    stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null,
    stripeSubscriptionId: sub.id,
    plan,
    status: sub.status,
    currentPeriodStart: toIsoFromUnixSeconds(sub.current_period_start),
    currentPeriodEnd: toIsoFromUnixSeconds(sub.current_period_end),
  });

  await upsertOrgSubscription(admin as never, payload);
  await ensureUsageRowForOrg(admin as never, orgId);
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const orgId = session.metadata?.org_id ?? null;
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;
  const customerId = typeof session.customer === "string" ? session.customer : null;

  if (!orgId) throw new Error("checkout.session.completed missing metadata.org_id");

  if (subscriptionId) {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    await upsertFromSubscription(sub, orgId);
    return;
  }

  const requested = String(session.metadata?.requested_plan ?? "free");
  const plan = (["free", "trial", "pro", "team"].includes(requested) ? requested : "free") as
    | "free"
    | "trial"
    | "pro"
    | "team";

  const payload = buildSubscriptionUpsertPayload({
    orgId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    plan,
    status: "active",
    currentPeriodStart: null,
    currentPeriodEnd: null,
  });
  await upsertOrgSubscription(admin as never, payload);
  await ensureUsageRowForOrg(admin as never, orgId);
}

async function handleInvoiceEvent(invoice: Stripe.Invoice, eventType: string) {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;

  let sub: Stripe.Subscription | null = null;
  if (subscriptionId) {
    sub = await stripe.subscriptions.retrieve(subscriptionId);
  }

  if (sub) {
    if (eventType === "invoice.payment_failed") {
      const orgId = await orgIdFromSubscription(sub);
      if (!orgId) throw new Error("Unable to resolve org_id for failed invoice");
      const priceId = sub.items.data[0]?.price?.id;
      const plan = planFromPriceId(priceId, getPriceMap());
      const payload = buildSubscriptionUpsertPayload({
        orgId,
        stripeCustomerId: customerId ?? null,
        stripeSubscriptionId: sub.id,
        plan,
        status: "past_due",
        currentPeriodStart: toIsoFromUnixSeconds(sub.current_period_start),
        currentPeriodEnd: toIsoFromUnixSeconds(sub.current_period_end),
      });
      await upsertOrgSubscription(admin as never, payload);
      await ensureUsageRowForOrg(admin as never, orgId);
      return;
    }

    await upsertFromSubscription(sub);
    return;
  }

  if (customerId) {
    const orgId = await orgIdFromCustomerId(customerId);
    if (!orgId) return;
    const payload = buildSubscriptionUpsertPayload({
      orgId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: null,
      plan: "free",
      status: eventType === "invoice.payment_failed" ? "past_due" : "active",
      currentPeriodStart: null,
      currentPeriodEnd: null,
    });
    await upsertOrgSubscription(admin as never, payload);
    await ensureUsageRowForOrg(admin as never, orgId);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json(200, { ok: true });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const signature = req.headers.get("stripe-signature");
    if (!signature) return json(400, { error: "Missing stripe-signature header" });

    const rawBody = await req.text();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
    } catch (error) {
      return json(400, { error: `Signature verification failed: ${(error as Error).message}` });
    }

    const alreadyProcessed = await hasStripeEventBeenProcessed(admin as never, event.id);
    if (alreadyProcessed) {
      return json(200, { ok: true, idempotent: true, stripe_event_id: event.id });
    }

    await storeStripeEvent(admin as never, event.id, event.type, event as unknown as Record<string, unknown>);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(session);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await upsertFromSubscription(sub);
        break;
      }
      case "invoice.payment_succeeded":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoiceEvent(invoice, event.type);
        break;
      }
      default:
        break;
    }

    await markStripeEventProcessed(admin as never, event.id);
    return json(200, { ok: true, stripe_event_id: event.id, type: event.type });
  } catch (error) {
    return json(500, {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
