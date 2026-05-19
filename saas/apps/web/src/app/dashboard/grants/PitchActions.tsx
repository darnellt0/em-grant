"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

interface PitchActionsProps {
  orgId: string;
  grantId: string;
  hasProfile: boolean;
}

function getFunctionUrl(name: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  return `${base}/functions/v1/${name}`;
}

async function parseError(res: Response): Promise<string> {
  try {
    const p = (await res.json()) as { error?: string; message?: string };
    return p.message ?? p.error ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export function PitchActions({ orgId, grantId, hasProfile }: PitchActionsProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generatePitch() {
    setLoading(true);
    setDraft(null);
    setError(null);
    try {
      const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr || !session?.access_token) throw new Error("Not signed in");

      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const res = await fetch(getFunctionUrl("pitch"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
          ...(anonKey ? { apikey: anonKey } : {}),
        },
        body: JSON.stringify({ org_id: orgId, grant_id: grantId }),
      });

      if (!res.ok) throw new Error(await parseError(res));
      const data = (await res.json()) as { draft_pitch?: string };
      setDraft(data.draft_pitch ?? "Pitch generated — refresh notes to view.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pitch generation failed");
    } finally {
      setLoading(false);
    }
  }

  if (!hasProfile) {
    return (
      <p style={{ color: "#666" }}>
        Set up your <a href="/dashboard/settings">organization profile</a> to generate a pitch.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <button onClick={generatePitch} disabled={loading} style={{ alignSelf: "flex-start" }}>
        {loading ? "Generating pitch…" : "Generate pitch draft"}
      </button>
      {error && <p style={{ color: "crimson", margin: 0 }}>{error}</p>}
      {draft && (
        <div className="card">
          <h4 style={{ marginTop: 0 }}>Draft pitch</h4>
          <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", margin: 0 }}>{draft}</pre>
          <p style={{ color: "#666", fontSize: 13, marginBottom: 0 }}>
            Full draft and checklist also saved to the grant&apos;s notes field.
          </p>
        </div>
      )}
    </div>
  );
}
