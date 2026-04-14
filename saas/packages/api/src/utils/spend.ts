export interface SpendLogInput {
  orgId: string;
  runId?: string;
  provider: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  costUsd?: number;
  meta?: Record<string, unknown>;
}

export interface SpendLogRow {
  org_id: string;
  run_id?: string;
  provider: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  meta: Record<string, unknown>;
}

export function estimateCostUsd(totalTokens: number, ratePer1k = 0.0005): number {
  const raw = (totalTokens / 1000) * ratePer1k;
  return Math.round(raw * 10000) / 10000;
}

export function buildSpendLog(input: SpendLogInput): SpendLogRow {
  const promptTokens = input.promptTokens ?? 0;
  const completionTokens = input.completionTokens ?? 0;
  const totalTokens = promptTokens + completionTokens;
  const costUsd = input.costUsd ?? estimateCostUsd(totalTokens);

  return {
    org_id: input.orgId,
    run_id: input.runId,
    provider: input.provider,
    model: input.model,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokens,
    cost_usd: costUsd,
    meta: input.meta ?? {},
  };
}
