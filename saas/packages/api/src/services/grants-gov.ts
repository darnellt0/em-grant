export interface GrantsGovOpportunity {
  id: number;
  number: string;
  title: string;
  agencyName: string;
  openDate: string;
  closeDate: string;
  synopsis: string;
  opportunityLink: string;
}

interface GrantsGovResponse {
  hitCount: number;
  oppHits: Array<{
    id: number;
    number: string;
    title: string;
    agencyName?: string;
    openDate?: string;
    closeDate?: string;
    synopsis?: string;
    synopsisDesc?: string;
    opportunityLink?: string;
  }>;
}

export async function searchGrantsGov(
  keyword: string,
  rows = 40,
): Promise<GrantsGovOpportunity[]> {
  const body = {
    keyword,
    oppStatuses: "posted",
    rows,
    startRecordNum: 0,
  };

  const res = await fetch(
    "https://apply07.grants.gov/grantsws/rest/opportunities/search/",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    },
  );

  if (!res.ok) {
    throw new Error(`Grants.gov API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as GrantsGovResponse;
  const hits = data.oppHits ?? [];

  return hits.map((h) => ({
    id: h.id,
    number: h.number ?? String(h.id),
    title: h.title ?? "",
    agencyName: h.agencyName ?? "Unknown Agency",
    openDate: h.openDate ?? "",
    closeDate: h.closeDate ?? "",
    synopsis: h.synopsis ?? h.synopsisDesc ?? "",
    opportunityLink:
      h.opportunityLink ??
      `https://www.grants.gov/search-results-detail/${h.id}`,
  }));
}

export function formatOpportunitiesForLLM(
  opps: GrantsGovOpportunity[],
): string {
  return opps
    .map(
      (o, i) =>
        `${i + 1}. [${o.number}] ${o.title}\n` +
        `   Agency: ${o.agencyName}\n` +
        `   Close: ${o.closeDate || "Unknown"}\n` +
        `   Link: ${o.opportunityLink}\n` +
        (o.synopsis ? `   Synopsis: ${o.synopsis.slice(0, 300)}\n` : ""),
    )
    .join("\n");
}
