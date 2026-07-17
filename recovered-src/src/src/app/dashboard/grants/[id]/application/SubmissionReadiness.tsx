import Link from "next/link";

interface Question {
  id: string;
  ordering: number;
  question: string;
  word_target: number | null;
  draft_answer: string | null;
  status: string;
}

interface Props {
  grantId: string;
  questions: Question[];
  deadlineDate: string | null;
  outcomeStatus: string | null;
}

interface Issue {
  level: "blocker" | "warning" | "info";
  text: string;
  hint?: string;
}

function wordCount(text: string | null): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T23:59:59Z");
  if (Number.isNaN(d.getTime())) return null;
  const diff = (d.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
  return Math.ceil(diff);
}

function analyze(props: Props): Issue[] {
  const issues: Issue[] = [];

  // Deadline checks
  const daysLeft = daysUntil(props.deadlineDate);
  if (daysLeft != null) {
    if (daysLeft < 0) {
      issues.push({
        level: "blocker",
        text: `Deadline passed ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? "" : "s"} ago.`,
        hint: "Check the funder's website for any extended deadline or next cycle.",
      });
    } else if (daysLeft <= 3) {
      issues.push({
        level: "warning",
        text: `Only ${daysLeft} day${daysLeft === 1 ? "" : "s"} left until deadline.`,
        hint: "Time to finalize and submit.",
      });
    } else if (daysLeft <= 14) {
      issues.push({
        level: "info",
        text: `${daysLeft} days until deadline.`,
      });
    }
  }

  // Outcome state — if already Applied, this is informational
  if (props.outcomeStatus === "applied" || props.outcomeStatus === "in_review" || props.outcomeStatus === "won") {
    issues.push({
      level: "info",
      text: `Outcome is already marked "${props.outcomeStatus}". You may have submitted already.`,
    });
  }

  // Per-question checks
  const blank = props.questions.filter((q) => !(q.draft_answer ?? "").trim());
  if (blank.length > 0) {
    issues.push({
      level: "blocker",
      text: `${blank.length} question${blank.length === 1 ? "" : "s"} ${blank.length === 1 ? "has" : "have"} no answer.`,
      hint: "Click Regenerate or write an answer for each.",
    });
  }

  const draftCount = props.questions.filter((q) => q.status === "draft" && (q.draft_answer ?? "").trim()).length;
  if (draftCount > 0) {
    issues.push({
      level: "warning",
      text: `${draftCount} answer${draftCount === 1 ? "" : "s"} still in Draft.`,
      hint: "Review each, then mark as Reviewed or Final.",
    });
  }

  // Word count outliers (way off target)
  const offTarget = props.questions.filter((q) => {
    if (!q.word_target || !(q.draft_answer ?? "").trim()) return false;
    const wc = wordCount(q.draft_answer);
    return wc < q.word_target * 0.5 || wc > q.word_target * 1.5;
  });
  if (offTarget.length > 0) {
    issues.push({
      level: "warning",
      text: `${offTarget.length} answer${offTarget.length === 1 ? " is" : "s are"} far off the word target (>50% deviation).`,
      hint: "Funders often have hard word/character limits.",
    });
  }

  if (props.questions.length === 0) {
    issues.push({
      level: "blocker",
      text: "No questions drafted yet.",
      hint: "Use the Start application draft button.",
    });
  }

  return issues;
}

const LEVEL_META: Record<Issue["level"], { color: string; bg: string; border: string; icon: string; label: string }> = {
  blocker: { color: "#c0392b", bg: "#fef2f2", border: "#fecaca", icon: "✕", label: "Blocker" },
  warning: { color: "#b45309", bg: "#fffbeb", border: "#fde68a", icon: "⚠", label: "Warning" },
  info:    { color: "#0b57d0", bg: "#eff6ff", border: "#bfdbfe", icon: "ℹ", label: "Info" },
};

export function SubmissionReadiness(props: Props) {
  const issues = analyze(props);
  const blockerCount = issues.filter((i) => i.level === "blocker").length;
  const warningCount = issues.filter((i) => i.level === "warning").length;

  const allGood = issues.length === 0 || (blockerCount === 0 && warningCount === 0 && issues.every((i) => i.level === "info"));
  const hasBlockers = blockerCount > 0;

  const panelBg = hasBlockers ? "#fef2f2" : warningCount > 0 ? "#fffbeb" : "#f0fdf4";
  const panelBorder = hasBlockers ? "#fecaca" : warningCount > 0 ? "#fde68a" : "#bbf7d0";
  const panelColor = hasBlockers ? "#c0392b" : warningCount > 0 ? "#b45309" : "#1a7f4e";

  const finalCount = props.questions.filter((q) => q.status === "final").length;
  const hasAnyFinal = finalCount > 0;

  return (
    <div style={{
      padding: 16, marginBottom: 20,
      background: panelBg, border: `1px solid ${panelBorder}`, borderRadius: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: issues.length > 0 ? 12 : 0 }}>
        <div>
          <h3 style={{ margin: 0, color: panelColor, fontSize: 16 }}>
            {hasBlockers
              ? `Not ready to submit — ${blockerCount} blocker${blockerCount === 1 ? "" : "s"}`
              : warningCount > 0
              ? `Almost ready — ${warningCount} warning${warningCount === 1 ? "" : "s"}`
              : allGood
              ? "Ready to submit ✓"
              : "Ready to submit"}
          </h3>
          {!hasBlockers && (
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#374151" }}>
              {finalCount > 0
                ? `${finalCount} of ${props.questions.length} answer${props.questions.length === 1 ? "" : "s"} marked Final.`
                : "Mark answers as Final once you've reviewed them."}
            </p>
          )}
        </div>
        {hasAnyFinal && (
          <Link
            href={`/dashboard/grants/${props.grantId}/application/export?only=final`}
            style={{
              padding: "8px 16px", borderRadius: 6, fontSize: 14, fontWeight: 500,
              background: "#fff", color: "#0b57d0", border: "1px solid #0b57d0",
              textDecoration: "none",
            }}
          >
            Export final answers →
          </Link>
        )}
      </div>

      {issues.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
          {issues.map((iss, idx) => {
            const m = LEVEL_META[iss.level];
            return (
              <li key={idx} style={{
                display: "flex", alignItems: "flex-start", gap: 10,
                padding: "8px 12px", background: m.bg, border: `1px solid ${m.border}`, borderRadius: 6,
                fontSize: 13,
              }}>
                <span style={{ color: m.color, fontWeight: 700, flexShrink: 0, width: 16, textAlign: "center" }}>{m.icon}</span>
                <div style={{ flex: 1 }}>
                  <span style={{ color: m.color, fontWeight: 500 }}>{iss.text}</span>
                  {iss.hint && <span style={{ color: "#6b7280", marginLeft: 6 }}>— {iss.hint}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
