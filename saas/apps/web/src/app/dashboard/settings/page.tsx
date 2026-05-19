import Link from "next/link";
import { requireOrgIdForUser, requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { OrgProfileForm } from "./OrgProfileForm";
import type { OrgProfileData } from "./OrgProfileForm";

export default async function SettingsPage() {
  const user = await requireUser();
  const orgId = await requireOrgIdForUser(user.id);
  const supabase = createSupabaseServerClient();

  const [{ data: org }, { data: members }, { data: profile }] = await Promise.all([
    supabase.from("orgs").select("id,name,slug,created_at").eq("id", orgId).maybeSingle(),
    supabase
      .from("org_members")
      .select("user_id,role,created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: true }),
    supabase.from("org_profiles").select("*").eq("org_id", orgId).maybeSingle(),
  ]);

  return (
    <section>
      <h2>Settings</h2>

      <div className="card">
        <h3>Organization profile</h3>
        <p style={{ color: "#555", marginTop: 0 }}>
          This profile tells the AI what your organization is and what grants it is eligible for.
          Discovery, assessment, and pitch generation all use it.
          {!profile && (
            <strong style={{ color: "crimson" }}>
              {" "}
              Profile not set up yet — discovery will be blocked until you save one.
            </strong>
          )}
        </p>
        <OrgProfileForm orgId={orgId} initial={profile as OrgProfileData | null} />
      </div>

      <div className="card">
        <h3>Organization</h3>
        <p>
          <strong>Name:</strong> {org?.name ?? "-"}
        </p>
        <p>
          <strong>Slug:</strong> {org?.slug ?? "-"}
        </p>
      </div>

      <div className="card">
        <h3>Members</h3>
        <table>
          <thead>
            <tr>
              <th>User ID</th>
              <th>Role</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {(members ?? []).map((member) => (
              <tr key={member.user_id}>
                <td>{member.user_id}</td>
                <td>{member.role}</td>
                <td>{member.created_at ? new Date(member.created_at).toLocaleString() : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Billing & Usage</h3>
        <p>
          <Link href="/dashboard/settings/billing">Go to Billing</Link>
        </p>
        <p>
          <Link href="/dashboard/settings/usage">Go to Usage</Link>
        </p>
      </div>
    </section>
  );
}
