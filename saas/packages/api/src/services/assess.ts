import type Anthropic from "npm:@anthropic-ai/sdk";
import type { OrgProfile } from "../types/org-profile.ts";
import { profileToContext } from "../types/org-profile.ts";
import { callClaude } from "./llm.ts";

export interface GrantForAssessment {
  id: string;
  grant_name: string;
  sponsor_org?: string | null;
  focus_area?: string | null;
  eligibility_summary?: string | null;
  notes?: string | null;
  amount_text?: string | null;
}

export interface GrantAssessmentResult {
  grant_id: string;
  priority_score: number;
  business_match_pct: number;
  woc_focus_rating: number;
  leadership_dev_alignment: number;
  community_impact_score: number;
  llc_priority_score: number;
  foundation_priority_score: number;
  overall_strategic_value: number;
}

interface LLMAssessmentRow {
  grant_id: string;
  priority_score: number;
  eligibility_confidence: number;
  mission_alignment: number;
  program_fit: number;
  community_impact: number;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function rowToResult(row: LLMAssessmentRow): GrantAssessmentResult {
  const priority = clamp(row.priority_score, 0, 100);
  const eligibility = clamp(row.eligibility_confidence, 0, 100);
  const mission = clamp(row.mission_alignment, 1, 10);
  const programFit = clamp(row.program_fit, 1, 10);
  const community = clamp(row.community_impact, 1, 10);

  const llcScore = clamp(priority * 0.45 + eligibility * 0.35 + mission * 2, 0, 100);
  const foundationScore = clamp(priority * 0.35 + community * 4 + programFit * 3, 0, 100);
  const overall = clamp((llcScore + foundationScore) / 2, 0, 100);

  return {
    grant_id: row.grant_id,
    priority_score: priority,
    business_match_pct: eligibility,
    woc_focus_rating: mission,
    leadership_dev_alignment: programFit,
    community_impact_score: community,
    llc_priority_score: llcScore,
    foundation_priority_score: foundationScore,
    overall_strategic_value: overall,
  };
}

export async function assessGrantsWithLLM(
  grants: GrantForAssessment[],
  profile: OrgProfile,
  anthropic: Anthropic,
): Promise<{ results: GrantAssessmentResult[]; inputTokens: number; outputTokens: number }> {
  if (grants.length === 0) {
    return { results: [], inputTokens: 0, outputTokens: 0 };
  }

  const orgContext = profileToContext(profile);
  const grantList = grants
    .map(
      (g, i) =>
        `${i + 1}. ID: ${g.id}\n` +
        `   Name: ${g.grant_name}\n` +
        `   Funder: ${g.sponsor_org ?? "Unknown"}\n` +
        `   Focus: ${g.focus_area ?? "Not specified"}\n` +
        `   Eligibility: ${g.eligibility_summary ?? "Not specified"}\n` +
        `   Amount: ${g.amount_text ?? "Not specified"}`,
    )
    .join("\n\n");

  const system = `You are a grant analyst. Score each grant opportunity for relevance and fit to the given organization.

Return a JSON array. Each object must have:
- grant_id (string, the exact ID provided)
- priority_score (0-100): overall priority — how urgently the org should pursue this
- eligibility_confidence (0-100): how confident you are the org is eligible based on entity type and profile
- mission_alignment (1-10): how well the grant's focus aligns with the org's mission
- program_fit (1-10): how well the org's actual programs match what the funder wants to fund
- community_impact (1-10): expected community impact if this org wins the grant

Return ONLY the JSON array. No explanation, no markdown.`;

  const user = `Organization:
${orgContext}

Grants to assess:
${grantList}`;

  const result = await callClaude(anthropic, { system, user, maxTokens: 2048 });

  let rows: LLMAssessmentRow[] = [];
  try {
    const cleaned = result.text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    rows = Array.isArray(parsed) ? parsed : [];
  } catch {
    // Fall back to defaults if parse fails
    rows = grants.map((g) => ({
      grant_id: g.id,
      priority_score: 50,
      eligibility_confidence: 50,
      mission_alignment: 5,
      program_fit: 5,
      community_impact: 5,
    }));
  }

  const idToRow = new Map(rows.map((r) => [r.grant_id, r]));
  const results = grants.map((g) => {
    const row = idToRow.get(g.id) ?? {
      grant_id: g.id,
      priority_score: 50,
      eligibility_confidence: 50,
      mission_alignment: 5,
      program_fit: 5,
      community_impact: 5,
    };
    return rowToResult(row);
  });

  return { results, inputTokens: result.inputTokens, outputTokens: result.outputTokens };
}

export { assessGrantsWithLLM as assessGrants };
