"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

interface GrantRunActionsProps {
  orgId: string;
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

export function GrantRunActions({ orgId, hasProfile }: GrantRunActionsProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState<"discover" | "assess" | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(endpoint: "discover" | "assess", body: Record<string, unknown>) {
    const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr || !session?.access_token) throw new Error("Not signed in");

    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const res = await fetch(getFunctionUrl(endpoint), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        ...(anonKey ? { apikey: anonKey } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(await parseError(res));
    return res.json() as Promise<{ summary?: { inserted_count?: number; assessed_count?: number } }>;
  }

  async function runDiscover() {
    setLoading("discover");
    setResult(null);
    setError(null);
    try {
      const data = await call("discover", { org_id: orgId });
      const n = data.summary?.inserted_count ?? 0;
      setResult(`Discovery complete — ${n} new grant${n === 1 ? "" : "s"} added. Refresh the page to see them.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Discovery failed");
    } finally {
      setLoading(null);
    }
  }

  async function runAssess() {
    setLoading("assess");
    setResult(null);
    setError(null);
    try {
      const data = await call("assess", { org_id: orgId });
      const n = data.summary?.assessed_count ?? 0;
      setResult(`Assessment complete — ${n} grant${n === 1 ? "" : "s"} scored. Refresh to see updated scores.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assessment failed");
    } finally {
      setLoading(null);
    }
  }

  if (!hasProfile) {
    return (
      <p style={{ color: "#666" }}>
        Set up your <a href="/dashboard/settings">organization profile</a> before running discovery.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={runDiscover} disabled={loading !== null}>
          {loading === "discover" ? "Discovering…" : "Run Discovery"}
        </button>
        <button onClick={runAssess} disabled={loading !== null}>
          {loading === "assess" ? "Assessing…" : "Run Assessment"}
        </button>
      </div>
      {result && <p style={{ color: "green", margin: 0 }}>{result}</p>}
      {error && <p style={{ color: "crimson", margin: 0 }}>{error}</p>}
    </div>
  );
}
