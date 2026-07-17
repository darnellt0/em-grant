"use server";

import { revalidatePath } from "next/cache";
import { requireOrgIdForUser, requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

const FOLDER_ID_RE = /^[A-Za-z0-9_-]{10,200}$/;

function extractFolderId(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  // Accept either bare folder ID OR a Drive URL like
  // https://drive.google.com/drive/folders/<ID>?...
  const urlMatch = s.match(/\/folders\/([A-Za-z0-9_-]+)/);
  if (urlMatch) return urlMatch[1];
  if (FOLDER_ID_RE.test(s)) return s;
  return null;
}

export async function upsertDriveSyncConfigAction(
  folderInput: string,
  label: string,
  enabled: boolean,
  driveAccount: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const folderId = extractFolderId(folderInput);
  if (!folderId) {
    return { ok: false, error: "Couldn't recognize that as a Drive folder ID or URL." };
  }
  if (!driveAccount.trim() || !driveAccount.includes("@")) {
    return { ok: false, error: "Drive account email is required (e.g. main@elevatedmovements.com)." };
  }

  const user = await requireUser();
  const orgId = await requireOrgIdForUser(user.id);
  const supabase = createSupabaseServerClient();

  const payload = {
    org_id: orgId,
    drive_folder_id: folderId,
    drive_folder_label: label.trim().slice(0, 200) || null,
    enabled,
    drive_account: driveAccount.trim().toLowerCase(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("org_drive_sync_config")
    .upsert(payload, { onConflict: "org_id" });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/settings/documents");
  return { ok: true };
}

export async function deleteDriveSyncConfigAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const orgId = await requireOrgIdForUser(user.id);
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("org_drive_sync_config")
    .delete()
    .eq("org_id", orgId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/settings/documents");
  return { ok: true };
}

export async function requestSyncNowAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const orgId = await requireOrgIdForUser(user.id);
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("org_drive_sync_config")
    .update({ sync_requested_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("enabled", true);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/settings/documents");
  return { ok: true };
}
