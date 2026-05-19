import { notFound } from "next/navigation";
import { requireOrgIdForUser, requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { PitchActions } from "../PitchActions";

type PageProps = {
  params: { id: string };
};

export default async function GrantDetailPage({ params }: PageProps) {
  const user = await requireUser();
  const orgId = await requireOrgIdForUser(user.id);
  const supabase = createSupabaseServerClient();

  const [{ data: grant, error }, { data: profile }] = await Promise.all([
    supabase
      .from("grants")
      .select("*")
      .eq("org_id", orgId)
      .eq("id", params.id)
      .maybeSingle(),
    supabase.from("org_profiles").select("org_id").eq("org_id", orgId).maybeSingle(),
  ]);

  if (error) return <p>Failed to load grant: {error.message}</p>;
  if (!grant) notFound();

  return (
    <section>
      <h2>{grant.grant_name}</h2>

      <div className="card">
        <p>
          <strong>Sponsor:</strong> {grant.sponsor_org ?? "-"}
        </p>
        <p>
          <strong>Status:</strong> {grant.status}
        </p>
        <p>
          <strong>Deadline:</strong> {grant.deadline_text ?? "-"}
        </p>
        <p>
          <strong>Amount:</strong> {grant.amount_text ?? "-"}
        </p>
        <p>
          <strong>Focus area:</strong> {grant.focus_area ?? "-"}
        </p>
        <p>
          <strong>Geography:</strong> {grant.geographic_scope ?? "-"}
        </p>
        <p>
          <strong>Eligibility:</strong> {grant.eligibility_summary ?? "-"}
        </p>
        <p>
          <strong>Source:</strong>{" "}
          {grant.application_link ? (
            <a href={grant.application_link} target="_blank" rel="noopener noreferrer">
              {grant.application_link}
            </a>
          ) : (
            "-"
          )}
        </p>
      </div>

      <div className="card">
        <h3>Scores</h3>
        <table>
          <tbody>
            <tr>
              <td>Overall strategic value</td>
              <td>{grant.overall_strategic_value ?? "Not assessed"}</td>
            </tr>
            <tr>
              <td>Priority</td>
              <td>{grant.priority_score ?? "-"}</td>
            </tr>
            <tr>
              <td>Eligibility confidence</td>
              <td>{grant.business_match_pct != null ? `${grant.business_match_pct}%` : "-"}</td>
            </tr>
            <tr>
              <td>Mission alignment</td>
              <td>{grant.woc_focus_rating != null ? `${grant.woc_focus_rating}/10` : "-"}</td>
            </tr>
            <tr>
              <td>Program fit</td>
              <td>{grant.leadership_dev_alignment != null ? `${grant.leadership_dev_alignment}/10` : "-"}</td>
            </tr>
            <tr>
              <td>Community impact</td>
              <td>{grant.community_impact_score != null ? `${grant.community_impact_score}/10` : "-"}</td>
            </tr>
          </tbody>
        </table>
        <p style={{ color: "#888", fontSize: 13, marginBottom: 0 }}>
          Run Assessment from the <a href="/dashboard/grants">Grants page</a> to score all grants.
        </p>
      </div>

      <div className="card">
        <h3>Generate pitch</h3>
        <PitchActions orgId={orgId} grantId={params.id} hasProfile={!!profile} />
      </div>

      {grant.notes && (
        <div className="card">
          <h3>Notes</h3>
          <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", margin: 0 }}>{grant.notes}</pre>
        </div>
      )}
    </section>
  );
}
