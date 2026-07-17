"use client";

import { useMemo, useState, useTransition } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { ratePitchAction } from "./[id]/actions";

function parseDraftPitch(raw: string): { narrative: string[]; checklist: string[] } {
  const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start !== -1 && end !== -1) {
    try {
      const parsed = JSON.parse(stripped.slice(start, end + 1)) as { draft_pitch?: string; checklist?: string[] };
      return {
        narrative: (parsed.draft_pitch ?? raw).split(/\n{2,}/).map((s) => s.trim()).filter(Boolean),
        checklist: Array.isArray(parsed.checklist) ? parsed.checklist : [],
      };
    } catch { /* fall through */ }
  }
  return { narrative: raw.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean), checklist: [] };
}

type PitchLength = "short" | "medium" | "long";
type PitchTone = "formal" | "conversational" | "data-driven";
type PitchFormat = "narrative" | "loi" | "cover-letter" | "one-pager";

interface PitchActionsProps {
  orgId: string;
  grantId: string;
  hasProfile: boolean;
  currentRating?: number | null;
  currentOptions?: {
    length?: string;
    tone?: string;
    format?: string;
    emphasis?: string;
    feedback?: string;
  } | null;
  hasExistingPitch?: boolean;
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

const LABEL: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4, display: "block" };
const SELECT: React.CSSProperties = { padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 14, background: "#fff" };
const INPUT: React.CSSProperties = { ...SELECT, fontFamily: "inherit" };

export function PitchActions({
  orgId,
  grantId,
  hasProfile,
  currentRating = null,
  currentOptions = null,
  hasExistingPitch = false,
}: PitchActionsProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [showTailoring, setShowTailoring] = useState(hasExistingPitch); // open by default if regenerating
  const [length, setLength] = useState<PitchLength>((currentOptions?.length as PitchLength) || "medium");
  const [tone, setTone] = useState<PitchTone>((currentOptions?.tone as PitchTone) || "conversational");
  const [format, setFormat] = useState<PitchFormat>((currentOptions?.format as PitchFormat) || "narrative");
  const [emphasis, setEmphasis] = useState(currentOptions?.emphasis ?? "");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(currentRating);
  const [ratingPending, startRatingTransition] = useTransition();

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
        body: JSON.stringify({
          org_id: orgId,
          grant_id: grantId,
          options: { length, tone, format, emphasis: emphasis || undefined, feedback: feedback || undefined },
        }),
      });

      if (!res.ok) throw new Error(await parseError(res));
      const data = (await res.json()) as { draft_pitch?: string };
      setDraft(data.draft_pitch ?? "Pitch generated — refresh the page to view.");
      setRating(null); // server-side reset, mirror it
      setFeedback("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pitch generation failed");
    } finally {
      setLoading(false);
    }
  }

  function ratePitch(value: number) {
    const next = rating === value ? 0 : value;
    setRating(next);
    startRatingTransition(async () => {
      const res = await ratePitchAction(grantId, next);
      if (!res.ok) setError(res.error);
    });
  }

  if (!hasProfile) {
    return (
      <p style={{ color: "#666" }}>
        Set up your <a href="/dashboard/settings">organization profile</a> to generate a pitch.
      </p>
    );
  }

  const buttonLabel = loading ? "Generating…" : hasExistingPitch ? "Regenerate with these options" : "Generate pitch draft";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Tailoring toggle */}
      <div>
        <button
          type="button"
          onClick={() => setShowTailoring((s) => !s)}
          style={{
            background: "none", border: "none", padding: 0, color: "#0b57d0",
            cursor: "pointer", fontSize: 13, fontWeight: 500,
          }}
        >
          {showTailoring ? "▾ Tailoring options" : "▸ Tailoring options"}
        </button>
      </div>

      {showTailoring && (
        <div style={{
          padding: 14, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb",
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12,
        }}>
          <div>
            <label style={LABEL}>Length</label>
            <select value={length} onChange={(e) => setLength(e.target.value as PitchLength)} style={SELECT}>
              <option value="short">Short (~150-250w)</option>
              <option value="medium">Medium (~400-600w)</option>
              <option value="long">Long (~800-1200w)</option>
            </select>
          </div>
          <div>
            <label style={LABEL}>Tone</label>
            <select value={tone} onChange={(e) => setTone(e.target.value as PitchTone)} style={SELECT}>
              <option value="conversational">Conversational</option>
              <option value="formal">Formal</option>
              <option value="data-driven">Data-driven</option>
            </select>
          </div>
          <div>
            <label style={LABEL}>Format</label>
            <select value={format} onChange={(e) => setFormat(e.target.value as PitchFormat)} style={SELECT}>
              <option value="narrative">Full narrative</option>
              <option value="loi">Letter of Inquiry</option>
              <option value="cover-letter">Cover letter</option>
              <option value="one-pager">One-pager</option>
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={LABEL}>Emphasis (optional)</label>
            <input
              type="text"
              value={emphasis}
              onChange={(e) => setEmphasis(e.target.value)}
              placeholder='e.g. "lead with founder story" / "highlight measurable outcomes" / "emphasize coaching methodology"'
              style={{ ...INPUT, width: "100%" }}
            />
          </div>
          {hasExistingPitch && (
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={LABEL}>Feedback on previous draft (optional — only used when regenerating)</label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder='e.g. "too corporate-sounding", "make it more specific about our skate program", "shorter intro paragraph"'
                rows={2}
                style={{ ...INPUT, width: "100%", resize: "vertical" }}
              />
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={generatePitch}
          disabled={loading}
          style={{
            padding: "8px 18px", borderRadius: 6, fontSize: 14, fontWeight: 500,
            background: loading ? "#9ca3af" : "#0b57d0", color: "#fff", border: "none",
            cursor: loading ? "default" : "pointer", alignSelf: "flex-start",
          }}
        >
          {buttonLabel}
        </button>

        {hasExistingPitch && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <span style={{ color: "#6b7280", marginRight: 4 }}>Rate current pitch:</span>
            <button
              type="button"
              onClick={() => ratePitch(1)}
              disabled={ratingPending}
              aria-label="Thumbs up"
              style={{
                padding: "4px 10px", borderRadius: 6, fontSize: 16, cursor: "pointer",
                background: rating === 1 ? "#dcfce7" : "#fff",
                border: `1px solid ${rating === 1 ? "#1a7f4e" : "#d1d5db"}`,
                color: rating === 1 ? "#1a7f4e" : "#6b7280",
              }}
            >👍</button>
            <button
              type="button"
              onClick={() => ratePitch(-1)}
              disabled={ratingPending}
              aria-label="Thumbs down"
              style={{
                padding: "4px 10px", borderRadius: 6, fontSize: 16, cursor: "pointer",
                background: rating === -1 ? "#fee2e2" : "#fff",
                border: `1px solid ${rating === -1 ? "#c0392b" : "#d1d5db"}`,
                color: rating === -1 ? "#c0392b" : "#6b7280",
              }}
            >👎</button>
          </div>
        )}
      </div>

      {error && <p style={{ color: "crimson", margin: 0 }}>{error}</p>}

      {draft && (() => {
        const { narrative, checklist } = parseDraftPitch(draft);
        return (
          <div className="card" style={{ marginTop: 8 }}>
            <h4 style={{ marginTop: 0 }}>New draft (regenerated)</h4>
            <div style={{ borderLeft: "3px solid #0b57d0", paddingLeft: 16, marginBottom: checklist.length ? 16 : 0 }}>
              {narrative.map((para, i) => (
                <p key={i} style={{ margin: "0 0 12px", lineHeight: 1.7 }}>{para}</p>
              ))}
            </div>
            {checklist.length > 0 && (
              <>
                <h5 style={{ margin: "0 0 8px" }}>Pre-submission checklist</h5>
                <ol style={{ margin: 0, paddingLeft: 20 }}>
                  {checklist.map((item, i) => (
                    <li key={i} style={{ marginBottom: 4, lineHeight: 1.5 }}>{item}</li>
                  ))}
                </ol>
              </>
            )}
            <p style={{ color: "#666", fontSize: 12, marginTop: 12, marginBottom: 0 }}>
              Refresh the page to see this saved on the grant.
            </p>
          </div>
        );
      })()}
    </div>
  );
}
