"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

type EntityType = "nonprofit" | "llc" | "hybrid" | "other";

export interface OrgProfileData {
  org_name: string | null;
  mission: string | null;
  entity_type: EntityType;
  geography: string | null;
  focus_areas: string[] | null;
  eligibility_notes: string | null;
  search_keywords: string[] | null;
}

interface OrgProfileFormProps {
  orgId: string;
  initial: OrgProfileData | null;
}

function arrToText(arr: string[] | null): string {
  return (arr ?? []).join(", ");
}

function textToArr(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function OrgProfileForm({ orgId, initial }: OrgProfileFormProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [orgName, setOrgName] = useState(initial?.org_name ?? "");
  const [mission, setMission] = useState(initial?.mission ?? "");
  const [entityType, setEntityType] = useState<EntityType>(initial?.entity_type ?? "nonprofit");
  const [geography, setGeography] = useState(initial?.geography ?? "");
  const [focusAreas, setFocusAreas] = useState(arrToText(initial?.focus_areas));
  const [eligibilityNotes, setEligibilityNotes] = useState(initial?.eligibility_notes ?? "");
  const [searchKeywords, setSearchKeywords] = useState(arrToText(initial?.search_keywords));

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);

    const payload = {
      org_id: orgId,
      org_name: orgName.trim() || null,
      mission: mission.trim() || null,
      entity_type: entityType,
      geography: geography.trim() || null,
      focus_areas: textToArr(focusAreas),
      eligibility_notes: eligibilityNotes.trim() || null,
      search_keywords: textToArr(searchKeywords),
    };

    const { error: upsertErr } = await supabase
      .from("org_profiles")
      .upsert(payload, { onConflict: "org_id" });

    setSaving(false);
    if (upsertErr) {
      setError(upsertErr.message);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="profile-form">
      <div className="field">
        <label htmlFor="orgName">Organization name</label>
        <input
          id="orgName"
          type="text"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          placeholder="SF Skate Club"
        />
      </div>

      <div className="field">
        <label htmlFor="mission">Mission statement</label>
        <textarea
          id="mission"
          value={mission}
          onChange={(e) => setMission(e.target.value)}
          rows={3}
          placeholder="Make skateboarding accessible to SF youth through free programs, camps, and community events."
        />
      </div>

      <div className="field">
        <label htmlFor="entityType">Entity type</label>
        <select
          id="entityType"
          value={entityType}
          onChange={(e) => setEntityType(e.target.value as EntityType)}
        >
          <option value="nonprofit">Nonprofit (501c3)</option>
          <option value="llc">For-profit LLC</option>
          <option value="hybrid">Hybrid (LLC + Nonprofit)</option>
          <option value="other">Other</option>
        </select>
        <span className="hint">
          Controls which grants are considered eligible. Hybrid orgs can access both nonprofit and for-profit grants.
        </span>
      </div>

      <div className="field">
        <label htmlFor="geography">Primary geography</label>
        <input
          id="geography"
          type="text"
          value={geography}
          onChange={(e) => setGeography(e.target.value)}
          placeholder="San Francisco, CA"
        />
        <span className="hint">Used to prioritize local and state grants.</span>
      </div>

      <div className="field">
        <label htmlFor="focusAreas">Focus areas</label>
        <input
          id="focusAreas"
          type="text"
          value={focusAreas}
          onChange={(e) => setFocusAreas(e.target.value)}
          placeholder="youth development, arts education, skateboarding, community"
        />
        <span className="hint">Comma-separated. Used to filter relevant grants.</span>
      </div>

      <div className="field">
        <label htmlFor="eligibilityNotes">Eligibility notes</label>
        <textarea
          id="eligibilityNotes"
          value={eligibilityNotes}
          onChange={(e) => setEligibilityNotes(e.target.value)}
          rows={2}
          placeholder="Nonprofit arm (Eduskate) is 501c3 and eligible for nonprofit grants. LLC arm (Stage Off) is eligible for small business grants."
        />
        <span className="hint">Any special eligibility context the AI should know about.</span>
      </div>

      <div className="field">
        <label htmlFor="searchKeywords">Search keywords (optional)</label>
        <input
          id="searchKeywords"
          type="text"
          value={searchKeywords}
          onChange={(e) => setSearchKeywords(e.target.value)}
          placeholder="youth sports, after school programs, arts"
        />
        <span className="hint">
          Comma-separated. Overrides auto-generated search terms for Grants.gov. Leave blank to use focus areas.
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save profile"}
        </button>
        {saved && <span style={{ color: "green" }}>Saved.</span>}
        {error && <span style={{ color: "crimson" }}>{error}</span>}
      </div>
    </form>
  );
}
