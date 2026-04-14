import { createClient } from "npm:@supabase/supabase-js@2";
import { generatePitch } from "../../../packages/api/src/services/pitch.ts";
import { getRequiredPlan } from "../../../packages/api/src/services/entitlements.ts";
import { UsageLimitError, reserveUsageOrThrow } from "../../../packages/api/src/services/usage.ts";
import { buildSpendLog, estimateCostUsd } from "../../../packages/api/src/utils/spend.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: userData, error: userErr } = await authClient.auth.getUser();
  if (userErr || !userData.user) throw new Error("Unauthorized user");

  const { data: membership, error: membershipErr } = await admin
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (membershipErr || !membership) throw new Error("User is not an org member");
  return { admin, userId: userData.user.id };
}

function usageErrorToResponse(err: UsageLimitError, runId: string | null, endpoint: "discover" | "assess" | "pitch") {
  if (err.code === "not_entitled") {
    const details = err.details as Record<string, unknown>;
    const payload: Record<string, unknown> = {
      error: "not_entitled",
      plan: details.plan,
      required: details.required ?? getRequiredPlan(endpoint),
      run_id: runId,
    };
    if (endpoint !== "discover" && details.billing_status === "free_fallback") {
      payload.message = "billing_inactive_treated_as_free";
    }
    return json(403, payload);
  }

  const details = err.details as Record<string, unknown>;
  return json(429, {
    error: "quota_exceeded",
    metric: details.metric,
    limit: details.limit,
    used: details.used,
    remaining: details.remaining,
    run_id: runId,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json(200, { ok: true });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  let runId: string | null = null;
  const promptTokens = 500;
  const completionTokens = 400;
  const estimatedCost = estimateCostUsd(promptTokens + completionTokens);

  try {
    const body = await req.json();
    const orgId = String(body.org_id ?? "").trim();
    const grantId = String(body.grant_id ?? "").trim();
    if (!orgId) return json(400, { error: "org_id is required" });
    if (!grantId) return json(400, { error: "grant_id is required" });

    const { admin, userId } = await requireUserAndOrgMember(req.headers.get("Authorization"), orgId);

    const { data: runRow, error: runCreateErr } = await admin
      .from("runs")
      .insert({
        org_id: orgId,
        created_by: userId,
        run_type: "pitch",
        status: "running",
        started_at: new Date().toISOString(),
        input: body,
      })
      .select("id")
      .single();
    if (runCreateErr || !runRow) throw new Error(runCreateErr?.message ?? "Failed to create run");
    runId = runRow.id as string;

    try {
      await reserveUsageOrThrow(admin as never, {
        orgId,
        runType: "pitch",
        candidatesDelta: 0,
        costDelta: estimatedCost,
      });
    } catch (err) {
      if (err instanceof UsageLimitError) {
        await admin
          .from("runs")
          .update({
            status: "failed",
            finished_at: new Date().toISOString(),
            error: err.message,
          })
          .eq("id", runId);
        return usageErrorToResponse(err, runId, "pitch");
      }
      throw err;
    }

    const { data: grant, error: grantErr } = await admin
      .from("grants")
      .select("id,grant_name,sponsor_org,amount_text,focus_area,eligibility_summary,deadline_text,notes")
      .eq("org_id", orgId)
      .eq("id", grantId)
      .single();
    if (grantErr || !grant) throw new Error(grantErr?.message ?? "Grant not found");

    const pitch = generatePitch({
      id: grant.id as string,
      grant_name: grant.grant_name as string,
      sponsor_org: grant.sponsor_org as string | null,
      amount_text: grant.amount_text as string | null,
      focus_area: grant.focus_area as string | null,
      eligibility_summary: grant.eligibility_summary as string | null,
      deadline_text: grant.deadline_text as string | null,
    });

    const checklistText = pitch.checklist.map((item, idx) => `${idx + 1}. ${item}`).join("\n");
    const noteBlock = `\n\n---\nDraft Pitch:\n${pitch.draft_pitch}\n\nChecklist:\n${checklistText}`;
    const updatedNotes = `${grant.notes ?? ""}${noteBlock}`.trim();

    const { error: updateErr } = await admin
      .from("grants")
      .update({ notes: updatedNotes })
      .eq("id", grantId)
      .eq("org_id", orgId);
    if (updateErr) throw new Error(updateErr.message);

    await admin.from("run_items").insert({
      run_id: runId,
      grant_id: grantId,
      action: "pitched",
      meta: { checklist_count: pitch.checklist.length },
    });

    const spend = buildSpendLog({
      orgId,
      runId: runId ?? undefined,
      provider: "openai",
      model: "gpt-4o-mini",
      promptTokens,
      completionTokens,
      meta: { endpoint: "pitch", stub: true, grant_id: grantId },
    });
    await admin.from("llm_spend_logs").insert(spend);

    const output = {
      pitched_grant_id: grantId,
      checklist_count: pitch.checklist.length,
    };

    await admin
      .from("runs")
      .update({
        status: "succeeded",
        finished_at: new Date().toISOString(),
        output,
      })
      .eq("id", runId);

    return json(200, {
      run_id: runId,
      status: "succeeded",
      summary: output,
      draft_pitch: pitch.draft_pitch,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (runId) {
      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await admin
        .from("runs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          error: message,
        })
        .eq("id", runId);
    }
    return json(500, { error: message, run_id: runId });
  }
});
