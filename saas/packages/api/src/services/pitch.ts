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

export function generatePitch(grant: GrantForPitch): PitchResult {
  const sponsor = grant.sponsor_org ?? "the sponsor";
  const amount = grant.amount_text ?? "the available funding";
  const focus = grant.focus_area ?? "leadership development and community impact";
  const eligibility = grant.eligibility_summary ?? "review sponsor requirements";
  const deadline = grant.deadline_text ?? "the posted deadline";

  const draft = [
    `Elevated Movements is excited to apply for ${grant.grant_name} from ${sponsor}.`,
    `Our programming advances ${focus}, and this opportunity aligns with our mission to serve women of color through measurable leadership outcomes.`,
    `With support of ${amount}, we will scale implementation and reporting discipline while meeting eligibility expectations (${eligibility}) before ${deadline}.`,
  ].join(" ");

  const checklist = [
    "Confirm eligibility and organizational status",
    "Collect impact metrics and outcomes",
    "Draft budget narrative and milestones",
    "Finalize attachments and submit before deadline",
  ];

  return {
    grant_id: grant.id,
    draft_pitch: draft,
    checklist,
  };
}
