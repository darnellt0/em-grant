import { createClient } from "npm:@supabase/supabase-js@2";
import { buildDiscoverStub } from "../../../packages/api/src/services/discover.ts";
import { getRequiredPlan } from "../../../packages/api/src/services/entitlements.ts";
import { UsageLimitError, applyUsageDelta, reserveUsageOrThrow } from "../../../packages/api/src/services/usage.ts";
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
  const promptTokens = 800;
  const completionTokens = 300;
  const estimatedCost = estimateCostUsd(promptTokens + completionTokens);
  const estimatedCandidates = 2;

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
        run_type: "discover",
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
        runType: "discover",
        candidatesDelta: estimatedCandidates,
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
        return usageErrorToResponse(err, runId, "discover");
      }
      throw err;
    }

    const { data: existing } = await admin
      .from("grants")
      .select("grant_name,sponsor_org")
      .eq("org_id", orgId)
      .limit(500);

    const candidates = buildDiscoverStub({
      orgId,
      query: body.query,
      existingGrants: (existing ?? []) as Array<{ grant_name?: string; sponsor_org?: string }>,
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
            discovery_source: c.discovery_source ?? "discover_stub",
            source_reliability_score: c.source_reliability_score ?? 6,
            status: c.status ?? "open",
            notes: c.notes ?? null,
          })),
        )
        .select("id");

      if (insertErr) throw new Error(insertErr.message);
      inserted = (insertedRows ?? []) as Array<{ id: string }>;
    }

    if (inserted.length > 0) {
      const { error: runItemsErr } = await admin.from("run_items").insert(
        inserted.map((g) => ({
          run_id: runId,
          grant_id: g.id,
          action: "inserted",
          meta: { source: "discover_stub" },
        })),
      );
      if (runItemsErr) throw new Error(runItemsErr.message);
    }

    const spend = buildSpendLog({
      orgId,
      runId: runId ?? undefined,
      provider: "openai",
      model: "gpt-4o-mini",
      promptTokens,
      completionTokens,
      meta: { endpoint: "discover", stub: true },
    });
    await admin.from("llm_spend_logs").insert(spend);

    const candidateDelta = inserted.length - estimatedCandidates;
    const costDelta = Number(spend.cost_usd) - estimatedCost;
    if (candidateDelta !== 0 || costDelta !== 0) {
      await applyUsageDelta(admin as never, orgId, candidateDelta, costDelta);
    }

    const output = {
      inserted_count: inserted.length,
      candidates_count: candidates.length,
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
