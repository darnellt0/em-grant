import Link from "next/link";
import { requireOrgIdForUser, requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { GrantRunActions } from "../GrantRunActions";

function scoreColor(score: number | null | undefined): string {
  if (score == null) return "#9ca3af";
  if (score >= 80) return "#1a7f4e";
  if (score >= 60) return "#b45309";
  return "#c0392b";
}

function ScoreBadge({ score, suffix = "" }: { score: number | null | undefined; suffix?: string }) {
  const color = scoreColor(score);
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: 999,
      background: color + "18", color, fontWeight: 700, fontSize: 13,
      border: `1px solid ${color}44`,
    }}>
      {score != null ? `${score}${suffix}` : "—"}
    </span>
  );
}

// Friendly labels for the firehose discovery_source slugs so a "ca_grants_portal"
// row reads as "CA Portal" instead of raw snake_case. Anything we don't recognize
// falls back to title-casing the slug.
function sourceLabel(src: string | null | undefined): string {
  if (!src) return "Unknown";
  const map: Record<string, string> = {
    grants_gov: "Grants.gov",
    firehose: "Firehose",
    ca_grants_portal: "CA Portal",
    candid: "Candid",
    foundation_directory: "Foundation Dir",
  };
  if (map[src]) return map[src];
  return src.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function SourceBadge({ source }: { source: string | null | undefined }) {
  return (
    <span style={{
      display: "inline-block", padding: "1px 8px", borderRadius: 999,
      background: "#f3f4f6", color: "#4b5563", fontWeight: 500, fontSize: 11,
      border: "1px solid #e5e7eb",
    }}>
      {sourceLabel(source)}
    </span>
  );
}

export default async function GrantsPage() {
  const user = await requireUser();
  const orgId = await requireOrgIdForUser(user.id);
  const supabase = createSupabaseServerClient();

  const [{ data: grants, error }, { data: profile }] = await Promise.all([
    supabase
      .from("grants")
      .select("id,grant_name,sponsor_org,status,deadline_text,priority_score,overall_strategic_value,community_impact_score,business_match_pct,notes,discovery_source,updated_at")
      .eq("org_id", orgId)
      .order("priority_score", { ascending: false, nullsFirst: false })
      .limit(100),
    supabase.from("org_profiles").select("org_id").eq("org_id", orgId).maybeSingle(),
  ]);

  if (error) {
    return <p>Failed to load grants: {error.message}</p>;
  }

  const allGrants = grants ?? [];
  const topPicks = allGrants.filter(g => g.priority_score != null).slice(0, 3);
  const hasPitched = (g: typeof allGrants[0]) => typeof g.notes === "string" && g.notes.includes("Draft Pitch:");

  return (
    <section>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Grants</h2>
        <span style={{ color: "#6b7280", fontSize: 14 }}>{allGrants.length} total</span>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Actions</h3>
        <GrantRunActions orgId={orgId} hasProfile={!!profile} />
      </div>

      {topPicks.length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0, marginBottom: 14 }}>⭐ Top picks</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {topPicks.map((grant, i) => (
              <Link
                key={grant.id}
                href={`/dashboard/grants/${grant.id}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", borderRadius: 8,
                  border: "1px solid #e5e7eb", background: "#f9fafb",
                  transition: "background 0.1s",
                }}>
                  <span style={{
                    width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                    background: ["#1a7f4e", "#2563eb", "#b45309"][i],
                    color: "#fff", display: "flex", alignItems: "center",
                    justifyContent: "center", fontWeight: 800, fontSize: 13,
                  }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2, color: "#111" }}>
                      {grant.grant_name}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      {grant.sponsor_org ?? "Unknown funder"}
                      {hasPitched(grant) && (
                        <span style={{ marginLeft: 8, color: "#1a7f4e", fontWeight: 600 }}>✓ Pitch drafted</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <ScoreBadge score={grant.priority_score} />
                    {grant.business_match_pct != null && (
                      <ScoreBadge score={grant.business_match_pct} suffix="%" />
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {allGrants.length === 0 ? (
        <p style={{ color: "#555" }}>
          No grants yet. Run discovery to find opportunities matched to your organization profile.
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Grant name</th>
              <th>Sponsor</th>
              <th>Source</th>
              <th>Deadline</th>
              <th>Score</th>
              <th>Match</th>
            </tr>
          </thead>
          <tbody>
            {allGrants.map((grant) => (
              <tr key={grant.id}>
                <td>
                  <Link href={`/dashboard/grants/${grant.id}`}>{grant.grant_name}</Link>
                  {hasPitched(grant) && (
                    <span style={{ marginLeft: 6, fontSize: 11, color: "#1a7f4e", fontWeight: 600 }}>PITCHED</span>
                  )}
                </td>
                <td style={{ color: "#555", fontSize: 13 }}>{grant.sponsor_org ?? "—"}</td>
                <td><SourceBadge source={grant.discovery_source} /></td>
                <td style={{ color: "#555", fontSize: 13 }}>{grant.deadline_text ?? "—"}</td>
                <td><ScoreBadge score={grant.priority_score} /></td>
                <td><ScoreBadge score={grant.business_match_pct} suffix="%" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
