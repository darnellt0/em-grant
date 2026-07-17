import { requireOrgIdForUser, requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export default async function UsagePage() {
  const user = await requireUser();
  const orgId = await requireOrgIdForUser(user.id);
  const supabase = createSupabaseServerClient();

  const [{ data: usage, error: usageError }, { data: subscription, error: subError }] = await Promise.all([
    supabase
      .from("org_usage_monthly")
      .select(
        "period_start,period_end,discover_runs_count,assess_runs_count,pitch_runs_count,candidates_inserted_count,llm_cost_usd_total,updated_at",
      )
      .eq("org_id", orgId)
      .order("period_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("org_subscriptions")
      .select("plan,status,current_period_start,current_period_end")
      .eq("org_id", orgId)
      .maybeSingle(),
  ]);

  if (usageError) {
    return <p>Failed to load usage: {usageError.message}</p>;
  }
  if (subError) {
    return <p>Failed to load subscription: {subError.message}</p>;
  }

  return (
    <section>
      <h2>Usage</h2>
      <div className="card">
        <p>
          <strong>Plan:</strong> {subscription?.plan ?? "free"}
        </p>
        <p>
          <strong>Status:</strong> {subscription?.status ?? "free_fallback"}
        </p>
        <p>
          <strong>Period Start:</strong>{" "}
          {formatDateTime(usage?.period_start ?? subscription?.current_period_start)}
        </p>
        <p>
          <strong>Period End:</strong> {formatDateTime(usage?.period_end ?? subscription?.current_period_end)}
        </p>
        <p>
          <strong>Last Updated:</strong> {formatDateTime(usage?.updated_at)}
        </p>
      </div>

      <table>
        <thead>
          <tr>
            <th>Metric</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Discover Runs</td>
            <td>{usage?.discover_runs_count ?? 0}</td>
          </tr>
          <tr>
            <td>Assess Runs</td>
            <td>{usage?.assess_runs_count ?? 0}</td>
          </tr>
          <tr>
            <td>Pitch Runs</td>
            <td>{usage?.pitch_runs_count ?? 0}</td>
          </tr>
          <tr>
            <td>Candidates Inserted</td>
            <td>{usage?.candidates_inserted_count ?? 0}</td>
          </tr>
          <tr>
            <td>LLM Cost (USD)</td>
            <td>${Number(usage?.llm_cost_usd_total ?? 0).toFixed(4)}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
