import Link from "next/link";
import { requireOrgIdForUser, requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export default async function GrantsPage() {
  const user = await requireUser();
  const orgId = await requireOrgIdForUser(user.id);
  const supabase = createSupabaseServerClient();

  const { data: grants, error } = await supabase
    .from("grants")
    .select("id,grant_name,sponsor_org,status,deadline_text,priority_score,updated_at")
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    return <p>Failed to load grants: {error.message}</p>;
  }

  return (
    <section>
      <h2>Grants</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Sponsor</th>
            <th>Status</th>
            <th>Deadline</th>
            <th>Priority</th>
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
              <td>{grant.priority_score ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
