import { SubscriptionUpsertPayload } from "./stripe";

type SupabaseLike = {
  from: (table: string) => {
    upsert: (values: unknown, options?: Record<string, unknown>) => {
      select: (columns?: string) => {
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
      };
    };
    insert: (values: Record<string, unknown> | Record<string, unknown>[]) => Promise<{ error: { message: string } | null }>;
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
    };
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
      };
    };
  };
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: Record<string, unknown> | Record<string, unknown>[] | null; error: { message: string } | null }>;
};

export async function upsertOrgSubscription(sb: SupabaseLike, payload: SubscriptionUpsertPayload): Promise<void> {
  const { error } = await sb
    .from("org_subscriptions")
    .upsert(payload, { onConflict: "org_id" })
    .select("org_id")
    .maybeSingle();

  if (error) throw new Error(`Failed to upsert org subscription: ${error.message}`);
}

export async function ensureUsageRowForOrg(sb: SupabaseLike, orgId: string): Promise<void> {
  const { error } = await sb.rpc("ensure_usage_row", { _org_id: orgId });
  if (error) throw new Error(`Failed to ensure usage row: ${error.message}`);
}

export async function hasStripeEventBeenProcessed(sb: SupabaseLike, stripeEventId: string): Promise<boolean> {
  const { data, error } = await sb
    .from("stripe_events")
    .select("stripe_event_id,processed")
    .eq("stripe_event_id", stripeEventId)
    .maybeSingle();
  if (error) throw new Error(`Failed checking stripe event idempotency: ${error.message}`);
  return Boolean(data?.processed);
}

export async function storeStripeEvent(
  sb: SupabaseLike,
  stripeEventId: string,
  type: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const { error } = await sb
    .from("stripe_events")
    .upsert(
      {
        stripe_event_id: stripeEventId,
        type,
        payload,
        processed: false,
      },
      { onConflict: "stripe_event_id" },
    )
    .select("stripe_event_id")
    .maybeSingle();
  if (error) throw new Error(`Failed storing stripe event: ${error.message}`);
}

export async function markStripeEventProcessed(sb: SupabaseLike, stripeEventId: string): Promise<void> {
  const { error } = await sb
    .from("stripe_events")
    .update({ processed: true })
    .eq("stripe_event_id", stripeEventId);
  if (error) throw new Error(`Failed marking stripe event processed: ${error.message}`);
}
