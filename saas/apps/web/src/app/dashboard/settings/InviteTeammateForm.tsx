"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

export interface PendingOrgInvite {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

interface InviteTeammateFormProps {
  orgId: string;
  pendingInvites: PendingOrgInvite[];
}

export function InviteTeammateForm({ orgId, pendingInvites }: InviteTeammateFormProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setBusy("invite");
    setNotice(null);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusy(null);
      setError("You must be signed in.");
      return;
    }

    const { error: insertError } = await supabase.from("org_invites").insert({
      org_id: orgId,
      email: email.trim().toLowerCase(),
      role,
      invited_by: user.id,
    });

    setBusy(null);
    if (insertError) {
      setError(
        insertError.message.includes("idx_org_invites_pending_unique")
          ? "There is already a pending invite for that email."
          : insertError.message,
      );
      return;
    }

    setNotice(
      `Invite created for ${email.trim().toLowerCase()}. Ask them to sign in with that email — they'll see the invite on their welcome screen.`,
    );
    setEmail("");
    router.refresh();
  }

  async function revokeInvite(inviteId: string) {
    setBusy(`revoke-${inviteId}`);
    setError(null);
    const { error: deleteError } = await supabase
      .from("org_invites")
      .delete()
      .eq("id", inviteId);
    setBusy(null);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <form onSubmit={sendInvite} style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <label htmlFor="inviteEmail">Email</label>
          <br />
          <input
            id="inviteEmail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@example.com"
            required
            style={{ width: "260px", padding: "8px", marginTop: 6 }}
          />
        </div>
        <div>
          <label htmlFor="inviteRole">Role</label>
          <br />
          <select
            id="inviteRole"
            value={role}
            onChange={(e) => setRole(e.target.value as "member" | "admin")}
            style={{ padding: "8px", marginTop: 6 }}
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button type="submit" disabled={busy !== null}>
          {busy === "invite" ? "Inviting…" : "Invite teammate"}
        </button>
      </form>

      {pendingInvites.length > 0 && (
        <table style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>Pending invite</th>
              <th>Role</th>
              <th>Sent</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {pendingInvites.map((invite) => (
              <tr key={invite.id}>
                <td>{invite.email}</td>
                <td>{invite.role}</td>
                <td>{new Date(invite.created_at).toLocaleDateString()}</td>
                <td>
                  <button
                    onClick={() => revokeInvite(invite.id)}
                    disabled={busy !== null}
                  >
                    {busy === `revoke-${invite.id}` ? "Revoking…" : "Revoke"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {notice ? <p style={{ color: "seagreen" }}>{notice}</p> : null}
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
    </div>
  );
}
