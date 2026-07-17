import Link from "next/link";
import { requireOrgIdForUser, requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { OrgProfileForm } from "./OrgProfileForm";
import type { OrgProfileData } from "./OrgProfileForm";
import { InviteTeammateForm } from "./InviteTeammateForm";
import type { PendingOrgInvite } from "./InviteTeammateForm";

interface OrgMemberRow {
  user_id: string;
  email: string | null;
  role: string;
  created_at: string | null;
}

export default async function SettingsPage() {
  const user = await requireUser();
  const orgId = await requireOrgIdForUser(user.id);
  const supabase = createSupabaseServerClient();

  const [{ data: org }, { data: members }, { data: profile }, { data: pendingInvites }] =
    await Promise.all([
      supabase.from("orgs").select("id,name,slug,created_at").eq("id", orgId).maybeSingle(),
      supabase.rpc("get_org_member_emails", { _org_id: orgId }),
      supabase.from("org_profiles").select("*").eq("org_id", orgId).maybeSingle(),
      supabase
        .from("org_invites")
        .select("id,email,role,created_at")
        .eq("org_id", orgId)
        .is("accepted_at", null)
        .order("created_at", { ascending: true }),
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
        <h3>Team</h3>
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {((members ?? []) as OrgMemberRow[]).map((member) => (
              <tr key={member.user_id}>
                <td>{member.email ?? member.user_id}</td>
                <td>{member.role}</td>
                <td>{member.created_at ? new Date(member.created_at).toLocaleString() : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h4 style={{ marginBottom: 4 }}>Invite a teammate</h4>
        <p style={{ color: "#555", marginTop: 0 }}>
          Invited teammates sign in with their email at this app and accept the
          invite from their welcome screen — no separate signup needed.
        </p>
        <InviteTeammateForm
          orgId={orgId}
          pendingInvites={(pendingInvites ?? []) as PendingOrgInvite[]}
        />
      </div>

      <div className="card">
        <h3>Documents</h3>
        <p style={{ color: "#555", marginTop: 0, marginBottom: 8 }}>
          Store org documents grant funders require — IRS letter, 990, audit, board roster, budget templates, founder bios. Upload once, reference everywhere.
        </p>
        <Link href="/dashboard/settings/documents" style={{ fontWeight: 500 }}>
          Manage documents →
        </Link>
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
