import { dedupeGrants } from "../utils/dedupe";

export interface DiscoverInput {
  orgId: string;
  query?: string;
  existingGrants?: Array<{ grant_name?: string | null; sponsor_org?: string | null }>;
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
      geographic_scope: toStringValue(row.geographic_scope ?? "California"),
      funder_type: toStringValue(row.funder_type ?? "Foundation"),
      discovery_source: toStringValue(row.discovery_source ?? "discover_stub"),
      source_reliability_score: Number(row.source_reliability_score ?? 6),
      status: "open" as const,
      notes: toStringValue(row.notes ?? "Discovered via SaaS discover service stub"),
    };
  });

  return candidates.filter((c) => c.grant_name && c.sponsor_org);
}

export function buildDiscoverStub(input: DiscoverInput): CandidateGrant[] {
  const promptTopic = input.query?.trim() || "women of color leadership";
  const sample: CandidateGrant[] = [
    {
      grant_name: `Community Leadership Catalyst Grant (${promptTopic})`,
      sponsor_org: "Bay Area Community Foundation",
      amount_text: "$25,000 - $75,000",
      deadline_text: "Rolling",
      focus_area: "Leadership development and community impact",
      eligibility_summary: "Small organizations serving underrepresented founders",
      application_link: "https://example.org/catalyst-grant",
      geographic_scope: "California",
      funder_type: "Foundation",
      discovery_source: "discover_stub",
      source_reliability_score: 7,
      status: "open",
      notes: "Stub candidate for discover endpoint",
    },
    {
      grant_name: "Inclusive Entrepreneurship Growth Fund",
      sponsor_org: "Corporate Impact Partners",
      amount_text: "$50,000",
      deadline_text: "2026-06-30",
      focus_area: "Women-led business growth and program delivery",
      eligibility_summary: "Organizations with measurable community outcomes",
      application_link: "https://example.org/inclusive-growth",
      geographic_scope: "United States",
      funder_type: "Corporate",
      discovery_source: "discover_stub",
      source_reliability_score: 6,
      status: "watch",
      notes: "Stub candidate for discover endpoint",
    },
  ];

  const existing = input.existingGrants ?? [];
  const deduped = dedupeGrants([...existing, ...sample]).slice(existing.length);
  return deduped as CandidateGrant[];
}
