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

function containsAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

function clamp(num: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, num));
}

export function assessGrant(grant: GrantForAssessment): GrantAssessmentResult {
  const text = [
    grant.grant_name,
    grant.sponsor_org ?? "",
    grant.focus_area ?? "",
    grant.eligibility_summary ?? "",
    grant.notes ?? "",
  ]
    .join(" ")
    .toLowerCase();

  let priority = 50;
  let businessMatch = 55;
  let woc = 4;
  let leadership = 4;
  let community = 4;

  if (containsAny(text, ["women of color", "woc", "black women", "minority women"])) {
    priority += 20;
    businessMatch += 15;
    woc += 4;
  }
  if (containsAny(text, ["leadership", "professional development", "coaching"])) {
    priority += 12;
    leadership += 4;
  }
  if (containsAny(text, ["community", "equity", "social impact"])) {
    priority += 10;
    community += 4;
  }
  if (containsAny(text, ["california", "bay area", "silicon valley"])) {
    priority += 6;
    businessMatch += 5;
  }
  if (containsAny(text, ["rolling", "ongoing"])) {
    priority += 4;
  }

  priority = clamp(priority, 0, 100);
  businessMatch = clamp(businessMatch, 0, 100);
  woc = clamp(woc, 1, 10);
  leadership = clamp(leadership, 1, 10);
  community = clamp(community, 1, 10);

  const llc = clamp(Math.round(priority * 0.45 + businessMatch * 0.35 + woc * 2), 0, 100);
  const foundation = clamp(Math.round(priority * 0.35 + community * 4 + leadership * 3), 0, 100);
  const overall = clamp(Math.round((llc + foundation) / 2), 0, 100);

  return {
    grant_id: grant.id,
    priority_score: priority,
    business_match_pct: businessMatch,
    woc_focus_rating: woc,
    leadership_dev_alignment: leadership,
    community_impact_score: community,
    llc_priority_score: llc,
    foundation_priority_score: foundation,
    overall_strategic_value: overall,
  };
}

export function assessGrants(grants: GrantForAssessment[]): GrantAssessmentResult[] {
  return grants.map(assessGrant);
}
