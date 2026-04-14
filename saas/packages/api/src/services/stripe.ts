import { OrgPlan } from "./entitlements";

export interface StripePriceMap {
  pro: string;
  team: string;
  trial?: string;
}

export interface SubscriptionUpsertPayload {
  org_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: OrgPlan;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
}

export function planFromPriceId(priceId: string | null | undefined, map: StripePriceMap): OrgPlan {
  if (!priceId) return "free";
  if (priceId === map.team) return "team";
  if (priceId === map.pro) return "pro";
  if (map.trial && priceId === map.trial) return "trial";
  return "free";
}

export function toIsoFromUnixSeconds(value: number | null | undefined): string | null {
  if (!value || Number.isNaN(value)) return null;
  return new Date(value * 1000).toISOString();
}

export function normalizeStripeSubscriptionStatus(status: string | null | undefined): string {
  return (status ?? "incomplete").toLowerCase();
}

export function buildSubscriptionUpsertPayload(input: {
  orgId: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  plan: OrgPlan;
  status: string;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
}): SubscriptionUpsertPayload {
  return {
    org_id: input.orgId,
    stripe_customer_id: input.stripeCustomerId ?? null,
    stripe_subscription_id: input.stripeSubscriptionId ?? null,
    plan: input.plan,
    status: normalizeStripeSubscriptionStatus(input.status),
    current_period_start: input.currentPeriodStart ?? null,
    current_period_end: input.currentPeriodEnd ?? null,
  };
}
