import { requireOrgIdForUser, requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export default async function RunsPage() {
  const user = await requireUser();
  const orgId = await requireOrgIdForUser(user.id);
  const supabase = createSupabaseServerClient();

  const { data: runs, error } = await supabase
    .from("runs")
    .select("id,run_type,status,created_at,started_at,finished_at,error")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return <p>Failed to load runs: {error.message}</p>;
  }

  const runIds = (runs ?? []).map((run) => run.id);
  let costByRunId = new Map<string, number>();

  if (runIds.length > 0) {
    const { data: spendLogs, error: spendError } = await supabase
      .from("llm_spend_logs")
      .select("run_id,cost_usd")
      .eq("org_id", orgId)
      .in("run_id", runIds);

    if (spendError) {
      return <p>Failed to load run costs: {spendError.message}</p>;
    }

    for (const row of spendLogs ?? []) {
      if (!row.run_id) continue;
      const existing = costByRunId.get(row.run_id) ?? 0;
      costByRunId.set(row.run_id, existing + Number(row.cost_usd ?? 0));
    }
  }

  return (
    <section>
      <h2>Runs</h2>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Type</th>
            <th>Status</th>
            <th>Created</th>
            <th>Started</th>
            <th>Finished</th>
            <th>Cost USD</th>
            <th>Error</th>
          </tr>
        </thead>
        <tbody>
          {(runs ?? []).map((run) => (
            <tr key={run.id}>
              <td>{run.id}</td>
              <td>{run.run_type}</td>
              <td>{run.status}</td>
              <td>{run.created_at ? new Date(run.created_at).toLocaleString() : "-"}</td>
              <td>{run.started_at ? new Date(run.started_at).toLocaleString() : "-"}</td>
              <td>{run.finished_at ? new Date(run.finished_at).toLocaleString() : "-"}</td>
              <td>${(costByRunId.get(run.id) ?? 0).toFixed(4)}</td>
              <td>{run.error ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
