import { EntitlementEndpoint, OrgPlan, getRequiredPlan } from "./entitlements";

export type RunType = EntitlementEndpoint;

type SupabaseLike = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: ReserveUsageRow[] | ReserveUsageRow | null; error: { message: string } | null }>;
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        order: (
          column: string,
          options?: { ascending?: boolean },
        ) => {
          limit: (n: number) => {
            maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
          };
        };
      };
    };
  };
};

export interface ReserveUsageParams {
  orgId: string;
  runType: RunType;
  candidatesDelta?: number;
  costDelta?: number;
}

export interface ReserveUsageRow {
  allowed: boolean;
  error_code: "not_entitled" | "quota_exceeded" | null;
  metric: string | null;
  plan: OrgPlan;
  billing_status: "active" | "free_fallback";
  limit_value: number | null;
  used_value: number | null;
  remaining_value: number | null;
  period_start: string;
  period_end: string;
  discover_runs_count: number;
  assess_runs_count: number;
  pitch_runs_count: number;
  candidates_inserted_count: number;
  llm_cost_usd_total: number;
}

export class UsageLimitError extends Error {
  constructor(
    public readonly code: "not_entitled" | "quota_exceeded",
    message: string,
    public readonly details: Record<string, unknown>,
  ) {
    super(message);
  }
}

function normalizeReserveRow(input: ReserveUsageRow[] | ReserveUsageRow | null): ReserveUsageRow | null {
  if (!input) return null;
  if (Array.isArray(input)) return input[0] ?? null;
  return input;
}

export async function reserveUsage(sb: SupabaseLike, params: ReserveUsageParams): Promise<ReserveUsageRow> {
  const { data, error } = await sb.rpc("reserve_usage", {
    _org_id: params.orgId,
    _run_type: params.runType,
    _candidates_delta: params.candidatesDelta ?? 0,
    _cost_delta: params.costDelta ?? 0,
  });
  if (error) throw new Error(`reserve_usage failed: ${error.message}`);

  const row = normalizeReserveRow(data);
  if (!row) throw new Error("reserve_usage returned no data");
  return row;
}

export async function reserveUsageOrThrow(sb: SupabaseLike, params: ReserveUsageParams): Promise<ReserveUsageRow> {
  const row = await reserveUsage(sb, params);

  if (row.allowed) return row;

  if (row.error_code === "not_entitled") {
    throw new UsageLimitError("not_entitled", "Plan is not entitled for endpoint", {
      plan: row.plan,
      required: getRequiredPlan(params.runType),
      billing_status: row.billing_status,
    });
  }

  throw new UsageLimitError("quota_exceeded", "Quota exceeded", {
    metric: row.metric,
    limit: row.limit_value,
    used: row.used_value,
    remaining: row.remaining_value,
    plan: row.plan,
  });
}

export async function applyUsageDelta(
  sb: SupabaseLike,
  orgId: string,
  candidatesDelta: number,
  costDelta: number,
): Promise<void> {
  const { error } = await sb.rpc("apply_usage_delta", {
    _org_id: orgId,
    _candidates_delta: candidatesDelta,
    _cost_delta: costDelta,
  });
  if (error) throw new Error(`apply_usage_delta failed: ${error.message}`);
}

export async function getCurrentUsageForOrg(sb: SupabaseLike, orgId: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await sb
    .from("org_usage_monthly")
    .select("*")
    .eq("org_id", orgId)
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to load usage: ${error.message}`);
  return data;
}
