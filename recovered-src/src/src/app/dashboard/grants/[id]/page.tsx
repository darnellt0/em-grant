import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrgIdForUser, requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { PitchActions } from "../PitchActions";
import { OutcomeForm } from "./OutcomeForm";

function formatMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function recommendationMeta(s: string | null): { label: string; color: string; emoji: string } | null {
  if (!s) return null;
  switch (s) {
    case "pursue":   return { label: "Pursue",   color: "#1a7f4e", emoji: "🎯" };
    case "review":   return { label: "Review",   color: "#b45309", emoji: "🔍" };
    case "excluded": return { label: "Excluded", color: "#c0392b", emoji: "🚫" };
    case "assessed": return { label: "Assessed", color: "#6b7280", emoji: "✓"  };
    default:         return { label: s,          color: "#6b7280", emoji: "•"  };
  }
}

function scoredByLabel(s: string | null): string {
  if (!s) return "Auto";
  if (s === "dorothy") return "Dorothy (analyst)";
  if (s === "saas-llm" || s === "discover_edge_fn") return "SaaS auto-curator";
  if (s === "manual") return "Manually entered";
  return s;
}

function outcomeStatusLabel(s: string | null): { label: string; color: string } {
  switch (s) {
    case "applied":   return { label: "Applied",     color: "#0b57d0" };
    case "in_review": return { label: "In Review",   color: "#b45309" };
    case "won":       return { label: "Won",         color: "#1a7f4e" };
    case "declined":  return { label: "Declined",    color: "#c0392b" };
    case "skipped":   return { label: "Skipped",     color: "#6b7280" };
    default:          return { label: "Not yet applied", color: "#9ca3af" };
  }
}

function scoreColor(score: number | null): string {
  if (score == null) return "#999";
  if (score >= 80) return "#1a7f4e";
  if (score >= 60) return "#b45309";
  return "#c0392b";
}

function scoreBadge(score: number | null, suffix = ""): React.ReactNode {
  const color = scoreColor(score);
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: 999,
      background: color + "18", color, fontWeight: 700, fontSize: 14,
      border: `1px solid ${color}44`,
    }}>
      {score != null ? `${score}${suffix}` : "—"}
    </span>
  );
}

interface ParsedPitch {
  narrative: string[];
  checklist: string[];
}

function parsePitchFromNotes(notes: string): ParsedPitch | null {
  const marker = "---\nDraft Pitch:";
  const idx = notes.indexOf(marker);
  if (idx === -1) return null;

  const afterMarker = notes.slice(idx + marker.length).trim();

  // Try to extract JSON regardless of code fences
  const start = afterMarker.indexOf("{");
  const end = afterMarker.lastIndexOf("}");
  if (start !== -1 && end !== -1) {
    try {
      const parsed = JSON.parse(afterMarker.slice(start, end + 1)) as {
        draft_pitch?: string;
        checklist?: string[];
      };
      const narrative = (parsed.draft_pitch ?? "").split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
      const checklist = Array.isArray(parsed.checklist) ? parsed.checklist : [];
      if (narrative.length) return { narrative, checklist };
    } catch { /* fall through */ }
  }

  // Plain text fallback: split on "Checklist:" if present
  const checklistIdx = afterMarker.indexOf("\n\nChecklist:");
  if (checklistIdx !== -1) {
    const narrativePart = afterMarker.slice(0, checklistIdx).replace(/^```[^\n]*\n?/, "").replace(/\n?```$/, "").trim();
    const checklistPart = afterMarker.slice(checklistIdx + 12).replace(/^```[^\n]*\n?/, "").replace(/\n?```$/, "").trim();
    return {
      narrative: narrativePart.split(/\n{2,}/).map(s => s.trim()).filter(Boolean),
      checklist: checklistPart.split("\n").map(s => s.replace(/^\d+\.\s*/, "").trim()).filter(Boolean),
    };
  }

  // Last resort: raw text
  const raw = afterMarker.replace(/^```[^\n]*\n?/, "").replace(/\n?```$/, "").trim();
  return { narrative: raw.split(/\n{2,}/).map(s => s.trim()).filter(Boolean), checklist: [] };
}

type PageProps = {
  params: { id: string };
};

export default async function GrantDetailPage({ params }: PageProps) {
  const user = await requireUser();
  const orgId = await requireOrgIdForUser(user.id);
  const supabase = createSupabaseServerClient();

  const [{ data: grant, error }, { data: profile }] = await Promise.all([
    supabase
      .from("grants")
      .select("*")
      .eq("org_id", orgId)
      .eq("id", params.id)
      .maybeSingle(),
    supabase.from("org_profiles").select("org_id").eq("org_id", orgId).maybeSingle(),
  ]);

  if (error) return <p>Failed to load grant: {error.message}</p>;
  if (!grant) notFound();

  // Look up matching analyst engagement (Dorothy or similar) for this grant by title+sponsor.
  // RPC handles the join from grants → grants_raw → org_grant_engagements.
  const { data: engagementRows } = await supabase.rpc("get_grant_engagement_by_title", {
    p_org_id: orgId,
    p_grant_name: grant.grant_name as string,
    p_sponsor_org: (grant.sponsor_org as string | null) ?? null,
  });
  const engagement = Array.isArray(engagementRows) && engagementRows.length > 0 ? engagementRows[0] : null;

  // Count any existing draft application questions for the "Continue / Draft Application" CTA.
  const { count: appQuestionCount } = await supabase
    .from("application_questions")
    .select("id", { count: "exact", head: true })
    .eq("grant_id", params.id)
    .eq("org_id", orgId);

  const parsedPitch = grant.notes ? parsePitchFromNotes(grant.notes as string) : null;
  const rawNotes = grant.notes
    ? (grant.notes as string).split("---\nDraft Pitch:")[0].trim()
    : null;

  return (
    <section>
      <div style={{ marginBottom: 8 }}>
        <a href="/dashboard/grants" style={{ fontSize: 13, color: "#666" }}>← Back to grants</a>
      </div>
      <h2 style={{ marginBottom: 4 }}>{grant.grant_name}</h2>
      {grant.sponsor_org && (
        <p style={{ color: "#555", marginTop: 0, marginBottom: 16 }}>{grant.sponsor_org}</p>
      )}

      <div className="card">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px" }}>
          <p style={{ margin: 0 }}><strong>Status:</strong> {grant.status}</p>
          <p style={{ margin: 0 }}><strong>Deadline:</strong> {grant.deadline_text ?? "—"}</p>
          <p style={{ margin: 0 }}><strong>Amount:</strong> {grant.amount_text ?? "—"}</p>
          <p style={{ margin: 0 }}><strong>Geography:</strong> {grant.geographic_scope ?? "—"}</p>
          <p style={{ margin: 0, gridColumn: "1 / -1" }}><strong>Focus area:</strong> {grant.focus_area ?? "—"}</p>
          <p style={{ margin: 0, gridColumn: "1 / -1" }}><strong>Eligibility:</strong> {grant.eligibility_summary ?? "—"}</p>
          {grant.application_link && (
            <p style={{ margin: 0, gridColumn: "1 / -1" }}>
              <strong>Source:</strong>{" "}
              <a href={grant.application_link as string} target="_blank" rel="noopener noreferrer">
                {grant.application_link as string}
              </a>
            </p>
          )}
        </div>
      </div>

      {/* SaaS dimensional scores. When an analyst engagement exists, collapse
          these into a <details> toggle so they don't compete with Dorothy's
          headline alignment score + narrative. Information is preserved,
          redundancy is hidden. */}
      {(() => {
        const scoreEntries = [
          { label: "Strategic value", val: grant.overall_strategic_value, suffix: "" },
          { label: "Priority", val: grant.priority_score, suffix: "" },
          { label: "Eligibility match", val: grant.business_match_pct, suffix: "%" },
          { label: "Mission alignment", val: grant.woc_focus_rating, suffix: "/10" },
          { label: "Program fit", val: grant.leadership_dev_alignment, suffix: "/10" },
          { label: "Community impact", val: grant.community_impact_score, suffix: "/10" },
        ];
        const scoresGrid = (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {scoreEntries.map(({ label, val, suffix }) => (
                <div key={label} style={{ textAlign: "center", padding: "12px 8px", background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                  <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>{label}</div>
                  {scoreBadge(val as number | null, suffix)}
                </div>
              ))}
            </div>
            {grant.overall_strategic_value == null && (
              <p style={{ color: "#888", fontSize: 13, marginTop: 12, marginBottom: 0 }}>
                Run Assessment from the <a href="/dashboard/grants">Grants page</a> to score all grants.
              </p>
            )}
          </>
        );

        // When Dorothy (or any analyst) has engaged with this grant, collapse
        // the SaaS dimensional scoring into a details disclosure so it stops
        // duplicating her headline alignment_score.
        const hasEngagement = !!(engagement && (engagement.recommendation || engagement.assessment_text || engagement.alignment_score != null));

        if (hasEngagement) {
          return (
            <div className="card">
              <details>
                <summary style={{ cursor: "pointer", fontSize: 15, fontWeight: 600, color: "#374151" }}>
                  SaaS dimensional scores (6 metrics) — superseded by analyst engagement below
                </summary>
                <div style={{ marginTop: 16 }}>
                  {scoresGrid}
                </div>
              </details>
            </div>
          );
        }

        return (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Scores</h3>
            {scoresGrid}
          </div>
        );
      })()}

      {engagement && (engagement.recommendation || engagement.assessment_text || engagement.alignment_score != null) && (() => {
        const rec = recommendationMeta(engagement.recommendation as string | null);
        const score = engagement.alignment_score as number | null;
        const text = engagement.assessment_text as string | null;
        const scoredBy = scoredByLabel(engagement.scored_by as string | null);
        const scoredAt = engagement.scored_at as string | null;
        const isDorothy = engagement.scored_by === "dorothy";

        return (
          <div className="card" style={{
            background: isDorothy ? "#fdf6e3" : "#f9fafb",
            border: `1px solid ${isDorothy ? "#facc15" : "#e5e7eb"}`,
          }}>
            <h3 style={{ marginTop: 0, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <span style={{ color: isDorothy ? "#854d0e" : "#374151" }}>
                {isDorothy ? "🎯 Dorothy's strategic analysis" : "Strategic analysis"}
              </span>
              {rec && (
                <span style={{
                  fontSize: 13, fontWeight: 600,
                  padding: "4px 12px", borderRadius: 999,
                  background: rec.color + "18", color: rec.color, border: `1px solid ${rec.color}44`,
                }}>
                  {rec.emoji} {rec.label}
                </span>
              )}
            </h3>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px 24px", marginBottom: text ? 16 : 0, fontSize: 13, color: "#374151" }}>
              <div><strong>Scored by:</strong> {scoredBy}</div>
              {score != null && <div><strong>Alignment:</strong> {score}/100</div>}
              {scoredAt && <div><strong>When:</strong> {new Date(scoredAt).toLocaleDateString()}</div>}
              {engagement.oc_status && <div><strong>Status:</strong> {engagement.oc_status as string}</div>}
            </div>

            {text && text.length > 0 && (
              <div style={{
                marginTop: 12,
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                padding: 16,
                fontSize: 14, lineHeight: 1.65, color: "#1a1a1a",
                whiteSpace: "pre-wrap", fontFamily: "Georgia, serif",
                maxHeight: 480, overflowY: "auto",
              }}>
                {text}
              </div>
            )}

            {!text && (
              <p style={{ margin: 0, color: "#6b7280", fontSize: 13, fontStyle: "italic" }}>
                {isDorothy
                  ? "Dorothy scored this grant but didn't write a full report (possibly a quick triage). Run her pipeline again to refresh."
                  : "No written assessment yet."}
              </p>
            )}
          </div>
        );
      })()}

      <div className="card" style={{ background: "#f0f7ff", border: "1px solid #c7dcfd" }}>
        <h3 style={{ marginTop: 0, marginBottom: 8, color: "#0b57d0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>Application draft</span>
          {(appQuestionCount ?? 0) > 0 && (
            <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>
              {appQuestionCount} question{appQuestionCount === 1 ? "" : "s"} drafted
            </span>
          )}
        </h3>
        <p style={{ margin: "0 0 12px", color: "#374151", fontSize: 14 }}>
          {(appQuestionCount ?? 0) > 0
            ? "Continue editing the draft answers to standard grant application questions. Each answer uses your org profile + pitch as context. Regenerate individual answers with feedback."
            : "Draft answers to the 11 standard grant application questions in one click. Then edit, add custom questions, or regenerate any answer with feedback."}
        </p>
        <Link
          href={`/dashboard/grants/${params.id}/application`}
          style={{
            display: "inline-block", padding: "8px 18px", borderRadius: 6,
            fontSize: 14, fontWeight: 500, background: "#0b57d0", color: "#fff",
            textDecoration: "none",
          }}
        >
          {(appQuestionCount ?? 0) > 0 ? "Continue application draft →" : "Start application draft"}
        </Link>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>Outcome</span>
          {(() => {
            const { label, color } = outcomeStatusLabel(grant.outcome_status as string | null);
            return (
              <span style={{
                fontSize: 13, fontWeight: 600,
                padding: "4px 12px", borderRadius: 999,
                background: color + "18", color, border: `1px solid ${color}44`,
              }}>
                {label}
              </span>
            );
          })()}
        </h3>

        {(grant.outcome_status || grant.outcome_amount || grant.application_date) && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 24px", marginBottom: 16, fontSize: 14, color: "#374151" }}>
            {grant.application_date && (
              <div><strong>Applied:</strong> {grant.application_date as string}</div>
            )}
            {grant.outcome_date && (
              <div><strong>{grant.outcome_status === "won" ? "Awarded" : "Decided"}:</strong> {grant.outcome_date as string}</div>
            )}
            {grant.outcome_amount != null && (
              <div style={{ gridColumn: "1 / -1" }}>
                <strong>Amount:</strong>{" "}
                <span style={{ color: "#1a7f4e", fontWeight: 600 }}>{formatMoney(grant.outcome_amount as number)}</span>
              </div>
            )}
            {grant.outcome_note && (
              <div style={{ gridColumn: "1 / -1", color: "#555", fontStyle: "italic" }}>{grant.outcome_note as string}</div>
            )}
          </div>
        )}

        <OutcomeForm
          grantId={params.id}
          currentStatus={grant.outcome_status as string | null}
          currentApplicationDate={grant.application_date as string | null}
          currentOutcomeDate={grant.outcome_date as string | null}
          currentOutcomeAmount={grant.outcome_amount as number | null}
          currentOutcomeNote={grant.outcome_note as string | null}
        />
      </div>

      {rawNotes && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Notes</h3>
          <p style={{ margin: 0, color: "#444" }}>{rawNotes}</p>
        </div>
      )}

      {parsedPitch ? (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Draft Pitch</h3>
          <div style={{ borderLeft: "3px solid #0b57d0", paddingLeft: 16, marginBottom: 20 }}>
            {parsedPitch.narrative.map((para, i) => (
              <p key={i} style={{ margin: "0 0 14px", lineHeight: 1.7, color: "#1a1a1a" }}>{para}</p>
            ))}
          </div>
          {parsedPitch.checklist.length > 0 && (
            <>
              <h4 style={{ marginTop: 0, marginBottom: 8 }}>Pre-submission checklist</h4>
              <ol style={{ margin: 0, paddingLeft: 20 }}>
                {parsedPitch.checklist.map((item, i) => (
                  <li key={i} style={{ marginBottom: 6, lineHeight: 1.5 }}>{item}</li>
                ))}
              </ol>
            </>
          )}
        </div>
      ) : (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Generate pitch</h3>
          <PitchActions
            orgId={orgId}
            grantId={params.id}
            hasProfile={!!profile}
            currentRating={(grant.pitch_rating ?? null) as number | null}
            currentOptions={grant.pitch_options as Record<string, string> | null}
            hasExistingPitch={!!parsedPitch}
          />
        </div>
      )}

      {parsedPitch && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Regenerate pitch</h3>
          <PitchActions
            orgId={orgId}
            grantId={params.id}
            hasProfile={!!profile}
            currentRating={(grant.pitch_rating ?? null) as number | null}
            currentOptions={grant.pitch_options as Record<string, string> | null}
            hasExistingPitch={!!parsedPitch}
          />
        </div>
      )}
    </section>
  );
}
