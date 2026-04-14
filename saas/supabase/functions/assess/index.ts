import { createClient } from "npm:@supabase/supabase-js@2";
import { assessGrants } from "../../../packages/api/src/services/assess.ts";
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
  const promptTokens = 600;
  const completionTokens = 250;
  const estimatedCost = estimateCostUsd(promptTokens + completionTokens);

  try {
    const body = await req.json();
    const orgId = String(body.org_id ?? "").trim();
    if (!orgId) return json(400, { error: "org_id is required" });

    const { admin, userId } = await requireUserAndOrgMember(req.headers.get("Authorization"), orgId);

    const { data: runRow, error: runCreateErr } = await admin
      .from("runs")
      .insert({
        org_id: orgId,
        created_by: userId,
        run_type: "assess",
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
        runType: "assess",
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
        return usageErrorToResponse(err, runId, "assess");
      }
      throw err;
    }

    const { data: grants, error: grantsErr } = await admin
      .from("grants")
      .select("id,grant_name,sponsor_org,focus_area,eligibility_summary,notes,amount_text")
      .eq("org_id", orgId);
    if (grantsErr) throw new Error(grantsErr.message);

    const results = assessGrants((grants ?? []) as Array<{
      id: string;
      grant_name: string;
      sponsor_org?: string | null;
      focus_area?: string | null;
      eligibility_summary?: string | null;
      notes?: string | null;
      amount_text?: string | null;
    }>);

    for (const result of results) {
      const { error: updateErr } = await admin
        .from("grants")
        .update({
          priority_score: result.priority_score,
          business_match_pct: result.business_match_pct,
          woc_focus_rating: result.woc_focus_rating,
          leadership_dev_alignment: result.leadership_dev_alignment,
          community_impact_score: result.community_impact_score,
          llc_priority_score: result.llc_priority_score,
          foundation_priority_score: result.foundation_priority_score,
          overall_strategic_value: result.overall_strategic_value,
        })
        .eq("id", result.grant_id)
        .eq("org_id", orgId);
      if (updateErr) throw new Error(updateErr.message);
    }

    if (results.length > 0) {
      const { error: itemsErr } = await admin.from("run_items").insert(
        results.map((r) => ({
          run_id: runId,
          grant_id: r.grant_id,
          action: "assessed",
          meta: {
            priority_score: r.priority_score,
            overall_strategic_value: r.overall_strategic_value,
          },
        })),
      );
      if (itemsErr) throw new Error(itemsErr.message);
    }

    const spend = buildSpendLog({
      orgId,
      runId: runId ?? undefined,
      provider: "openai",
      model: "gpt-4o-mini",
      promptTokens,
      completionTokens,
      meta: { endpoint: "assess", stub: true, grants: results.length },
    });
    await admin.from("llm_spend_logs").insert(spend);

    const output = {
      assessed_count: results.length,
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
