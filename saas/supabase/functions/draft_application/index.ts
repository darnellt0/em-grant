// draft_application — generates draft answers to grant application questions.
//
// Two modes:
//   1. Initial draft: caller passes grant_id (and optionally a custom questions[]).
//      If application_questions is empty for this grant we insert a default set
//      (or the provided custom set) and draft answers for each.
//   2. Regenerate one answer: caller passes question_id + optional feedback.
//      We re-draft just that one question's answer and update the row.
//
// Auth: same JWT + org-membership gating as pitch.
// Cost: one Anthropic call per question on initial draft (Sonnet), one per regen.

import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";

interface OrgProfile {
  org_id: string;
  org_name: string | null;
  mission: string | null;
  entity_type: "nonprofit" | "llc" | "hybrid" | "other";
  geography: string | null;
  focus_areas: string[] | null;
  eligibility_notes: string | null;
  search_keywords: string[] | null;
}

function profileToContext(p: OrgProfile): string {
  const lines: string[] = [
    `Organization: ${p.org_name ?? "Unknown"}`,
    `Entity type: ${p.entity_type}`,
    `Mission: ${p.mission ?? "Not specified"}`,
    `Geography: ${p.geography ?? "Not specified"}`,
  ];
  if (p.focus_areas?.length) lines.push(`Focus areas: ${p.focus_areas.join(", ")}`);
  if (p.eligibility_notes) lines.push(`Eligibility notes: ${p.eligibility_notes}`);
  return lines.join("\n");
}

// Default question template — the 80% that grant applications ask, in priority order.
// Each tuple: [question text, target word count]
const DEFAULT_QUESTIONS: Array<{ q: string; words: number }> = [
  { q: "Briefly describe your organization's mission and the population you serve.", words: 200 },
  { q: "What problem or unmet need is your proposed project addressing?", words: 300 },
  { q: "Describe the proposed project, including its core activities and timeline.", words: 500 },
  { q: "Who is the target population for this project, and how many will be served?", words: 200 },
  { q: "What is your organization's approach or methodology? Why is it well-suited to this work?", words: 400 },
  { q: "What outcomes do you expect, and how will you measure them?", words: 300 },
  { q: "Describe your organization's leadership and key team members (with brief bios).", words: 300 },
  { q: "What is your organization's track record? Cite specific past results where possible.", words: 300 },
  { q: "Provide a brief budget summary — total cost, this grant request, and other funding sources.", words: 250 },
  { q: "How will the project be sustained after the grant period ends?", words: 250 },
  { q: "Why is this funder a particularly strong fit for this project?", words: 200 },
];

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const MODEL = "claude-sonnet-4-6";

function json(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

async function requireUserAndOrgMember(authHeader: string | null, orgId: string) {
  if (!authHeader) throw new Error("Missing Authorization header");
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  // Service-role bypass for trusted internal callers (e.g. Dorothy's helper
  // script when auto-drafting after a Pursue verdict).
  if (token === SUPABASE_SERVICE_ROLE_KEY) {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    return { admin, userId: null as string | null, isService: true };
  }

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: userData, error: userErr } = await authClient.auth.getUser();
  if (userErr || !userData.user) throw new Error("Unauthorized user");
  const { data: membership, error: membershipErr } = await admin
    .from("org_members").select("role").eq("org_id", orgId).eq("user_id", userData.user.id).maybeSingle();
  if (membershipErr || !membership) throw new Error("User is not an org member");
  return { admin, userId: userData.user.id, isService: false };
}

interface GrantContext {
  id: string;
  grant_name: string;
  sponsor_org: string | null;
  amount_text: string | null;
  focus_area: string | null;
  eligibility_summary: string | null;
  deadline_text: string | null;
  notes: string | null;  // contains existing pitch
}

function extractPitchFromNotes(notes: string | null): string | null {
  if (!notes) return null;
  const marker = "---\nDraft Pitch:";
  const idx = notes.indexOf(marker);
  if (idx === -1) return null;
  const after = notes.slice(idx + marker.length).trim();
  // Try parse JSON object
  const start = after.indexOf("{");
  const end = after.lastIndexOf("}");
  if (start !== -1 && end !== -1) {
    try {
      const parsed = JSON.parse(after.slice(start, end + 1)) as { draft_pitch?: string };
      if (parsed.draft_pitch) return parsed.draft_pitch;
    } catch { /* fall through */ }
  }
  return after;
}

// Gap 3: detect when a question is about budget/financials so we can splice
// in Angela's curated financial facts instead of letting the LLM invent.
function isBudgetQuestion(question: string): boolean {
  const q = question.toLowerCase();
  return /\bbudget\b|\bfinanc(e|ial|ials)\b|\brevenue\b|\bexpens(e|es)\b|\bP&L\b|\baudit(ed)?\b|\bsustainab/.test(q);
}

function financialsToContext(financials: Record<string, unknown> | null): string | null {
  if (!financials || typeof financials !== "object") return null;
  const lines: string[] = [];
  if (financials.annual_revenue != null) lines.push(`Annual revenue: $${financials.annual_revenue}`);
  if (financials.fiscal_year_start) lines.push(`Fiscal year start: ${financials.fiscal_year_start}`);
  if (financials.typical_ask_range) lines.push(`Typical grant ask range: ${financials.typical_ask_range}`);
  if (financials.audited != null) lines.push(`Audited financials: ${financials.audited ? "yes" : "no"}`);
  if (financials.expense_categories && typeof financials.expense_categories === "object") {
    const cats = Object.entries(financials.expense_categories as Record<string, unknown>)
      .map(([k, v]) => `  • ${k}: $${v}`)
      .join("\n");
    if (cats) lines.push(`Expense categories:\n${cats}`);
  }
  if (financials.current_funding_pipeline) lines.push(`Current funding pipeline: ${financials.current_funding_pipeline}`);
  if (financials.notes) lines.push(`Notes: ${financials.notes}`);
  return lines.length > 0 ? lines.join("\n") : null;
}

async function draftSingleAnswer(
  client: Anthropic,
  args: {
    question: string;
    wordTarget: number | null;
    orgContext: string;
    grant: GrantContext;
    pitchText: string | null;
    feedback?: string;
    financialsContext?: string | null;
  },
): Promise<{ answer: string; inputTokens: number; outputTokens: number }> {
  const { question, wordTarget, orgContext, grant, pitchText, feedback, financialsContext } = args;

  const targetClause = wordTarget
    ? `Target length: approximately ${wordTarget} words. Stay within ±20% of this target.`
    : "Target length: 200-400 words.";

  const pitchClause = pitchText
    ? `\nFor consistency, here is the existing draft pitch for this grant (keep your voice, framing, and key facts consistent with it):\n${pitchText}`
    : "";

  // Gap 3: when the question is budget-related and Angela has provided
  // org financial facts, inject them as ground truth so the model uses
  // real numbers instead of plausible-sounding fabrications.
  const financialsClause = financialsContext && isBudgetQuestion(question)
    ? `\n\nORGANIZATION FINANCIAL FACTS (use these exact numbers — do NOT invent):\n${financialsContext}`
    : "";

  const feedbackClause = feedback && feedback.trim()
    ? `\n\nUSER FEEDBACK ON PRIOR DRAFT (apply to the new answer): ${feedback.trim()}`
    : "";

  const system = `You are an expert grant writer drafting an answer to a single grant application question. Your output is going to be reviewed by the organization's leadership and lightly edited before submission. Write in clean, specific prose — no placeholder brackets, no generic filler.

${targetClause}

Voice: first-person plural ("we", "our") when speaking for the organization. Concrete and specific — name programs, populations, methodologies. Avoid jargon. Avoid empty phrases like "we are committed to" or "we strive to" unless followed by specifics.

Return ONLY the answer text. No preamble, no markdown headers, no labels.${feedbackClause}`;

  const user = `ORGANIZATION:
${orgContext}

GRANT OPPORTUNITY:
- Name: ${grant.grant_name}
- Funder: ${grant.sponsor_org ?? "Unknown"}
- Amount: ${grant.amount_text ?? "Not specified"}
- Focus area: ${grant.focus_area ?? "Not specified"}
- Eligibility: ${grant.eligibility_summary ?? "Not specified"}
- Deadline: ${grant.deadline_text ?? "Not specified"}${pitchClause}${financialsClause}

QUESTION TO ANSWER:
${question}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system,
    messages: [{ role: "user", content: user }],
  });

  const text = response.content
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { type: string }) => (b as { type: "text"; text: string }).text)
    .join("")
    .trim();

  return {
    answer: text,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json(200, { ok: true });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const body = await req.json();
    const orgId = String(body.org_id ?? "").trim();
    if (!orgId) return json(400, { error: "org_id is required" });

    const { admin } = await requireUserAndOrgMember(req.headers.get("Authorization"), orgId);

    // Profile context
    const { data: profileRow } = await admin
      .from("org_profiles").select("*").eq("org_id", orgId).maybeSingle();
    if (!profileRow) {
      return json(400, {
        error: "org_profile_missing",
        message: "Set up your organization profile in Settings first.",
      });
    }
    const profile = profileRow as OrgProfile;
    const orgContext = profileToContext(profile);
    // Gap 3: Angela's financial facts (NULL-safe; only used on budget questions)
    const financialsContext = financialsToContext(
      (profileRow as Record<string, unknown>).financials as Record<string, unknown> | null,
    );
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    // ─────────────────────────────────────────────────────────────────────
    // MODE 1: Regenerate one specific question's answer
    // ─────────────────────────────────────────────────────────────────────
    if (body.mode === "regenerate" || body.question_id) {
      const questionId = String(body.question_id ?? "").trim();
      const feedback = typeof body.feedback === "string" ? body.feedback.slice(0, 1000) : "";
      if (!questionId) return json(400, { error: "question_id is required for regenerate mode" });

      const { data: qRow, error: qErr } = await admin
        .from("application_questions").select("*").eq("id", questionId).eq("org_id", orgId).single();
      if (qErr || !qRow) return json(404, { error: "Question not found" });

      const { data: grant, error: grantErr } = await admin
        .from("grants").select("id,grant_name,sponsor_org,amount_text,focus_area,eligibility_summary,deadline_text,notes")
        .eq("id", qRow.grant_id).eq("org_id", orgId).single();
      if (grantErr || !grant) return json(404, { error: "Grant not found" });

      const pitchText = extractPitchFromNotes(grant.notes as string | null);

      const { answer } = await draftSingleAnswer(anthropic, {
        question: qRow.question as string,
        wordTarget: qRow.word_target as number | null,
        orgContext,
        grant: grant as GrantContext,
        pitchText,
        financialsContext,
        feedback,
      });

      await admin.from("application_questions").update({
        draft_answer: answer,
        scored_by: "llm",
        last_regen_at: new Date().toISOString(),
        regen_feedback: feedback || null,
        status: "draft",
      }).eq("id", questionId).eq("org_id", orgId);

      return json(200, { ok: true, question_id: questionId, answer });
    }

    // ─────────────────────────────────────────────────────────────────────
    // MODE 2: Initial draft for a grant (default = all 11 template questions)
    // ─────────────────────────────────────────────────────────────────────
    const grantId = String(body.grant_id ?? "").trim();
    if (!grantId) return json(400, { error: "grant_id is required for initial draft" });

    const { data: grant, error: grantErr } = await admin
      .from("grants").select("id,grant_name,sponsor_org,amount_text,focus_area,eligibility_summary,deadline_text,notes")
      .eq("id", grantId).eq("org_id", orgId).single();
    if (grantErr || !grant) return json(404, { error: "Grant not found" });

    // Check if questions already exist — don't double-insert
    const { data: existing } = await admin
      .from("application_questions").select("id").eq("grant_id", grantId).eq("org_id", orgId);
    if (existing && existing.length > 0) {
      return json(409, {
        error: "already_drafted",
        message: `${existing.length} questions already exist for this grant. Open the application page to edit them, or delete them first to regenerate from scratch.`,
        question_count: existing.length,
      });
    }

    // Optional: caller can pass custom questions array
    let questionsToUse = DEFAULT_QUESTIONS;
    if (Array.isArray(body.questions) && body.questions.length > 0) {
      questionsToUse = (body.questions as unknown[])
        .filter((q): q is { q?: string; words?: number } | string => q != null)
        .map((q, i) => {
          if (typeof q === "string") return { q, words: 250 };
          const text = String((q as { q?: string }).q ?? "").trim();
          const w = Number((q as { words?: number }).words ?? 250);
          return text ? { q: text, words: w > 0 ? w : 250 } : { q: `Question ${i + 1}`, words: 250 };
        })
        .filter((x): x is { q: string; words: number } => Boolean(x.q));
    }

    const pitchText = extractPitchFromNotes(grant.notes as string | null);

    // Generate all answers sequentially (parallel calls risk rate limits; sequential is safer).
    const inserts: Array<{
      grant_id: string; org_id: string; ordering: number; question: string;
      word_target: number; draft_answer: string; status: string; scored_by: string;
    }> = [];

    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (let i = 0; i < questionsToUse.length; i++) {
      const { q, words } = questionsToUse[i];
      try {
        const { answer, inputTokens, outputTokens } = await draftSingleAnswer(anthropic, {
          question: q,
          wordTarget: words,
          orgContext,
          grant: grant as GrantContext,
          pitchText,
          financialsContext,
        });
        totalInputTokens += inputTokens;
        totalOutputTokens += outputTokens;
        inserts.push({
          grant_id: grantId,
          org_id: orgId,
          ordering: i,
          question: q,
          word_target: words,
          draft_answer: answer,
          status: "draft",
          scored_by: "llm",
        });
      } catch (err) {
        // On failure, still insert the question row (so user can manually fill or retry)
        const msg = err instanceof Error ? err.message : "unknown error";
        inserts.push({
          grant_id: grantId,
          org_id: orgId,
          ordering: i,
          question: q,
          word_target: words,
          draft_answer: `[Auto-draft failed: ${msg}. Click Regenerate to retry.]`,
          status: "draft",
          scored_by: "llm",
        });
      }
    }

    const { error: insertErr } = await admin.from("application_questions").insert(inserts);
    if (insertErr) throw new Error(`Insert failed: ${insertErr.message}`);

    // Log to llm_spend_logs for cost tracking
    const cost = (totalInputTokens * 0.000003) + (totalOutputTokens * 0.000015);
    await admin.from("llm_spend_logs").insert({
      org_id: orgId,
      provider: "anthropic",
      model: MODEL,
      prompt_tokens: totalInputTokens,
      completion_tokens: totalOutputTokens,
      total_tokens: totalInputTokens + totalOutputTokens,
      cost_usd: cost,
      meta: { endpoint: "draft_application", grant_id: grantId, question_count: inserts.length },
    });

    return json(200, {
      ok: true,
      grant_id: grantId,
      question_count: inserts.length,
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
      cost_usd: cost,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return json(500, { error: message });
  }
});
