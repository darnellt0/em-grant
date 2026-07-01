import Anthropic from "npm:@anthropic-ai/sdk";

export function makeAnthropicClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey });
}

export async function callClaude(
  client: Anthropic,
  opts: {
    model?: string;
    system: string;
    user: string;
    maxTokens?: number;
  },
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const model = opts.model ?? "claude-haiku-4-5-20251001";
  const response = await client.messages.create({
    model,
    max_tokens: opts.maxTokens ?? 2048,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });

  const text =
    response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("") ?? "";

  return {
    text,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

export function estimateActualCostUsd(
  inputTokens: number,
  outputTokens: number,
  model = "claude-haiku-4-5-20251001",
): number {
  // Haiku 4.5: $1.00/M input, $5.00/M output
  // Sonnet 4.6: $3.00/M input, $15.00/M output
  const rates: Record<string, [number, number]> = {
    "claude-haiku-4-5-20251001": [0.000001, 0.000005],
    "claude-sonnet-4-6": [0.000003, 0.000015],
  };
  const [inRate, outRate] = rates[model] ?? rates["claude-haiku-4-5-20251001"];
  return inputTokens * inRate + outputTokens * outRate;
}
