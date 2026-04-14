import { requireOrgIdForUser, requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { BillingActions } from "./BillingActions";

type Plan = "free" | "trial" | "pro" | "team";

const PLAN_LIMITS: Record<Plan, {
  monthly_discover_runs: number;
  monthly_assess_runs: number;
  monthly_pitch_runs: number;
  monthly_candidates_inserted: number;
  monthly_llm_cost_usd: number;
}> = {
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

function getEffectivePlan(subscription: {
  plan: string | null;
  status: string | null;
  current_period_end: string | null;
} | null): {
  plan: Plan;
  billingStatus: "active" | "free_fallback";
} {
  if (!subscription) {
    return { plan: "free", billingStatus: "free_fallback" };
  }

  const rawPlan = subscription.plan ?? "free";
  const plan = (["free", "trial", "pro", "team"].includes(rawPlan) ? rawPlan : "free") as Plan;

  if (subscription.status !== "active") {
    return { plan: "free", billingStatus: "free_fallback" };
  }

  if (subscription.current_period_end) {
    const end = new Date(subscription.current_period_end);
    if (Number.isFinite(end.getTime()) && end.getTime() <= Date.now()) {
      return { plan: "free", billingStatus: "free_fallback" };
    }
  }

  return { plan, billingStatus: "active" };
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export default async function BillingPage() {
  const user = await requireUser();
  const orgId = await requireOrgIdForUser(user.id);
  const supabase = createSupabaseServerClient();

  const [{ data: subscription, error: subscriptionError }, { data: usage, error: usageError }] = await Promise.all([
    supabase
      .from("org_subscriptions")
      .select("plan,status,current_period_start,current_period_end,stripe_customer_id,stripe_subscription_id")
      .eq("org_id", orgId)
      .maybeSingle(),
    supabase
      .from("org_usage_monthly")
      .select(
        "period_start,period_end,discover_runs_count,assess_runs_count,pitch_runs_count,candidates_inserted_count,llm_cost_usd_total",
      )
      .eq("org_id", orgId)
      .order("period_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (subscriptionError) {
    return <p>Failed to load billing: {subscriptionError.message}</p>;
  }
  if (usageError) {
    return <p>Failed to load usage: {usageError.message}</p>;
  }

  const { plan, billingStatus } = getEffectivePlan(subscription);
  const limits = PLAN_LIMITS[plan];

  const usedDiscover = usage?.discover_runs_count ?? 0;
  const usedAssess = usage?.assess_runs_count ?? 0;
  const usedPitch = usage?.pitch_runs_count ?? 0;
  const usedCandidates = usage?.candidates_inserted_count ?? 0;
  const usedCost = Number(usage?.llm_cost_usd_total ?? 0);

  return (
    <section>
      <h2>Billing</h2>

      <div className="card">
        <p>
          <strong>Current Plan:</strong> {plan}
        </p>
        <p>
          <strong>Subscription Status:</strong> {subscription?.status ?? "free_fallback"}
        </p>
        <p>
          <strong>Billing Mode:</strong> {billingStatus}
        </p>
        <p>
          <strong>Period Start:</strong> {formatDateTime(usage?.period_start ?? subscription?.current_period_start)}
        </p>
        <p>
          <strong>Period End:</strong> {formatDateTime(usage?.period_end ?? subscription?.current_period_end)}
        </p>
      </div>

      <div className="card">
        <h3>Usage This Period</h3>
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Used</th>
              <th>Limit</th>
              <th>Remaining</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Discover Runs</td>
              <td>{usedDiscover}</td>
              <td>{limits.monthly_discover_runs}</td>
              <td>{Math.max(limits.monthly_discover_runs - usedDiscover, 0)}</td>
            </tr>
            <tr>
              <td>Assess Runs</td>
              <td>{usedAssess}</td>
              <td>{limits.monthly_assess_runs}</td>
              <td>{Math.max(limits.monthly_assess_runs - usedAssess, 0)}</td>
            </tr>
            <tr>
              <td>Pitch Runs</td>
              <td>{usedPitch}</td>
              <td>{limits.monthly_pitch_runs}</td>
              <td>{Math.max(limits.monthly_pitch_runs - usedPitch, 0)}</td>
            </tr>
            <tr>
              <td>Candidates Inserted</td>
              <td>{usedCandidates}</td>
              <td>{limits.monthly_candidates_inserted}</td>
              <td>{Math.max(limits.monthly_candidates_inserted - usedCandidates, 0)}</td>
            </tr>
            <tr>
              <td>LLM Cost (USD)</td>
              <td>${usedCost.toFixed(4)}</td>
              <td>${limits.monthly_llm_cost_usd.toFixed(2)}</td>
              <td>${Math.max(limits.monthly_llm_cost_usd - usedCost, 0).toFixed(4)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <BillingActions
        orgId={orgId}
        currentPlan={plan}
        hasStripeCustomer={Boolean(subscription?.stripe_customer_id)}
      />
    </section>
  );
}
