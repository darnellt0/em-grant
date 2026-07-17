"use client";

import { useState, useTransition } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { deleteDocumentAction } from "./actions";

const KIND_LABELS: Record<string, string> = {
  irs_letter: "501(c)(3) letter",
  form_990: "Form 990",
  audit: "Audit",
  board_roster: "Board roster",
  budget: "Budget",
  financials: "Financials",
  founder_bio: "Founder bio",
  logo: "Logo",
  photos: "Photos",
  letter_support: "Letter of support",
  past_proposal: "Past proposal",
  mission_doc: "Mission doc",
  other: "Other",
};

interface Props {
  doc: {
    id: string;
    name: string;
    kind: string;
    storage_path: string;
    mime_type: string | null;
    size_bytes: number | null;
    description: string | null;
    created_at: string;
    source?: string;
    drive_file_id?: string | null;
  };
}

function formatBytes(n: number | null): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentRow({ doc }: Props) {
  const [downloading, setDownloading] = useState(false);
  const [deleting, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setDownloading(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.storage
        .from("org-docs")
        .createSignedUrl(doc.storage_path, 60);
      if (error || !data?.signedUrl) throw new Error(error?.message ?? "Could not generate download link");
      window.open(data.signedUrl, "_blank");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  function doDelete() {
    if (!confirm(`Delete "${doc.name}"? This permanently removes the file.`)) return;
    startDelete(async () => {
      const res = await deleteDocumentAction(doc.id);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <tr style={{ borderTop: "1px solid #f3f4f6" }}>
      <td style={{ padding: "10px 12px 10px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 500, color: "#111" }}>{doc.name}</span>
          {doc.source === "drive_sync" && (
            <span title={doc.drive_file_id ? `Synced from Drive (file id ${doc.drive_file_id})` : "Synced from Drive"} style={{
              fontSize: 11, fontWeight: 600,
              padding: "1px 8px", borderRadius: 999,
              background: "#dbeafe", color: "#0b57d0", border: "1px solid #93c5fd",
              display: "inline-flex", alignItems: "center", gap: 4,
            }}>
              ↻ From Drive
            </span>
          )}
        </div>
        {doc.description && <div style={{ color: "#6b7280", fontSize: 12, marginTop: 2 }}>{doc.description}</div>}
      </td>
      <td style={{ padding: "10px 12px", fontSize: 13, color: "#374151" }}>
        <span style={{ padding: "2px 8px", borderRadius: 999, background: "#f3f4f6", color: "#374151", fontSize: 12 }}>
          {KIND_LABELS[doc.kind] ?? doc.kind}
        </span>
      </td>
      <td style={{ padding: "10px 12px", fontSize: 13, color: "#374151" }}>
        {formatBytes(doc.size_bytes)}
      </td>
      <td style={{ padding: "10px 12px", fontSize: 13, color: "#6b7280" }}>
        {new Date(doc.created_at).toLocaleDateString()}
      </td>
      <td style={{ padding: "10px 0 10px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
        <button
          onClick={download}
          disabled={downloading}
          style={{ padding: "4px 10px", fontSize: 12, fontWeight: 500, background: "#fff", color: "#0b57d0", border: "1px solid #0b57d0", borderRadius: 6, cursor: "pointer", marginRight: 6 }}
        >
          {downloading ? "…" : "Download"}
        </button>
        <button
          onClick={doDelete}
          disabled={deleting}
          style={{ padding: "4px 10px", fontSize: 12, background: "#fff", color: "#c0392b", border: "1px solid #c0392b", borderRadius: 6, cursor: "pointer" }}
        >
          {deleting ? "…" : "Delete"}
        </button>
        {error && <div style={{ color: "#c0392b", fontSize: 11, marginTop: 4 }}>{error}</div>}
      </td>
    </tr>
  );
}
