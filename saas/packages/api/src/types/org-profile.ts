export interface OrgProfile {
  org_id: string;
  org_name: string | null;
  mission: string | null;
  entity_type: "nonprofit" | "llc" | "hybrid" | "other";
  geography: string | null;
  focus_areas: string[] | null;
  eligibility_notes: string | null;
  search_keywords: string[] | null;
}

export function profileToContext(p: OrgProfile): string {
  const lines: string[] = [
    `Organization: ${p.org_name ?? "Unknown"}`,
    `Entity type: ${p.entity_type}`,
    `Mission: ${p.mission ?? "Not specified"}`,
    `Geography: ${p.geography ?? "Not specified"}`,
  ];
  if (p.focus_areas?.length) lines.push(`Focus areas: ${p.focus_areas.join(", ")}`);
  if (p.eligibility_notes) lines.push(`Eligibility notes: ${p.eligibility_notes}`);
  return lines.join("\n");
}

export function profileToSearchKeywords(p: OrgProfile): string {
  const terms: string[] = [];
  if (p.search_keywords?.length) {
    terms.push(...p.search_keywords);
  } else {
    if (p.focus_areas?.length) terms.push(...p.focus_areas.slice(0, 3));
    if (p.geography) terms.push(p.geography.split(",")[0].trim());
  }
  return terms.join(" ");
}
