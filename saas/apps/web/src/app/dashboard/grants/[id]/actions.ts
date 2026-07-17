"use server";

import { revalidatePath } from "next/cache";
import { requireOrgIdForUser, requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

const ALLOWED_STATUSES = ["applied", "in_review", "won", "declined", "skipped"] as const;
const ALLOWED_RATINGS = new Set([-1, 0, 1]);

export async function ratePitchAction(
  grantId: string,
  rating: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!ALLOWED_RATINGS.has(rating)) return { ok: false, error: "Invalid rating." };
  const user = await requireUser();
  const orgId = await requireOrgIdForUser(user.id);
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("grants")
    .update({ pitch_rating: rating, updated_at: new Date().toISOString() })
    .eq("id", grantId)
    .eq("org_id", orgId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/grants/${grantId}`);
  return { ok: true };
}

function emptyToNull(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function parseAmount(v: FormDataEntryValue | null): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (s === "") return null;
  const n = Number(s);
  if (Number.isNaN(n) || n < 0) return null;
  return n;
}

export async function markOutcomeAction(
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const orgId = await requireOrgIdForUser(user.id);

  const grantId = emptyToNull(formData.get("grantId"));
  if (!grantId) return { ok: false, error: "Missing grant id." };

  const statusRaw = emptyToNull(formData.get("status"));
  if (statusRaw !== null && !ALLOWED_STATUSES.includes(statusRaw as typeof ALLOWED_STATUSES[number])) {
    return { ok: false, error: `Unknown status: ${statusRaw}` };
  }

  const applicationDate = emptyToNull(formData.get("applicationDate"));
  const outcomeDate = emptyToNull(formData.get("outcomeDate"));
  const outcomeAmount = parseAmount(formData.get("outcomeAmount"));
  const outcomeNote = emptyToNull(formData.get("outcomeNote"));

  const supabase = createSupabaseServerClient();

  // Update under both the org + grant filter so RLS + an explicit check both gate the write.
  const { error } = await supabase
    .from("grants")
    .update({
      outcome_status: statusRaw,
      application_date: applicationDate,
      outcome_date: outcomeDate,
      outcome_amount: outcomeAmount,
      outcome_note: outcomeNote,
      updated_at: new Date().toISOString(),
    })
    .eq("id", grantId)
    .eq("org_id", orgId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/dashboard/grants/${grantId}`);
  revalidatePath("/dashboard/outcomes");
  return { ok: true };
}
