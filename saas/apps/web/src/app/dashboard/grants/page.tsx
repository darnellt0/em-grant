import Link from "next/link";
import { requireOrgIdForUser, requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { GrantRunActions } from "../GrantRunActions";

export default async function GrantsPage() {
  const user = await requireUser();
  const orgId = await requireOrgIdForUser(user.id);
  const supabase = createSupabaseServerClient();

  const [{ data: grants, error }, { data: profile }] = await Promise.all([
    supabase
      .from("grants")
      .select("id,grant_name,sponsor_org,status,deadline_text,priority_score,overall_strategic_value,updated_at")
      .eq("org_id", orgId)
      .order("overall_strategic_value", { ascending: false, nullsFirst: false })
      .limit(100),
    supabase.from("org_profiles").select("org_id").eq("org_id", orgId).maybeSingle(),
  ]);

  if (error) {
    return <p>Failed to load grants: {error.message}</p>;
  }

  return (
    <section>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Grants</h2>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Actions</h3>
        <GrantRunActions orgId={orgId} hasProfile={!!profile} />
      </div>

      {(grants ?? []).length === 0 ? (
        <p style={{ color: "#555" }}>
          No grants yet. Run discovery to find opportunities matched to your organization profile.
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Sponsor</th>
              <th>Status</th>
              <th>Deadline</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {(grants ?? []).map((grant) => (
              <tr key={grant.id}>
                <td>
                  <Link href={`/dashboard/grants/${grant.id}`}>{grant.grant_name}</Link>
                </td>
                <td>{grant.sponsor_org ?? "-"}</td>
                <td>{grant.status}</td>
                <td>{grant.deadline_text ?? "-"}</td>
                <td>{grant.overall_strategic_value ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
