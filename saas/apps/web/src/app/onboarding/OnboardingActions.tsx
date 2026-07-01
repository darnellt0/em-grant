"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

export interface PendingInvite {
  invite_id: string;
  org_id: string;
  org_name: string;
  role: string;
  created_at: string;
}

export function OnboardingActions({ invites }: { invites: PendingInvite[] }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();

  const [orgName, setOrgName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function acceptInvite(inviteId: string) {
    setBusy(`accept-${inviteId}`);
    setError(null);
    const { error: rpcError } = await supabase.rpc("accept_org_invite", {
      _invite_id: inviteId,
    });
    setBusy(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    router.push("/dashboard/grants");
    router.refresh();
  }

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    setBusy("create");
    setError(null);
    const { error: rpcError } = await supabase.rpc("create_org_with_owner", {
      _name: orgName,
    });
    setBusy(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    // Send new owners to Settings first so they fill in the org profile,
    // which discovery/assess/pitch all depend on.
    router.push("/dashboard/settings");
    router.refresh();
  }

  return (
    <>
      {invites.length > 0 && (
        <div className="card">
          <h3>Your invitations</h3>
          <table>
            <thead>
              <tr>
                <th>Organization</th>
                <th>Role</th>
                <th>Invited</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => (
                <tr key={invite.invite_id}>
                  <td>{invite.org_name}</td>
                  <td>{invite.role}</td>
                  <td>{new Date(invite.created_at).toLocaleDateString()}</td>
                  <td>
                    <button
                      onClick={() => acceptInvite(invite.invite_id)}
                      disabled={busy !== null}
                    >
                      {busy === `accept-${invite.invite_id}` ? "Joining…" : "Accept"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <h3>Create a new organization</h3>
        <form onSubmit={createOrg}>
          <label htmlFor="orgName">Organization name</label>
          <br />
          <input
            id="orgName"
            type="text"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Elevated Movements"
            required
            style={{ width: "320px", padding: "8px", marginTop: 6, marginBottom: 12 }}
          />
          <br />
          <button type="submit" disabled={busy !== null}>
            {busy === "create" ? "Creating…" : "Create organization"}
          </button>
        </form>
      </div>

      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
    </>
  );
}
