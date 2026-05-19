import type Anthropic from "npm:@anthropic-ai/sdk";
import { dedupeGrants } from "../utils/dedupe.ts";
import type { OrgProfile } from "../types/org-profile.ts";
import { profileToContext, profileToSearchKeywords } from "../types/org-profile.ts";
import { searchGrantsGov, formatOpportunitiesForLLM } from "./grants-gov.ts";
import { callClaude } from "./llm.ts";

export interface DiscoverInput {
  orgId: string;
  profile: OrgProfile;
  query?: string;
  existingGrants?: Array<{ grant_name?: string | null; sponsor_org?: string | null }>;
  anthropic: Anthropic;
}

export interface CandidateGrant {
  grant_name: string;
  sponsor_org: string;
  amount_text?: string;
  deadline_text?: string;
  focus_area?: string;
  eligibility_summary?: string;
  application_link?: string;
  geographic_scope?: string;
  funder_type?: string;
  discovery_source?: string;
  source_reliability_score?: number;
  status?: "open" | "watch";
  notes?: string;
}

function toStringValue(value: unknown): string {
  return String(value ?? "").trim();
}

function parseJsonLike(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown[] }).items)) {
    return (raw as { items: unknown[] }).items;
  }
  if (typeof raw !== "string") return [];

  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as { items?: unknown[] }).items)) {
      return (parsed as { items: unknown[] }).items;
    }
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return [];
      }
    }
  }
  return [];
}

export function parseDiscoveryCandidates(raw: unknown): CandidateGrant[] {
  const parsed = parseJsonLike(raw);
  const candidates = parsed.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      grant_name: toStringValue(row.grant_name ?? row.grantName ?? row.Grant_Name),
      sponsor_org: toStringValue(row.sponsor_org ?? row.sponsorOrg ?? row.Sponsor_Org),
      amount_text: toStringValue(row.amount_text ?? row.amount ?? row.Amount),
      deadline_text: toStringValue(row.deadline_text ?? row.deadline ?? row.Deadline),
      focus_area: toStringValue(row.focus_area ?? row.focusArea ?? row.Focus_Area),
      eligibility_summary: toStringValue(row.eligibility_summary ?? row.eligibility ?? row.Eligibility),
      application_link: toStringValue(row.application_link ?? row.applicationUrl ?? row.Application_Link),
      geographic_scope: toStringValue(row.geographic_scope ?? ""),
      funder_type: toStringValue(row.funder_type ?? "Federal"),
      discovery_source: toStringValue(row.discovery_source ?? "grants_gov"),
      source_reliability_score: Number(row.source_reliability_score ?? 8),
      status: "open" as const,
      notes: toStringValue(row.notes ?? ""),
    };
  });

  return candidates.filter((c) => c.grant_name && c.sponsor_org);
}

export async function discoverGrants(input: DiscoverInput): Promise<{
  candidates: CandidateGrant[];
  inputTokens: number;
  outputTokens: number;
}> {
  const { profile, existingGrants = [], query, anthropic } = input;

  const searchTerm = query?.trim() || profileToSearchKeywords(profile);
  const opps = await searchGrantsGov(searchTerm);

  const existingNames = new Set(
    existingGrants.map((g) => (g.grant_name ?? "").toLowerCase()),
  );
  const fresh = opps.filter(
    (o) => !existingNames.has(o.title.toLowerCase()),
  );

  if (fresh.length === 0) {
    return { candidates: [], inputTokens: 0, outputTokens: 0 };
  }

  const orgContext = profileToContext(profile);
  const oppsList = formatOpportunitiesForLLM(fresh.slice(0, 30));

  const system = `You are a grant research specialist. Given an organization's profile and a list of federal grant opportunities from Grants.gov, identify the grants most relevant to this organization and return them as structured JSON.

Return a JSON array. Each object must have exactly these fields:
- grant_name (string)
- sponsor_org (string)
- amount_text (string, e.g. "Up to $500,000" or "Not specified")
- deadline_text (string, e.g. "2026-08-15" or "Rolling")
- focus_area (string, one short phrase)
- eligibility_summary (string, 1-2 sentences on who is eligible)
- application_link (string, URL)
- geographic_scope (string, e.g. "National", "California", "San Francisco, CA")
- funder_type (string: "Federal", "State", "Foundation", or "Corporate")
- source_reliability_score (number 1-10, use 8 for Grants.gov results)
- notes (string, 1 sentence on why this fits the org or a key eligibility concern)

Return ONLY the JSON array. No explanation, no markdown.`;

  const user = `Organization profile:
${orgContext}

Grant opportunities from Grants.gov (search: "${searchTerm}"):
${oppsList}

Select the grants that are a plausible fit for this organization. Skip grants that are clearly ineligible (e.g. nonprofit-only if entity_type is llc, or unrelated focus areas). Return up to 10 best matches.`;

  const result = await callClaude(anthropic, { system, user, maxTokens: 3000 });
  const candidates = parseDiscoveryCandidates(result.text);
  const deduped = dedupeGrants([...existingGrants, ...candidates]).slice(
    existingGrants.length,
  ) as CandidateGrant[];

  return {
    candidates: deduped,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  };
}
