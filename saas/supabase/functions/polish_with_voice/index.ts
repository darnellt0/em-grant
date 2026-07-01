// polish_with_voice — rewrites a drafted application answer in an org's
// signature voice (e.g. EM's "Joy" agent) without changing the substance.
//
// The voice lives in public.org_voice_profiles — a snapshot of the OpenClaw
// agent's workspace files (identity, voice samples, audience). The agent runs
// on localhost so the SaaS can never reach it directly; the snapshot table is
// the bridge (Pattern A: agents push, SaaS reads).
//
// Input:  { org_id, question_id, voice_name? }   (voice_name defaults to "Joy")
// Output: { ok: true, answer, voice_name }

import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const MODEL = "claude-sonnet-4-6";

// Keep the combined voice-context under control so the system prompt stays sane.
const MAX_SECTION_CHARS = 4000;

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
  if (token === SUPABASE_SERVICE_ROLE_KEY) {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    return { admin };
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
  return { admin };
}

function clip(s: string | null, n = MAX_SECTION_CHARS): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "\n[...truncated]" : s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json(200, { ok: true });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const body = await req.json();
    const orgId = String(body.org_id ?? "").trim();
    const questionId = String(body.question_id ?? "").trim();
    const voiceName = String(body.voice_name ?? "Joy").trim();
    if (!orgId) return json(400, { error: "org_id is required" });
    if (!questionId) return json(400, { error: "question_id is required" });

    const { admin } = await requireUserAndOrgMember(req.headers.get("Authorization"), orgId);

    // Load the question + its current draft
    const { data: qRow, error: qErr } = await admin
      .from("application_questions").select("*").eq("id", questionId).eq("org_id", orgId).single();
    if (qErr || !qRow) return json(404, { error: "Question not found" });
    const currentAnswer = (qRow.draft_answer as string | null) ?? "";
    if (!currentAnswer.trim()) {
      return json(400, { error: "no_draft", message: "Nothing to polish — draft an answer first." });
    }

    // Load the voice profile snapshot
    const { data: voice, error: vErr } = await admin
      .from("org_voice_profiles").select("*")
      .eq("org_id", orgId).eq("voice_name", voiceName).maybeSingle();
    if (vErr || !voice) {
      return json(404, {
        error: "voice_profile_missing",
        message: `No '${voiceName}' voice profile found for this org. Sync the agent's workspace files into org_voice_profiles first.`,
      });
    }

    const voiceContext = [
      voice.identity_md ? `WHO ${voiceName.toUpperCase()} IS:\n${clip(voice.identity_md as string, 2000)}` : "",
      voice.voice_samples ? `VOICE SAMPLES (match this register, rhythm, and word choice):\n${clip(voice.voice_samples as string)}` : "",
      voice.audience_md ? `AUDIENCE NOTES:\n${clip(voice.audience_md as string, 2000)}` : "",
      voice.guidelines_extra ? `EXTRA GUIDELINES:\n${clip(voice.guidelines_extra as string, 1000)}` : "",
    ].filter(Boolean).join("\n\n");

    const system = `You are ${voiceName}, the writing voice of this organization. Below is everything that defines your voice.

${voiceContext}

TASK: Rewrite the provided grant-application answer in YOUR voice. Rules:
- Do NOT change the substance: every fact, number, program name, and claim stays exactly as-is.
- Do NOT change the length by more than 10% in either direction.
- DO change rhythm, word choice, sentence structure, and warmth to match the voice samples.
- Return ONLY the rewritten answer. No preamble, no commentary, no markdown headers.`;

    const user = `QUESTION BEING ANSWERED:
${qRow.question as string}

CURRENT ANSWER (rewrite this in your voice):
${currentAnswer}`;

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system,
      messages: [{ role: "user", content: user }],
    });

    const polished = response.content
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { type: string }) => (b as { type: "text"; text: string }).text)
      .join("")
      .trim();

    if (!polished) throw new Error("Empty response from LLM");

    await admin.from("application_questions").update({
      draft_answer: polished,
      scored_by: `polished-${voiceName}`,
      last_regen_at: new Date().toISOString(),
      regen_feedback: `Polished with ${voiceName}'s voice`,
      status: "draft",
    }).eq("id", questionId).eq("org_id", orgId);

    // Cost log
    const cost = (response.usage.input_tokens * 0.000003) + (response.usage.output_tokens * 0.000015);
    await admin.from("llm_spend_logs").insert({
      org_id: orgId,
      provider: "anthropic",
      model: MODEL,
      prompt_tokens: response.usage.input_tokens,
      completion_tokens: response.usage.output_tokens,
      total_tokens: response.usage.input_tokens + response.usage.output_tokens,
      cost_usd: cost,
      meta: { endpoint: "polish_with_voice", question_id: questionId, voice_name: voiceName },
    });

    return json(200, { ok: true, answer: polished, voice_name: voiceName });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return json(500, { error: message });
  }
});
