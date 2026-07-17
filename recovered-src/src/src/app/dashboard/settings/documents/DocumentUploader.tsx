"use client";

import { useState, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { registerUploadAction, finalizeUploadAction } from "./actions";

const KIND_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "irs_letter",     label: "501(c)(3) determination letter" },
  { value: "form_990",       label: "IRS Form 990" },
  { value: "audit",          label: "Audited financials" },
  { value: "board_roster",   label: "Board of directors roster" },
  { value: "budget",         label: "Budget" },
  { value: "financials",     label: "Financial statements (P&L, balance sheet)" },
  { value: "founder_bio",    label: "Founder / leadership bio" },
  { value: "logo",           label: "Org logo" },
  { value: "photos",         label: "Program photos" },
  { value: "letter_support", label: "Letter of support" },
  { value: "past_proposal",  label: "Past successful proposal" },
  { value: "mission_doc",    label: "Mission / theory of change doc" },
  { value: "other",          label: "Other" },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentUploader() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("other");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setError(null);
    if (f && !name.trim()) {
      setName(f.name);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) { setError("Pick a file first."); return; }
    if (file.size > 50 * 1024 * 1024) { setError("Files larger than 50 MB are not supported."); return; }

    setUploading(true);
    setProgress("Registering upload…");

    try {
      const registration = await registerUploadAction(
        name.trim() || file.name,
        kind,
        file.type || null,
        file.size,
        description.trim() || undefined,
      );
      if (!registration.ok) throw new Error(registration.error);

      setProgress("Uploading to storage…");

      const supabase = createSupabaseBrowserClient();
      const { error: storageErr } = await supabase.storage
        .from("org-docs")
        .upload(registration.path, file, { upsert: false, contentType: file.type || undefined });
      if (storageErr) throw new Error(`Storage upload failed: ${storageErr.message}`);

      setProgress("Finalizing…");
      await finalizeUploadAction(registration.id);

      setProgress(`✓ Uploaded ${file.name}`);
      setFile(null);
      setName("");
      setDescription("");
      setKind("other");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
      setTimeout(() => setProgress(null), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setProgress(null);
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ marginBottom: 20 }}>
      <h3 style={{ marginTop: 0 }}>Upload a document</h3>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
            File
          </label>
          <input
            ref={fileRef}
            type="file"
            onChange={onFileChange}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.gif,.txt,.md,.json"
            style={{ width: "100%", padding: "6px", fontSize: 14, border: "1px solid #d1d5db", borderRadius: 6, background: "#fff" }}
          />
          {file && (
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
              {file.name} · {formatBytes(file.size)} · {file.type || "unknown type"}
            </div>
          )}
        </div>

        <div>
          <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
            Display name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. 'EM 501(c)(3) Determination'"
            style={{ width: "100%", padding: "6px 10px", fontSize: 14, border: "1px solid #d1d5db", borderRadius: 6 }}
          />
        </div>

        <div>
          <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
            Type
          </label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            style={{ width: "100%", padding: "6px 10px", fontSize: 14, border: "1px solid #d1d5db", borderRadius: 6, background: "#fff" }}
          >
            {KIND_OPTIONS.map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
            Notes (optional)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. 'FY2024 audited financials, signed June 2025'"
            style={{ width: "100%", padding: "6px 10px", fontSize: 14, border: "1px solid #d1d5db", borderRadius: 6 }}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={uploading || !file}
        style={{
          padding: "8px 18px", borderRadius: 6, fontSize: 14, fontWeight: 500,
          background: uploading || !file ? "#9ca3af" : "#0b57d0", color: "#fff",
          border: "none", cursor: uploading || !file ? "default" : "pointer",
        }}
      >
        {uploading ? "Uploading…" : "Upload"}
      </button>

      {progress && <span style={{ marginLeft: 12, fontSize: 13, color: "#1a7f4e" }}>{progress}</span>}
      {error && <p style={{ marginTop: 10, marginBottom: 0, color: "#c0392b", fontSize: 13 }}>{error}</p>}
    </form>
  );
}
