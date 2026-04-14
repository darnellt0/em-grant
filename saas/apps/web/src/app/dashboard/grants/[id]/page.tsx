import { notFound } from "next/navigation";
import { requireOrgIdForUser, requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

type PageProps = {
  params: { id: string };
};

export default async function GrantDetailPage({ params }: PageProps) {
  const user = await requireUser();
  const orgId = await requireOrgIdForUser(user.id);
  const supabase = createSupabaseServerClient();

  const { data: grant, error } = await supabase
    .from("grants")
    .select("*")
    .eq("org_id", orgId)
    .eq("id", params.id)
    .maybeSingle();

  if (error) {
    return <p>Failed to load grant: {error.message}</p>;
  }
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
          <strong>Focus Area:</strong> {grant.focus_area ?? "-"}
        </p>
        <p>
          <strong>Eligibility:</strong> {grant.eligibility_summary ?? "-"}
        </p>
        <p>
          <strong>Priority:</strong> {grant.priority_score ?? "-"}
        </p>
        <p>
          <strong>LLC / Foundation / Overall:</strong>{" "}
          {[grant.llc_priority_score, grant.foundation_priority_score, grant.overall_strategic_value]
            .map((v) => v ?? "-")
            .join(" / ")}
        </p>
      </div>
      <div className="card">
        <h3>Notes</h3>
        <pre style={{ whiteSpace: "pre-wrap" }}>{grant.notes ?? "-"}</pre>
      </div>
    </section>
  );
}
