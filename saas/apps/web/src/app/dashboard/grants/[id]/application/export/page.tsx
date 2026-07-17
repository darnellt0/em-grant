import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrgIdForUser, requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { CopyOne, CopyAllToolbar } from "./CopyButtons";

type PageProps = { params: { id: string }; searchParams: { only?: string } };

const STATUS_COLOR: Record<string, string> = {
  draft: "#0b57d0",
  reviewed: "#b45309",
  final: "#1a7f4e",
  skipped: "#6b7280",
};

function wordCount(text: string | null): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export default async function ExportPage({ params, searchParams }: PageProps) {
  const user = await requireUser();
  const orgId = await requireOrgIdForUser(user.id);
  const supabase = createSupabaseServerClient();

  // `?only=final` filters to only Final-status answers. Default shows all.
  const onlyFinal = searchParams.only === "final";

  const [{ data: grant }, { data: questions }] = await Promise.all([
    supabase
      .from("grants")
      .select("id, grant_name, sponsor_org, deadline_text, application_link")
      .eq("id", params.id)
      .eq("org_id", orgId)
      .maybeSingle(),
    supabase
      .from("application_questions")
      .select("id, ordering, question, word_target, draft_answer, status")
      .eq("grant_id", params.id)
      .eq("org_id", orgId)
      .order("ordering", { ascending: true }),
  ]);

  if (!grant) notFound();

  const allQs = (questions ?? []).map((q) => ({
    id: q.id as string,
    ordering: q.ordering as number,
    question: q.question as string,
    word_target: q.word_target as number | null,
    draft_answer: q.draft_answer as string | null,
    status: (q.status as string) ?? "draft",
  }));

  const filteredQs = onlyFinal ? allQs.filter((q) => q.status === "final") : allQs;
  const grantName = grant.grant_name as string;

  return (
    <section>
      <div style={{ marginBottom: 8 }}>
        <Link href={`/dashboard/grants/${params.id}/application`} style={{ fontSize: 13, color: "#666" }}>
          ← Back to application
        </Link>
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0 }}>Export — {grantName}</h2>
          <p style={{ color: "#555", margin: "4px 0 0", fontSize: 14 }}>
            {grant.sponsor_org && <>{grant.sponsor_org as string} · </>}
            {grant.deadline_text && <>Deadline: {grant.deadline_text as string}</>}
          </p>
          {grant.application_link && (
            <p style={{ margin: "4px 0 0" }}>
              <a href={grant.application_link as string} target="_blank" rel="noopener noreferrer" style={{ color: "#0b57d0", fontSize: 13 }}>
                Open funder application form ↗
              </a>
            </p>
          )}
        </div>
        <CopyAllToolbar grantName={grantName} questions={filteredQs} />
      </div>

      {/* Filter toggle */}
      <div style={{ marginBottom: 20, fontSize: 13, color: "#374151" }}>
        Show:{" "}
        <Link
          href={`/dashboard/grants/${params.id}/application/export`}
          style={{
            padding: "4px 12px", borderRadius: 999, fontSize: 13,
            background: !onlyFinal ? "#0b57d0" : "transparent",
            color: !onlyFinal ? "#fff" : "#374151",
            textDecoration: "none", border: "1px solid #d1d5db",
            display: "inline-block", marginRight: 6,
          }}
        >
          All ({allQs.length})
        </Link>
        <Link
          href={`/dashboard/grants/${params.id}/application/export?only=final`}
          style={{
            padding: "4px 12px", borderRadius: 999, fontSize: 13,
            background: onlyFinal ? "#1a7f4e" : "transparent",
            color: onlyFinal ? "#fff" : "#374151",
            textDecoration: "none", border: "1px solid #d1d5db",
            display: "inline-block",
          }}
        >
          Final only ({allQs.filter((q) => q.status === "final").length})
        </Link>
      </div>

      {filteredQs.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "32px 16px" }}>
          <p style={{ color: "#6b7280", margin: 0 }}>
            {onlyFinal
              ? "No answers marked Final yet. Mark answers as Final on the application page, then come back here to export."
              : "No questions drafted yet. Generate them from the application page first."}
          </p>
        </div>
      ) : (
        filteredQs.map((q) => {
          const color = STATUS_COLOR[q.status] ?? "#6b7280";
          const wc = wordCount(q.draft_answer);
          return (
            <div className="card" key={q.id} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
                    Question {q.ordering + 1}
                    {q.word_target ? ` — ${q.word_target} words target` : ""}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#111", lineHeight: 1.4 }}>
                    {q.question}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    padding: "2px 8px", borderRadius: 999,
                    background: color + "18", color, border: `1px solid ${color}44`,
                    textTransform: "uppercase", letterSpacing: "0.04em",
                  }}>
                    {q.status}
                  </span>
                  <CopyOne text={q.draft_answer ?? ""} label="Copy" />
                </div>
              </div>
              <div style={{
                whiteSpace: "pre-wrap", lineHeight: 1.7, color: "#1a1a1a",
                fontSize: 14, fontFamily: "Georgia, serif",
                background: "#fafafa", padding: 14, borderRadius: 6, border: "1px solid #e5e7eb",
              }}>
                {q.draft_answer || <span style={{ color: "#9ca3af", fontStyle: "italic" }}>(no answer)</span>}
              </div>
              <div style={{ fontSize: 12, color: q.word_target && (wc < q.word_target * 0.8 || wc > q.word_target * 1.2) ? "#b45309" : "#9ca3af", marginTop: 6 }}>
                {wc} word{wc === 1 ? "" : "s"}
                {q.word_target ? ` (target ${q.word_target})` : ""}
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}
