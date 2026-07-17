"use server";

import { revalidatePath } from "next/cache";
import { requireOrgIdForUser, requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

const ALLOWED_KINDS = new Set([
  "irs_letter", "form_990", "audit", "board_roster", "budget", "financials",
  "founder_bio", "logo", "photos", "letter_support", "past_proposal",
  "mission_doc", "other",
]);

/**
 * Two-step upload pattern:
 *   1. registerUploadAction(name, kind, mime, size) -> { id, path }
 *   2. client uploads file directly to Storage at returned path
 *   3. finalizeUploadAction(id) -> {ok} confirms (currently a no-op + revalidate)
 *
 * This avoids streaming file bytes through a Next.js server action (which
 * has body-size limits) and lets the browser hit Storage directly with the
 * user's session JWT (RLS-gated).
 */
export async function registerUploadAction(
  name: string,
  kind: string,
  mimeType: string | null,
  sizeBytes: number,
  description?: string,
): Promise<{ ok: true; id: string; path: string } | { ok: false; error: string }> {
  if (!name.trim()) return { ok: false, error: "Filename is required." };
  if (!ALLOWED_KINDS.has(kind)) return { ok: false, error: `Unknown document kind: ${kind}` };
  if (sizeBytes <= 0 || sizeBytes > 50 * 1024 * 1024) {
    return { ok: false, error: "File must be between 1 byte and 50 MB." };
  }

  const user = await requireUser();
  const orgId = await requireOrgIdForUser(user.id);
  const supabase = createSupabaseServerClient();

  const safeExt = (() => {
    const m = name.match(/\.([a-z0-9]{1,8})$/i);
    return m ? `.${m[1].toLowerCase()}` : "";
  })();

  // Insert metadata row first to get the stable id; storage path uses that id.
  const { data: row, error: insertErr } = await supabase
    .from("org_documents")
    .insert({
      org_id: orgId,
      uploaded_by: user.id,
      name: name.trim().slice(0, 256),
      kind,
      storage_path: "pending",  // placeholder; updated below
      mime_type: mimeType,
      size_bytes: sizeBytes,
      description: description?.slice(0, 1000) || null,
    })
    .select("id")
    .single();
  if (insertErr || !row) return { ok: false, error: insertErr?.message ?? "Insert failed" };

  const storagePath = `${orgId}/${row.id}${safeExt}`;
  const { error: updateErr } = await supabase
    .from("org_documents")
    .update({ storage_path: storagePath })
    .eq("id", row.id)
    .eq("org_id", orgId);
  if (updateErr) return { ok: false, error: updateErr.message };

  return { ok: true, id: row.id, path: storagePath };
}

export async function finalizeUploadAction(
  _id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Currently just revalidates; could extend to verify the storage object exists.
  revalidatePath("/dashboard/settings/documents");
  return { ok: true };
}

export async function deleteDocumentAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const orgId = await requireOrgIdForUser(user.id);
  const supabase = createSupabaseServerClient();

  // Look up the row to get storage_path
  const { data: row } = await supabase
    .from("org_documents")
    .select("storage_path")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!row) return { ok: false, error: "Document not found" };

  // Remove storage object first (RLS-gated to org members)
  const { error: storageErr } = await supabase.storage
    .from("org-docs")
    .remove([row.storage_path as string]);
  if (storageErr) {
    // Continue anyway — file may already be gone — but flag the issue
    console.warn("storage remove failed:", storageErr.message);
  }

  const { error: dbErr } = await supabase
    .from("org_documents")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);
  if (dbErr) return { ok: false, error: dbErr.message };

  revalidatePath("/dashboard/settings/documents");
  return { ok: true };
}

export async function updateDocumentMetaAction(
  id: string,
  name: string,
  kind: string,
  description: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!name.trim()) return { ok: false, error: "Name required." };
  if (!ALLOWED_KINDS.has(kind)) return { ok: false, error: `Unknown kind: ${kind}` };

  const user = await requireUser();
  const orgId = await requireOrgIdForUser(user.id);
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("org_documents")
    .update({
      name: name.trim().slice(0, 256),
      kind,
      description: description.slice(0, 1000) || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("org_id", orgId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/settings/documents");
  return { ok: true };
}
