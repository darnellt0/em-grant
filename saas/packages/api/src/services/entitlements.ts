export type OrgPlan = "free" | "trial" | "pro" | "team";
export type EntitlementEndpoint = "discover" | "assess" | "pitch";

export interface PlanLimits {
  monthly_discover_runs: number;
  monthly_assess_runs: number;
  monthly_pitch_runs: number;
  monthly_candidates_inserted: number;
  monthly_llm_cost_usd: number;
}

export interface OrgSubscription {
  org_id: string;
  plan: OrgPlan;
  status: string;
  current_period_start?: string | null;
  current_period_end?: string | null;
}

export interface OrgEntitlements {
  subscription: OrgSubscription | null;
  effectivePlan: OrgPlan;
  billingStatus: "active" | "free_fallback";
  limits: PlanLimits;
}

type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{
          data: OrgSubscription | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
};

export const PLAN_LIMITS: Record<OrgPlan, PlanLimits> = {
  free: {
    monthly_discover_runs: 10,
    monthly_assess_runs: 0,
    monthly_pitch_runs: 0,
    monthly_candidates_inserted: 100,
    monthly_llm_cost_usd: 5.0,
  },
  trial: {
    monthly_discover_runs: 50,
    monthly_assess_runs: 30,
    monthly_pitch_runs: 20,
    monthly_candidates_inserted: 500,
    monthly_llm_cost_usd: 25.0,
  },
  pro: {
    monthly_discover_runs: 500,
    monthly_assess_runs: 300,
    monthly_pitch_runs: 200,
    monthly_candidates_inserted: 5000,
    monthly_llm_cost_usd: 250.0,
  },
  team: {
    monthly_discover_runs: 2000,
    monthly_assess_runs: 1200,
    monthly_pitch_runs: 800,
    monthly_candidates_inserted: 20000,
    monthly_llm_cost_usd: 1000.0,
  },
};

const endpointPlans: Record<EntitlementEndpoint, OrgPlan[]> = {
  discover: ["free", "trial", "pro", "team"],
  assess: ["trial", "pro", "team"],
  pitch: ["trial", "pro", "team"],
};

export function getPlanLimits(plan: OrgPlan): PlanLimits {
  return PLAN_LIMITS[plan];
}

export function getRequiredPlan(endpoint: EntitlementEndpoint): OrgPlan {
  if (endpoint === "assess") return "trial";
  if (endpoint === "pitch") return "trial";
  return "free";
}

export function getEffectivePlanFromSubscription(
  subscription: OrgSubscription | null,
  now = new Date(),
): { plan: OrgPlan; billingStatus: "active" | "free_fallback" } {
  if (!subscription) return { plan: "free", billingStatus: "free_fallback" };
  if (subscription.status !== "active") return { plan: "free", billingStatus: "free_fallback" };

  if (subscription.current_period_end) {
    const end = new Date(subscription.current_period_end);
    if (Number.isFinite(end.getTime()) && end.getTime() <= now.getTime()) {
      return { plan: "free", billingStatus: "free_fallback" };
    }
  }

  const plan = subscription.plan;
  if (!["free", "trial", "pro", "team"].includes(plan)) {
    return { plan: "free", billingStatus: "free_fallback" };
  }

  return { plan, billingStatus: "active" };
}

export async function getOrgSubscription(sb: SupabaseLike, orgId: string): Promise<OrgSubscription | null> {
  const { data, error } = await sb
    .from("org_subscriptions")
    .select("org_id,plan,status,current_period_start,current_period_end")
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load org subscription: ${error.message}`);
  }

  return data;
}

export async function getOrgEntitlements(sb: SupabaseLike, orgId: string): Promise<OrgEntitlements> {
  const subscription = await getOrgSubscription(sb, orgId);
  const { plan, billingStatus } = getEffectivePlanFromSubscription(subscription);
  return {
    subscription,
    effectivePlan: plan,
    billingStatus,
    limits: getPlanLimits(plan),
  };
}

export async function getOrgPlan(sb: SupabaseLike, orgId: string): Promise<OrgPlan> {
  const ent = await getOrgEntitlements(sb, orgId);
  return ent.effectivePlan;
}

export function isEntitled(plan: OrgPlan, endpoint: EntitlementEndpoint): boolean {
  return endpointPlans[endpoint].includes(plan);
}

export function assertEntitled(plan: OrgPlan, endpoint: EntitlementEndpoint): void {
  if (isEntitled(plan, endpoint)) return;
  const required = getRequiredPlan(endpoint);
  const err = new Error(`Plan "${plan}" is not entitled for endpoint "${endpoint}"`);
  (err as Error & { code: string; plan: OrgPlan; required: OrgPlan }).code = "not_entitled";
  (err as Error & { code: string; plan: OrgPlan; required: OrgPlan }).plan = plan;
  (err as Error & { code: string; plan: OrgPlan; required: OrgPlan }).required = required;
  throw err;
}
