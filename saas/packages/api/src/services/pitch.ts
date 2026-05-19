import type Anthropic from "npm:@anthropic-ai/sdk";
import type { OrgProfile } from "../types/org-profile.ts";
import { profileToContext } from "../types/org-profile.ts";
import { callClaude } from "./llm.ts";

export interface GrantForPitch {
  id: string;
  grant_name: string;
  sponsor_org?: string | null;
  amount_text?: string | null;
  focus_area?: string | null;
  eligibility_summary?: string | null;
  deadline_text?: string | null;
}

export interface PitchResult {
  grant_id: string;
  draft_pitch: string;
  checklist: string[];
}

export async function generatePitchWithLLM(
  grant: GrantForPitch,
  profile: OrgProfile,
  anthropic: Anthropic,
): Promise<{ pitch: PitchResult; inputTokens: number; outputTokens: number }> {
  const orgContext = profileToContext(profile);
  const orgName = profile.org_name ?? "Our organization";

  const system = `You are an expert grant writer. Draft a concise, compelling grant application narrative for the given organization and opportunity.

Return a JSON object with exactly these fields:
- draft_pitch (string): 3-4 paragraph narrative ready to paste into an application. Write in first-person plural ("we", "our"). Be specific about mission impact. Do not include placeholder brackets.
- checklist (array of strings): 5-7 concrete action items the org must complete before submitting (e.g. gather specific documents, verify eligibility, prepare budget narrative).

Return ONLY the JSON object. No explanation, no markdown fences.`;

  const user = `Organization:
${orgContext}

Grant opportunity:
- Name: ${grant.grant_name}
- Funder: ${grant.sponsor_org ?? "Unknown"}
- Amount: ${grant.amount_text ?? "Not specified"}
- Focus area: ${grant.focus_area ?? "Not specified"}
- Eligibility: ${grant.eligibility_summary ?? "Not specified"}
- Deadline: ${grant.deadline_text ?? "Not specified"}

Write a grant narrative for ${orgName} applying to this opportunity.`;

  const result = await callClaude(anthropic, {
    system,
    user,
    model: "claude-sonnet-4-6",
    maxTokens: 2048,
  });

  let draft_pitch = "";
  let checklist: string[] = [];

  try {
    const cleaned = result.text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned) as { draft_pitch?: string; checklist?: string[] };
    draft_pitch = parsed.draft_pitch ?? "";
    checklist = parsed.checklist ?? [];
  } catch {
    draft_pitch = result.text.trim();
    checklist = [
      "Confirm eligibility with funder",
      "Gather financial statements and audit",
      "Prepare budget narrative",
      "Collect letters of support",
      "Submit before deadline",
    ];
  }

  return {
    pitch: { grant_id: grant.id, draft_pitch, checklist },
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  };
}

export { generatePitchWithLLM as generatePitch };
