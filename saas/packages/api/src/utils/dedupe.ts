export type GrantLike = {
  grant_name?: string | null;
  sponsor_org?: string | null;
};

export function normalizeForKey(input: string | null | undefined): string {
  return String(input ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function grantDedupeKey(grant: GrantLike): string {
  const name = normalizeForKey(grant.grant_name);
  const sponsor = normalizeForKey(grant.sponsor_org);
  return `${name}::${sponsor}`;
}

export function dedupeGrants<T extends GrantLike>(grants: T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];

  for (const grant of grants) {
    const key = grantDedupeKey(grant);
    if (!key || key === "::") continue;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(grant);
  }

  return unique;
}
