import { createClient } from "npm:@supabase/supabase-js@2";
import { discoverGrants } from "../../../packages/api/src/services/discover.ts";
import { getRequiredPlan } from "../../../packages/api/src/services/entitlements.ts";
import { UsageLimitError, applyUsageDelta, reserveUsageOrThrow } from "../../../packages/api/src/services/usage.ts";
import { buildSpendLog } from "../../../packages/api/src/utils/spend.ts";
import { estimateActualCostUsd, makeAnthropicClient } from "../../../packages/api/src/services/llm.ts";
import type { OrgProfile } from "../../../packages/api/src/types/org-profile.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

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

  try {
    const body = await req.json();
    const orgId = String(body.org_id ?? "").trim();
    if (!orgId) return json(400, { error: "org_id is required" });

    const { admin, userId } = await requireUserAndOrgMember(req.headers.get("Authorization"), orgId);

    // Fetch org profile — required for real discovery
    const { data: profileRow } = await admin
      .from("org_profiles")
      .select("*")
      .eq("org_id", orgId)
      .maybeSingle();

    if (!profileRow) {
      return json(400, {
        error: "org_profile_missing",
        message: "Set up your organization profile in Settings before running discovery.",
      });
    }
    const profile = profileRow as OrgProfile;

    const { data: runRow, error: runCreateErr } = await admin
      .from("runs")
      .insert({
        org_id: orgId,
        created_by: userId,
        run_type: "discover",
        status: "running",
        started_at: new Date().toISOString(),
        input: body,
      })
      .select("id")
      .single();
    if (runCreateErr || !runRow) throw new Error(runCreateErr?.message ?? "Failed to create run");
    runId = runRow.id as string;

    // Reserve estimated usage (2 candidates, ~$0.002 cost)
    const estimatedCandidates = 2;
    const estimatedCost = 0.002;
    try {
      await reserveUsageOrThrow(admin as never, {
        orgId,
        runType: "discover",
        candidatesDelta: estimatedCandidates,
        costDelta: estimatedCost,
      });
    } catch (err) {
      if (err instanceof UsageLimitError) {
        await admin.from("runs").update({ status: "failed", finished_at: new Date().toISOString(), error: err.message }).eq("id", runId);
        return usageErrorToResponse(err, runId, "discover");
      }
      throw err;
    }

    const { data: existing } = await admin
      .from("grants")
      .select("grant_name,sponsor_org")
      .eq("org_id", orgId)
      .limit(500);

    const anthropic = makeAnthropicClient(ANTHROPIC_API_KEY);
    const { candidates, inputTokens, outputTokens } = await discoverGrants({
      orgId,
      profile,
      query: body.query,
      existingGrants: (existing ?? []) as Array<{ grant_name?: string; sponsor_org?: string }>,
      anthropic,
    });

    let inserted: Array<{ id: string }> = [];
    if (candidates.length > 0) {
      const { data: insertedRows, error: insertErr } = await admin
        .from("grants")
        .insert(
          candidates.map((c) => ({
            org_id: orgId,
            grant_name: c.grant_name,
            sponsor_org: c.sponsor_org,
            amount_text: c.amount_text ?? null,
            deadline_text: c.deadline_text ?? null,
            focus_area: c.focus_area ?? null,
            eligibility_summary: c.eligibility_summary ?? null,
            application_link: c.application_link ?? null,
            geographic_scope: c.geographic_scope ?? null,
            funder_type: c.funder_type ?? null,
            discovery_source: c.discovery_source ?? "grants_gov",
            source_reliability_score: c.source_reliability_score ?? 8,
            status: c.status ?? "open",
            notes: c.notes ?? null,
          })),
        )
        .select("id");

      if (insertErr) throw new Error(insertErr.message);
      inserted = (insertedRows ?? []) as Array<{ id: string }>;
    }

    if (inserted.length > 0) {
      await admin.from("run_items").insert(
        inserted.map((g) => ({
          run_id: runId,
          grant_id: g.id,
          action: "inserted",
          meta: { source: "grants_gov" },
        })),
      );
    }

    const actualCost = estimateActualCostUsd(inputTokens, outputTokens);
    const spend = buildSpendLog({
      orgId,
      runId: runId ?? undefined,
      provider: "anthropic",
      model: "claude-haiku-4-5-20251001",
      promptTokens: inputTokens,
      completionTokens: outputTokens,
      meta: { endpoint: "discover" },
    });
    await admin.from("llm_spend_logs").insert({ ...spend, cost_usd: actualCost });

    const candidateDelta = inserted.length - estimatedCandidates;
    const costDelta = actualCost - estimatedCost;
    if (candidateDelta !== 0 || costDelta !== 0) {
      await applyUsageDelta(admin as never, orgId, candidateDelta, costDelta);
    }

    const output = { inserted_count: inserted.length, candidates_count: candidates.length };
    await admin.from("runs").update({ status: "succeeded", finished_at: new Date().toISOString(), output }).eq("id", runId);

    return json(200, { run_id: runId, status: "succeeded", summary: output });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (runId) {
      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await admin.from("runs").update({ status: "failed", finished_at: new Date().toISOString(), error: message }).eq("id", runId);
    }
    return json(500, { error: message, run_id: runId });
  }
});
