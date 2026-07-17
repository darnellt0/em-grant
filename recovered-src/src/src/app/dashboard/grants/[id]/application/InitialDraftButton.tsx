"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

function getFunctionUrl(name: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  return `${base}/functions/v1/${name}`;
}

interface Props {
  orgId: string;
  grantId: string;
}

export function InitialDraftButton({ orgId, grantId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setStatus("Drafting 11 question answers — this can take 30-60 seconds…");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in");
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const res = await fetch(getFunctionUrl("draft_application"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
          ...(anonKey ? { apikey: anonKey } : {}),
        },
        body: JSON.stringify({ org_id: orgId, grant_id: grantId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string; message?: string };
        throw new Error(body.message ?? body.error ?? `Request failed (${res.status})`);
      }
      const data = await res.json() as { question_count?: number };
      setStatus(`Generated ${data.question_count} questions. Loading…`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Initial draft failed");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={run}
        disabled={loading}
        style={{
          padding: "10px 20px", borderRadius: 6, fontSize: 15, fontWeight: 500,
          background: loading ? "#9ca3af" : "#0b57d0", color: "#fff",
          border: "none", cursor: loading ? "default" : "pointer",
        }}
      >
        {loading ? "Drafting…" : "Draft answers to 11 standard questions"}
      </button>
      {status && <p style={{ marginTop: 12, color: "#374151", fontSize: 14 }}>{status}</p>}
      {error && <p style={{ marginTop: 12, color: "#c0392b", fontSize: 14 }}>{error}</p>}
    </div>
  );
}
