import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrgIdForUser, requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { QuestionCard } from "./QuestionCard";
import { AddQuestion } from "./AddQuestion";
import { InitialDraftButton } from "./InitialDraftButton";
import { SubmissionReadiness } from "./SubmissionReadiness";

type PageProps = { params: { id: string } };

export default async function ApplicationPage({ params }: PageProps) {
  const user = await requireUser();
  const orgId = await requireOrgIdForUser(user.id);
  const supabase = createSupabaseServerClient();

  // Load grant + check ownership (+ which voice profiles this org has for polish buttons)
  const [{ data: grant }, { data: questions }, { data: voiceProfilesRaw }] = await Promise.all([
    supabase
      .from("grants")
      .select("id, grant_name, sponsor_org, deadline_text, deadline_date, application_link, outcome_status")
      .eq("id", params.id)
      .eq("org_id", orgId)
      .maybeSingle(),
    supabase
      .from("application_questions")
      .select("id, grant_id, ordering, question, word_target, draft_answer, status, last_regen_at, regen_feedback")
      .eq("grant_id", params.id)
      .eq("org_id", orgId)
      .order("ordering", { ascending: true }),
    supabase
      .from("org_voice_profiles")
      .select("voice_name")
      .eq("org_id", orgId),
  ]);

  const voiceProfiles = (voiceProfilesRaw ?? []).map((r) => r.voice_name as string);

  if (!grant) notFound();

  const totalQuestions = questions?.length ?? 0;
  const totalsByStatus: Record<string, number> = { draft: 0, reviewed: 0, final: 0, skipped: 0 };
  let totalWords = 0;
  for (const q of questions ?? []) {
    const s = (q.status as string) ?? "draft";
    totalsByStatus[s] = (totalsByStatus[s] ?? 0) + 1;
    const text = (q.draft_answer as string | null) ?? "";
    totalWords += text.trim().split(/\s+/).filter(Boolean).length;
  }

  return (
    <section>
      <div style={{ marginBottom: 8 }}>
        <Link href={`/dashboard/grants/${params.id}`} style={{ fontSize: 13, color: "#666" }}>
          ← Back to grant
        </Link>
      </div>
      <h2 style={{ marginBottom: 4 }}>Application draft</h2>
      <p style={{ color: "#555", marginTop: 0, marginBottom: 20, fontSize: 15 }}>
        <strong>{grant.grant_name as string}</strong>
        {grant.sponsor_org && <> — {grant.sponsor_org as string}</>}
        {grant.deadline_text && <> · Deadline: {grant.deadline_text as string}</>}
        {grant.application_link && (
          <>
            {" · "}
            <a href={grant.application_link as string} target="_blank" rel="noopener noreferrer" style={{ color: "#0b57d0" }}>
              Funder application page ↗
            </a>
          </>
        )}
      </p>

      {totalQuestions === 0 ? (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>No questions yet</h3>
          <p style={{ color: "#374151" }}>
            Generate draft answers to the 11 standard grant application questions (mission, project,
            target population, methodology, outcomes, leadership, track record, budget, sustainability,
            funder fit, problem statement). Each answer uses your org profile + the grant pitch as
            context. You can edit, regenerate, or add custom questions afterward.
          </p>
          <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 16 }}>
            Costs ~$0.10-$0.30 in LLM tokens. Takes 30-60 seconds.{" "}
            <Link href="/dashboard/help" style={{ color: "#0b57d0" }}>How does this work? →</Link>
          </p>
          <InitialDraftButton orgId={orgId} grantId={params.id} />
          <p style={{ color: "#9ca3af", fontSize: 13, marginTop: 16, marginBottom: 0 }}>
            Or add questions one-by-one below (manual mode, no auto-draft):
          </p>
          <div style={{ marginTop: 8 }}>
            <AddQuestion grantId={params.id} />
          </div>
        </div>
      ) : (
        <>
          <SubmissionReadiness
            grantId={params.id}
            questions={(questions ?? []).map((q) => ({
              id: q.id as string,
              ordering: q.ordering as number,
              question: q.question as string,
              word_target: q.word_target as number | null,
              draft_answer: q.draft_answer as string | null,
              status: (q.status as string) ?? "draft",
            }))}
            deadlineDate={grant.deadline_date as string | null}
            outcomeStatus={grant.outcome_status as string | null}
          />

          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 14, color: "#374151" }}>
                <div><strong>{totalQuestions}</strong> question{totalQuestions === 1 ? "" : "s"}</div>
                <div>·</div>
                <div><strong>{totalWords.toLocaleString()}</strong> words drafted</div>
                <div>·</div>
                <div style={{ color: "#0b57d0" }}>{totalsByStatus.draft} draft</div>
                <div style={{ color: "#b45309" }}>{totalsByStatus.reviewed} reviewed</div>
                <div style={{ color: "#1a7f4e" }}>{totalsByStatus.final} final</div>
                {totalsByStatus.skipped > 0 && <div style={{ color: "#6b7280" }}>{totalsByStatus.skipped} skipped</div>}
              </div>
              <Link
                href={`/dashboard/grants/${params.id}/application/export`}
                style={{
                  padding: "6px 14px", borderRadius: 6, fontSize: 13, fontWeight: 500,
                  background: "#fff", color: "#0b57d0", border: "1px solid #0b57d0",
                  textDecoration: "none",
                }}
              >
                Export view →
              </Link>
            </div>
          </div>

          {(questions ?? []).map((q, i) => (
            <QuestionCard
              key={q.id as string}
              question={{
                id: q.id as string,
                grant_id: q.grant_id as string,
                ordering: q.ordering as number,
                question: q.question as string,
                word_target: q.word_target as number | null,
                draft_answer: q.draft_answer as string | null,
                status: (q.status as string) ?? "draft",
                last_regen_at: q.last_regen_at as string | null,
                regen_feedback: q.regen_feedback as string | null,
              }}
              orgId={orgId}
              index={i}
              voiceProfiles={voiceProfiles}
            />
          ))}

          <AddQuestion grantId={params.id} />
        </>
      )}
    </section>
  );
}
